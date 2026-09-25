import Phaser from 'phaser';
import { MISSIONS_PER_RUN, PALETTE, SCENES } from '../config/game';
import { VEHICLES, VEHICLE_IDS, type VehicleId } from '../config/vehicles';
import { EQUIPMENT } from '../config/equipment';
import type { HotspotDef } from '../config/missions/types';
import { FONT } from '../systems/Dialog';
import { CAMPAIGN } from '../config/campaign';
import {
  acceptAlarm, chooseVehicle, completeServiceTask, formatTime, nextAlarm, openServiceTasks, runFinished, state, tickMission, vehicleReady,
} from '../systems/GameState';
import { continueFromState } from '../systems/flow';
import { Sound } from '../systems/Sound';
import { SideSceneBase } from './SideSceneBase';
import { addressFor } from './DriveScene';
import type { CityMap } from '../systems/MapRenderer';

const GROUND_Y = 600;

const HOTSPOTS: Record<string, HotspotDef> = {
  monitor: { id: 'monitor', label: 'Alarmmonitor', x: 32, y: 160, w: 176, h: 136, walkX: 160 },
  workbench: { id: 'workbench', label: 'Werkbank', x: 24, y: 440, w: 200, h: 160, walkX: 248 },
  mtw: { id: 'mtw', label: 'MTW', x: 248, y: 424, w: 320, h: 184, walkX: 368 },
  gkw: { id: 'gkw', label: 'GKW', x: 632, y: 384, w: 464, h: 224, walkX: 600 },
  gate: { id: 'gate', label: 'Tor', x: 1104, y: 160, w: 176, h: 440, walkX: 1072 },
};

const VEHICLE_POS: Record<VehicleId, { x: number; y: number }> = {
  mtw: { x: 280, y: 608 },
  gkw: { x: 644, y: 608 },
};

/** Fahrzeughalle: Alarmmonitor, zwei Stellplätze, Werkbank, Tor. */
export class HallScene extends SideSceneBase {
  private vehicleLabels: Partial<Record<VehicleId, Phaser.GameObjects.BitmapText>> = {};
  private monitorGlow!: Phaser.GameObjects.Rectangle;
  private monitorText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.hall);
  }

  create(): void {
    const s = state();
    if (s.phase !== 'hall') {
      continueFromState(this);
      return;
    }
    if (runFinished() && !s.progress) {
      this.scene.start(SCENES.summary);
      return;
    }

    this.setupSide('hall-bg', GROUND_Y, 480);

    for (const vid of VEHICLE_IDS) {
      const def = VEHICLES[vid];
      const pos = VEHICLE_POS[vid];
      this.add.image(pos.x, pos.y, def.sideSprite).setOrigin(0, 1).setDepth(10);
      this.vehicleLabels[vid] = this.add.bitmapText(pos.x + 16, pos.y + 16, FONT, '').setDepth(11);
    }
    this.monitorGlow = this.add.rectangle(40, 168, 160, 120, PALETTE.red, 0.6).setOrigin(0).setDepth(5).setVisible(false);
    this.monitorText = this.add.bitmapText(48, 176, FONT, '').setDepth(6).setMaxWidth(152).setTint(PALETTE.greenLight);

    for (const def of Object.values(HOTSPOTS)) this.addHotspot(def, (d) => void this.onHotspot(d));
    this.refresh();

    if (s.progress?.reinforcement) this.dialog.toast('Zurück in der Halle. Anderes Fahrzeug nehmen, der Einsatz läuft noch.', 3000);
    else if (s.history.length > 0 && !s.progress) this.dialog.toast('Zurück in der Halle. Nachbereitung an der Werkbank nicht vergessen.', 3000);
  }

  update(_t: number, deltaMs: number): void {
    // Bei Nachalarmierung läuft die Einsatzzeit auch in der Halle weiter.
    const p = state().progress;
    if (p?.reinforcement && !p.completed) {
      tickMission(deltaMs);
      this.hud.set(`Ortsverband - Einsatz ${Math.min(state().alarmIndex + 1, MISSIONS_PER_RUN)}/${MISSIONS_PER_RUN}`, 'EINSATZ LÄUFT', `Zeit ${formatTime(p.elapsedMs)}`);
    }
  }

  protected currentLabelFor(def: HotspotDef): string {
    if (def.id === 'mtw' || def.id === 'gkw') {
      const v = VEHICLES[def.id];
      const chosen = state().currentVehicle === def.id && state().progress ? ' (gewählt)' : '';
      return `${v.name} - ${v.longName}${chosen}`;
    }
    return def.label;
  }

  private refresh(): void {
    const s = state();
    for (const vid of VEHICLE_IDS) {
      const ready = vehicleReady(vid);
      const chosen = s.currentVehicle === vid && !!s.progress;
      const label = this.vehicleLabels[vid];
      if (!label) continue;
      label.setText(chosen ? 'gewählt' : ready ? '' : 'nicht einsatzbereit');
      label.setTint(chosen ? PALETTE.yellow : PALETTE.orange);
    }
    const alarm = nextAlarm();
    const pending = !!alarm && !s.progress;
    this.monitorGlow.setVisible(pending);
    this.tweens.killTweensOf(this.monitorGlow);
    if (pending) this.tweens.add({ targets: this.monitorGlow, alpha: 0.1, yoyo: true, repeat: -1, duration: 400 });
    this.monitorText.setText(pending ? 'ALARM' : s.progress ? (s.progress.reinforcement ? 'LÄUFT' : 'AUFTRAG') : 'ruhig');
    this.monitorText.setTint(pending ? PALETTE.white : PALETTE.greenLight);

    const missionNo = Math.min(s.alarmIndex + 1, MISSIONS_PER_RUN);
    const right = s.progress ? `Zeit ${formatTime(s.progress.elapsedMs)}` : '';
    this.hud.set(`Ortsverband - Einsatz ${missionNo}/${MISSIONS_PER_RUN}`, '', right);
  }

  private async onHotspot(def: HotspotDef): Promise<void> {
    this.busy = true;
    try {
      await this.walkTo(def.walkX ?? def.x + def.w / 2);
      switch (def.id) {
        case 'monitor':
          await this.onMonitor();
          break;
        case 'workbench':
          await this.onWorkbench();
          break;
        case 'mtw':
        case 'gkw':
          await this.onVehicle(def.id);
          break;
        case 'gate':
          await this.onGate();
          break;
      }
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  private async onMonitor(): Promise<void> {
    const s = state();
    if (s.progress) {
      const alarm = CAMPAIGN[s.progress.alarmIndex];
      const address = addressFor(this.cache.json.get('city') as CityMap, alarm.missionId, alarm.address);
      if (s.progress.reinforcement) {
        await this.dialog.say(`Einsatz läuft: ${alarm.kind}, ${address}. Das erste Fahrzeug hatte nicht das richtige Gerät. Anderes Fahrzeug wählen und zurück zur Einsatzstelle.`);
      } else {
        await this.dialog.say(`Auftrag bestätigt: ${alarm.kind}, ${address}. Fahrzeug wählen, dann durchs Tor.`);
      }
      return;
    }
    const alarm = nextAlarm();
    if (!alarm) {
      await this.dialog.say('Kein Alarm. Der Monitor zeigt die Wettervorhersage: Sturm.');
      return;
    }
    Sound.play('alarm');
    const address = addressFor(this.cache.json.get('city') as CityMap, alarm.missionId, alarm.address);
    const choice = await this.dialog.choose(`ALARM: ${alarm.kind}\n${address}\n${alarm.brief}`, ['Bestätigen', 'Später']);
    if (choice === 0) {
      acceptAlarm();
      this.dialog.toast('Auftrag angenommen. Welches Fahrzeug?', 2000);
    }
  }

  private async onVehicle(vid: VehicleId): Promise<void> {
    const s = state();
    const def = VEHICLES[vid];
    if (!s.progress) {
      await this.dialog.say(`${def.name}, ${def.longName}. An Bord: ${def.equipment.map((e) => EQUIPMENT[e].name).join(', ')}. Ohne Auftrag bleibt er stehen.`);
      return;
    }
    const equipment = def.equipment.map((e) => EQUIPMENT[e].name).join(', ');
    const open = openServiceTasks().filter((t) => t.vehicleId === vid);
    const warn = open.length ? `\nAchtung, nicht einsatzbereit: ${open.map((t) => t.label).join(', ')}.` : '';
    const choice = await this.dialog.choose(`${def.name} nehmen?\nAn Bord: ${equipment}.${warn}`, [`Ja, ${def.name} nehmen`, 'Doch nicht']);
    if (choice === 0) {
      chooseVehicle(vid);
      this.dialog.toast(`${def.name} gewählt. Jetzt durchs Tor.`, 1800);
    }
  }

  private async onGate(): Promise<void> {
    const s = state();
    if (!s.progress) {
      await this.dialog.say('Ohne Auftrag fährt hier keiner raus. Alarmmonitor prüfen.');
      return;
    }
    if (!s.currentVehicle || s.progress.vehicleId !== s.currentVehicle) {
      await this.dialog.say('Erst ein Fahrzeug wählen.');
      return;
    }
    this.fadeTo(() => this.scene.start(SCENES.drive, { mode: 'out' }));
    await new Promise(() => {}); // Szene wechselt, kein Rücksprung
  }

  private async onWorkbench(): Promise<void> {
    const tasks = openServiceTasks();
    if (tasks.length === 0) {
      await this.dialog.say('Alles einsatzbereit. Zeit für einen Kaffee.');
      return;
    }
    const choice = await this.dialog.choose('Nachbereitung. Was zuerst?', [...tasks.map((t) => t.label), 'Später']);
    if (choice >= tasks.length) return;
    const task = tasks[choice];
    if (task.kind === 'refuel') await this.walkTo(VEHICLE_POS[task.vehicleId].x + 120);
    await this.doAction(task.label, task.durationMs);
    completeServiceTask(task);
    this.refresh();
    this.dialog.toast(`Erledigt: ${task.label}`, 1500);
  }
}
