import Phaser from 'phaser';
import { PALETTE, SCENES } from '../config/game';
import { EQUIPMENT, type EquipmentDef, type EquipmentId } from '../config/equipment';
import { VEHICLES } from '../config/vehicles';
import { MISSIONS } from '../config/missions';
import type { HotspotDef, MissionDef, PropDef, SequenceMinigameDef, TaskDef } from '../config/missions/types';
import { FONT } from '../systems/Dialog';
import { Sound } from '../systems/Sound';
import { TaskMachine, type TaskContext } from '../systems/TaskMachine';
import { rateMission } from '../systems/rating';
import {
  addPenalty, completeMission, equipmentServiced, formatTime, markEquipmentRepaired, markEquipmentUsed, markTaskDone,
  requestReinforcement, setPhase, state, tickMission, vehicleHasEquipment,
} from '../systems/GameState';
import { continueFromState } from '../systems/flow';
import { SideSceneBase } from './SideSceneBase';

/**
 * Generische Einsatzstelle in Seitenansicht. Hintergrund, Hotspots, Props und
 * Aufgaben kommen aus der MissionDef; die Reihenfolge-Logik aus der TaskMachine.
 */
export class SideScene extends SideSceneBase {
  private def!: MissionDef;
  private machine!: TaskMachine;
  private props = new Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image>();
  private hotspotZones = new Map<string, Phaser.GameObjects.Rectangle>();
  private taskCounter!: Phaser.GameObjects.BitmapText;

  constructor() {
    super(SCENES.side);
  }

  create(): void {
    const s = state();
    if (s.phase !== 'on-site' || !s.progress || !s.progress.vehicleId) {
      continueFromState(this);
      return;
    }
    this.def = MISSIONS[s.progress.missionId];
    this.machine = new TaskMachine(this.def);
    this.props.clear();
    this.hotspotZones.clear();

    this.setupSide(this.def.background, this.def.groundY, this.def.vehiclePos.x - 40);

    const vehicle = VEHICLES[s.progress.vehicleId];
    this.add.image(this.def.vehiclePos.x, this.def.vehiclePos.y, vehicle.sideSprite).setOrigin(0, 1).setDepth(20);

    for (const p of this.def.props) this.createProp(p);
    for (const h of this.def.hotspots) this.hotspotZones.set(h.id, this.addHotspot(h, (d) => void this.onHotspot(d)));
    this.add.rectangle(0, 44, 600, 40, PALETTE.black, 0.7).setOrigin(0).setDepth(800);
    this.taskCounter = this.add.bitmapText(12, 48, FONT, '').setDepth(801).setTint(PALETTE.grayLight);

    this.applyDoneTaskEffects();
    this.refreshHud();

    if (s.progress.completed) this.dialog.toast('Einsatz erledigt. Klick aufs Fahrzeug für die Rückfahrt.', 2500);
    else if (s.progress.reinforcement) this.dialog.toast(`Zurück mit dem ${vehicle.name}. Weiter geht es.`, 2500);
    else if (s.progress.gameOvers > 0) this.dialog.toast('Neuer Versuch. Diesmal mit Verstand.', 2500);
  }

  update(_t: number, deltaMs: number): void {
    if (!this.def) return;
    tickMission(deltaMs);
    this.refreshHud();
  }

  // ------------------------------------------------------------------ Aufbau

  private createProp(p: PropDef): void {
    const obj = p.sprite && this.textures.exists(p.sprite)
      ? this.add.image(p.x, p.y, p.sprite).setOrigin(0).setDepth(15)
      : this.add.rectangle(p.x, p.y, p.w, p.h, PALETTE[p.color]).setOrigin(0).setDepth(15).setStrokeStyle(4, PALETTE.dark);
    obj.setVisible(!p.hidden);
    this.props.set(p.id, obj);
    if (p.label) this.add.bitmapText(p.x + 8, p.y + 8, FONT, p.label).setDepth(16).setTint(PALETTE.white).setVisible(!p.hidden);
  }

  private context(): TaskContext {
    const p = state().progress!;
    const vid = p.vehicleId!;
    return {
      done: new Set(p.doneTasks),
      repaired: new Set(p.repairedEquipment),
      hasEquipment: (eq) => vehicleHasEquipment(vid, eq),
      isServiced: (eq) => equipmentServiced(vid, eq),
    };
  }

  /** Nach Laden/Neustart: Props so setzen, als wären die erledigten Aufgaben gerade passiert. */
  private applyDoneTaskEffects(): void {
    const done = new Set(state().progress!.doneTasks);
    for (const t of this.def.tasks) {
      if (!done.has(t.id)) continue;
      this.applyTaskEffects(t);
      if (t.tween) this.setPropHeight(t.tween.prop, t.tween.h, t.tween.y);
    }
  }

  private applyTaskEffects(t: TaskDef): void {
    for (const id of t.show ?? []) this.props.get(id)?.setVisible(true);
    for (const id of t.hide ?? []) this.props.get(id)?.setVisible(false);
  }

  private setPropHeight(id: string, h: number, y?: number): void {
    const obj = this.props.get(id);
    if (obj instanceof Phaser.GameObjects.Rectangle) {
      obj.setSize(obj.width, h);
      if (y !== undefined) obj.setY(y);
    }
  }

  private refreshHud(): void {
    const p = state().progress;
    if (!p) return;
    const ctx = this.context();
    // Hotspots ohne offene Aufgabe und ohne Text ausblenden.
    for (const h of this.def.hotspots) {
      const hasOpen = this.def.tasks.some((t) => t.hotspot === h.id && !ctx.done.has(t.id));
      const zone = this.hotspotZones.get(h.id);
      if (zone) zone.setVisible(hasOpen || !!h.idleText || h.id === this.def.vehicleHotspot);
    }
    const req = this.machine.requiredTasks();
    const doneReq = req.filter((t) => ctx.done.has(t.id)).length;
    this.hud.set(this.def.title, '', `Zeit ${formatTime(p.elapsedMs)}`);
    const suffix = p.reinforcement && !p.completed ? ' - nachalarmiert' : '';
    this.taskCounter.setText(p.completed ? 'Einsatz erledigt' : `Aufgaben ${doneReq}/${req.length}${suffix}`);
  }

  protected currentLabelFor(def: HotspotDef): string {
    const p = state().progress;
    if (def.id === this.def.vehicleHotspot && p?.completed) return 'Rückfahrt antreten';
    return def.label;
  }

  // ------------------------------------------------------------------ Klick-Logik

  private async onHotspot(def: HotspotDef): Promise<void> {
    const p = state().progress;
    if (!p) return;
    this.busy = true;
    try {
      if (def.id === this.def.vehicleHotspot && (p.completed || p.reinforcement)) {
        await this.onVehicleSpecial(def);
        return;
      }
      const result = this.machine.onHotspot(def.id, this.context());
      switch (result.kind) {
        case 'idle':
        case 'blocked':
          await this.walkTo(def.walkX ?? def.x + def.w / 2);
          await this.dialog.say(result.text);
          break;
        case 'task':
          await this.runTask(result.task, def);
          break;
        case 'menu': {
          const idx = await this.dialog.choose('Was tun?', [...result.tasks.map((t) => t.label), 'Nichts']);
          if (idx < result.tasks.length) await this.runTask(result.tasks[idx], def);
          break;
        }
      }
    } finally {
      this.busy = false;
      this.refreshHud();
    }
  }

  /** Fahrzeug-Hotspot nach Einsatzende oder bei Nachalarmierung: Rückfahrt anbieten. */
  private async onVehicleSpecial(def: HotspotDef): Promise<void> {
    const p = state().progress!;
    await this.walkTo(def.walkX ?? def.x);
    if (p.completed) {
      this.startReturn();
      return;
    }
    const result = this.machine.onHotspot(def.id, this.context());
    const tasks = result.kind === 'task' ? [result.task] : result.kind === 'menu' ? result.tasks : [];
    const labels = [...tasks.map((t) => t.label), 'Zur Unterkunft, anderes Fahrzeug holen', 'Nichts'];
    const idx = await this.dialog.choose('Am Fahrzeug.', labels);
    if (idx < tasks.length) await this.runTask(tasks[idx], def);
    else if (idx === tasks.length) {
      requestReinforcement(this.machine.resetOnReturnIds());
      this.startReturn();
    }
  }

  private startReturn(): void {
    setPhase('driving-back');
    this.fadeTo(() => this.scene.start(SCENES.drive, { mode: 'back' }));
  }

  private gameOver(reason: string): void {
    Sound.play('game-over');
    this.cameras.main.flash(200, 200, 0, 0);
    this.fadeTo(() => this.scene.start(SCENES.gameOver, { reason }));
  }

  private async runTask(task: TaskDef, hotspot: HotspotDef): Promise<void> {
    await this.walkTo(hotspot.walkX ?? hotspot.x + hotspot.w / 2);
    const pre = this.machine.preflight(task, this.context());

    if (pre.gameOver) {
      this.gameOver(pre.gameOver);
      return;
    }
    if (pre.missingEquipment) {
      await this.dialog.say(pre.missingEquipment.text);
      if (!state().progress?.reinforcement) {
        requestReinforcement([]);
        await this.dialog.say(this.def.reinforcementText);
      }
      return;
    }
    for (const pen of pre.penalties) {
      await this.dialog.say(pen.text);
      addPenalty(pen.ms);
    }
    if (task.choice) {
      const idx = await this.dialog.choose(task.choice.prompt, task.choice.options.map((o) => o.label));
      const opt = task.choice.options[idx];
      if (opt.outcome === 'gameover') {
        this.gameOver(opt.text ?? 'Das war es.');
        return;
      }
      if (opt.outcome === 'penalty') addPenalty(opt.penaltyMs ?? 15000);
      if (opt.text) await this.dialog.say(opt.text);
    }
    if (pre.repair) await this.repairEquipment(pre.repair);
    if (task.minigame) await this.runSequenceMinigame(task.minigame, task);
    if (task.durationMs) {
      const tween = task.tween;
      const startH = tween ? this.propHeight(tween.prop) : 0;
      const startY = tween ? this.propY(tween.prop) : 0;
      await this.doAction(task.progressLabel ?? task.label, task.durationMs, (prog) => {
        if (!tween) return;
        const h = Phaser.Math.Linear(startH, tween.h, prog);
        const y = tween.y !== undefined ? Phaser.Math.Linear(startY, tween.y, prog) : undefined;
        this.setPropHeight(tween.prop, h, y);
      });
    }
    this.applyTaskEffects(task);
    for (const eq of task.usesEquipment ?? []) markEquipmentUsed(eq);
    markTaskDone(task.id);
    if (task.doneText) await this.dialog.say(task.doneText);
    if (this.machine.isComplete(this.context())) await this.finishMission();
  }

  private propHeight(id: string): number {
    const obj = this.props.get(id);
    return obj ? obj.height : 0;
  }

  private propY(id: string): number {
    const obj = this.props.get(id);
    return obj ? obj.y : 0;
  }

  private async repairEquipment(eq: EquipmentDef): Promise<void> {
    await this.dialog.say(eq.failText ?? `${eq.name} funktioniert nicht.`);
    await this.doAction(`${eq.name} gangbar machen`, eq.repairMs ?? 5000);
    addPenalty(0, false);
    markEquipmentRepaired(eq.id as EquipmentId);
    await this.dialog.say(`${eq.name} läuft wieder. Das hätte die Nachbereitung in der Halle erledigt.`);
  }

  /** Schritte in der richtigen Reihenfolge anklicken. Falscher Schritt: Zeitstrafe, Korrekturaktion, Schritt gilt trotzdem. */
  private runSequenceMinigame(mg: SequenceMinigameDef, task: TaskDef): Promise<void> {
    return new Promise((resolve) => {
      const remaining = [...mg.order];
      const markers: Phaser.GameObjects.Container[] = [];
      let running = false;
      void this.dialog.say(mg.prompt).then(() => {
        for (const step of mg.steps) {
          const box = this.add.rectangle(0, 0, 36, 36, PALETTE.yellow).setStrokeStyle(4, PALETTE.dark).setInteractive({ useHandCursor: true });
          const label = this.add.bitmapText(0, -48, FONT, step.label).setOrigin(0.5, 1).setVisible(false);
          const labelBg = this.add.rectangle(0, -48, 40, 44, PALETTE.black, 0.8).setOrigin(0.5, 1).setVisible(false);
          const c = this.add.container(step.x, step.y, [box, labelBg, label]).setDepth(60);
          markers.push(c);
          box.on('pointerover', () => {
            label.setVisible(true);
            labelBg.setSize(label.width + 24, 44).setVisible(true);
          });
          box.on('pointerout', () => {
            label.setVisible(false);
            labelBg.setVisible(false);
          });
          box.on('pointerdown', () => {
            if (running || this.dialog.isOpen() || !remaining.includes(step.id)) return;
            running = true;
            label.setVisible(false);
            labelBg.setVisible(false);
            void (async () => {
              if (remaining[0] === step.id) {
                Sound.play(task.usesEquipment?.[0] === 'pump' ? 'pump' : 'chainsaw');
                await this.doAction(step.label, mg.stepDurationMs);
              } else {
                await this.dialog.say(mg.wrongText);
                addPenalty(mg.wrongPenaltyMs);
                await this.doAction(mg.wrongActionLabel, Math.min(3000, mg.stepDurationMs * 1.5));
                await this.doAction(step.label, mg.stepDurationMs);
              }
              remaining.splice(remaining.indexOf(step.id), 1);
              box.setFillStyle(PALETTE.gray).disableInteractive();
              label.setVisible(false);
              labelBg.setVisible(false);
              running = false;
              if (remaining.length === 0) {
                markers.forEach((m) => m.destroy());
                resolve();
              }
            })();
          });
        }
        this.dialog.toast('Reihenfolge wählen: gelbe Markierungen anklicken.', 2500);
      });
    });
  }

  private async finishMission(): Promise<void> {
    const p = state().progress!;
    const optional = this.machine.optionalTasks();
    const optionalDone = optional.filter((t) => p.doneTasks.includes(t.id)).length;
    const rating = rateMission(p, this.def.parTimeMs, optionalDone, optional.length);
    completeMission({
      title: this.def.title,
      elapsedMs: p.elapsedMs,
      procedureErrors: p.procedureErrors,
      optionalDone,
      optionalTotal: optional.length,
      reinforcement: p.reinforcement,
      gameOvers: p.gameOvers,
      rating,
    });
    Sound.play('mission-done');
    const used = p.usedEquipment.map((e) => EQUIPMENT[e].name);
    const lines = [
      `Einsatz erledigt: ${this.def.title}`,
      `Zeit: ${formatTime(p.elapsedMs)} (Richtzeit ${formatTime(this.def.parTimeMs)})`,
      `Ablauffehler: ${p.procedureErrors}${p.reinforcement ? ', Nachalarmierung' : ''}${p.gameOvers ? `, ${p.gameOvers} Mal gestorben` : ''}`,
      optional.length ? `Optional: ${optionalDone}/${optional.length}` : '',
      `Bewertung: ${rating}`,
      used.length ? `Nachbereitung nötig: ${used.join(', ')}` : '',
    ].filter(Boolean);
    await this.dialog.say(lines.join('\n'));
    this.dialog.toast('Klick aufs Fahrzeug: Rückfahrt.', 2500);
  }
}
