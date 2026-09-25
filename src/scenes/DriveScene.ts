import Phaser from 'phaser';
import { PALETTE, SCENES } from '../config/game';
import { VEHICLES, type VehicleDef, type VehicleId } from '../config/vehicles';
import { CAMPAIGN } from '../config/campaign';
import { DriveInput } from '../systems/Input';
import { Sound } from '../systems/Sound';
import { MapRenderer, type CityMap } from '../systems/MapRenderer';
import { arriveAtDepot, damageVehicle, formatTime, setPhase, state, tickMission } from '../systems/GameState';
import type { DriveUiScene } from './DriveUiScene';

export interface DriveSceneData {
  mode: 'out' | 'back' | 'free';
  /** Nur für 'free': Fahrzeug ohne Spielstand */
  vehicle?: VehicleId;
}

export interface Zone {
  name: string;
  kind: string;
  mission?: string;
  heading: number;
  street: string;
  rect: Phaser.Geom.Rectangle;
}

interface CivilCar {
  sprite: Phaser.Physics.Arcade.Image;
  points: Phaser.Math.Vector2[];
  next: number;
  speed: number;
  /** 0..1, wird beim Ausweichen vor dem Sondersignal heruntergefahren */
  factor: number;
}

const SIREN_RANGE = 520;
const ARRIVE_SPEED = 32;
/** Anzeige: px/s in km/h (16 px pro Meter) */
const KMH_PER_PXS = 3.6 / 16;

/** Adresse einer Einsatzzone aus der Karte, mit Rückfall auf den Kampagnentext. */
export function addressFor(map: CityMap | undefined, missionId: string, fallback: string): string {
  const z = map?.zones.find((zz) => zz.kind === 'mission' && zz.mission === missionId);
  return z?.street ? `${z.street}, Oldenburg` : fallback;
}

/**
 * Top-down-Fahrmodus auf der Vektor-Stadtkarte. Arcade-Physik für Fahrzeug und
 * Zivilverkehr, Gebäude und Wasser über das Kollisionsraster des MapRenderers.
 */
export class DriveScene extends Phaser.Scene {
  private mode: 'out' | 'back' | 'free' = 'out';
  private vehicleDef!: VehicleDef;
  private player!: Phaser.Physics.Arcade.Image;
  private sirenLight!: Phaser.GameObjects.Rectangle;
  private speed = 0;
  private heading = 0;
  private controls!: DriveInput;
  private cityMap!: MapRenderer;
  zones: Zone[] = [];
  private target!: Zone;
  private targetMarker!: Phaser.GameObjects.Rectangle;
  private arrow!: Phaser.GameObjects.Triangle;
  private cars: CivilCar[] = [];
  private sirenOn = false;
  private arriving = false;
  private lastCrashAt = 0;
  private closureHintShown = false;

  constructor() {
    super(SCENES.drive);
  }

  create(data: DriveSceneData): void {
    this.mode = data.mode;
    this.speed = 0;
    this.arriving = false;
    this.sirenOn = false;
    this.cars = [];
    this.closureHintShown = false;
    const free = this.mode === 'free';
    if (!free) setPhase(this.mode === 'out' ? 'driving-out' : 'driving-back');

    const s = state();
    this.vehicleDef = VEHICLES[free ? (data.vehicle ?? 'gkw') : (s.currentVehicle ?? 'mtw')];
    const map = this.cache.json.get('city') as CityMap;
    this.cityMap = new MapRenderer(this, map);

    this.zones = map.zones.map((z) => ({ name: z.name, kind: z.kind, mission: z.mission, heading: z.heading, street: z.street, rect: new Phaser.Geom.Rectangle(z.x, z.y, z.w, z.h) }));
    const depot = this.zones.find((z) => z.kind === 'depot');
    const missionZone = this.zones.find((z) => z.kind === 'mission' && z.mission === s.progress?.missionId);
    if (!depot) throw new Error('Zone unterkunft fehlt');
    this.target = this.mode === 'out' ? (missionZone ?? depot) : depot;
    const spawnZone = this.mode === 'back' ? (missionZone ?? depot) : depot;

    this.player = this.physics.add.image(spawnZone.rect.centerX, spawnZone.rect.centerY, this.vehicleDef.topSprite).setDepth(10);
    const r = this.vehicleDef.drive.bodyRadius;
    this.player.setCircle(r, this.player.width / 2 - r, this.player.height / 2 - r);
    this.heading = spawnZone.heading;
    this.player.setAngle(this.heading);
    this.sirenLight = this.add.rectangle(0, 0, 9, 9, PALETTE.thwBlueLight).setDepth(11).setVisible(false);

    this.createCivilTraffic(map);

    this.targetMarker = this.add
      .rectangle(this.target.rect.centerX, this.target.rect.centerY, this.target.rect.width, this.target.rect.height)
      .setStrokeStyle(4, PALETTE.yellow)
      .setDepth(5);
    this.tweens.add({ targets: this.targetMarker, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
    this.arrow = this.add.triangle(0, 0, 0, -8, 22, 0, 0, 8, PALETTE.yellow).setDepth(12);
    if (free) {
      this.targetMarker.setVisible(false);
      this.arrow.setVisible(false);
      this.input.keyboard?.on('keydown-ESC', () => this.leaveFreeDrive());
      this.input.keyboard?.on('keydown-V', () => this.scene.restart({ mode: 'free', vehicle: this.vehicleDef.id === 'gkw' ? 'mtw' : 'gkw' } satisfies DriveSceneData));
    }

    this.cameras.main.setBounds(0, 0, map.width, map.height);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setRoundPixels(true);
    this.cityMap.update(this.cameras.main);

    this.controls = new DriveInput(this);
    this.scene.launch(SCENES.driveUi, { input: this.controls, drive: this });

    const alarm = s.progress ? CAMPAIGN[s.progress.alarmIndex] : null;
    const targetText = this.mode === 'out' ? `Ziel: ${alarm ? addressFor(map, alarm.missionId, alarm.address) : '?'}` : 'Ziel: Unterkunft';
    const intro = free ? `Freies Fahren mit dem ${this.vehicleDef.name}. V: Fahrzeug wechseln, ESC: zurück zum Start.` : this.mode === 'out' ? `Ausrücken mit dem ${this.vehicleDef.name}. ${targetText}` : 'Rückfahrt zur Unterkunft.';
    this.time.delayedCall(50, () => this.toast(intro, free ? 4000 : 2500));
    Sound.play('engine-start');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.cityMap.destroy();
      this.scene.stop(SCENES.driveUi);
    });
  }

  isFreeDrive(): boolean {
    return this.mode === 'free';
  }

  private leaveFreeDrive(): void {
    this.arriving = true;
    Sound.stop('siren');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.boot));
  }

  private ui(): DriveUiScene | null {
    const s = this.scene.get(SCENES.driveUi) as DriveUiScene | null;
    return s && s.hud ? s : null;
  }

  private toast(text: string, ms?: number): void {
    this.ui()?.toast(text, ms);
  }

  /** Für die Übersichtskarte: Spieler, Ziel und Unterkunft in Weltkoordinaten. */
  overviewInfo(): { player: { x: number; y: number }; target: { x: number; y: number }; depot: { x: number; y: number }; heading: number } {
    const depot = this.zones.find((z) => z.kind === 'depot')!;
    return { player: { x: this.player.x, y: this.player.y }, target: { x: this.target.rect.centerX, y: this.target.rect.centerY }, depot: { x: depot.rect.centerX, y: depot.rect.centerY }, heading: this.heading };
  }

  private createCivilTraffic(map: CityMap): void {
    const group = this.physics.add.group({ immovable: true });
    for (const route of map.routes) {
      const points = route.points.map(([x, y]) => new Phaser.Math.Vector2(x, y));
      if (points.length < 2) continue;
      const sprite = group.create(points[0].x, points[0].y, route.sprite) as Phaser.Physics.Arcade.Image;
      sprite.setDepth(9).setCircle(17, sprite.width / 2 - 17, sprite.height / 2 - 17);
      this.cars.push({ sprite, points, next: 1, speed: route.speed, factor: 1 });
    }
    this.physics.add.collider(this.player, group, () => this.onCarHit());
  }

  private onWallHit(): void {
    if (Math.abs(this.speed) > 160) this.crash(Math.abs(this.speed) / 130);
    this.speed *= -0.25;
  }

  private onCarHit(): void {
    if (Math.abs(this.speed) > 80) this.crash(2 + Math.abs(this.speed) / 130);
    this.speed *= 0.2;
  }

  private crash(damage: number): void {
    const now = this.time.now;
    if (now - this.lastCrashAt < 600) return;
    this.lastCrashAt = now;
    if (this.mode !== 'free') damageVehicle(Math.round(damage * this.vehicleDef.drive.mass));
    Sound.play('crash');
    this.cameras.main.shake(120, 0.004);
    this.toast('Blechschaden.', 900);
  }

  update(_time: number, deltaMs: number): void {
    if (this.arriving) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const s = state();
    if (this.mode !== 'free' && s.progress && !s.progress.completed) tickMission(deltaMs);

    this.updatePlayer(dt);
    this.updateCars(dt);
    this.cityMap.update(this.cameras.main);
    this.updateHud();
    this.checkClosureHint();
    this.checkArrival();
  }

  /** Prüft den Kreis um die Fahrzeugmitte gegen das Kollisionsraster. */
  private hitsWall(x: number, y: number): boolean {
    const r = this.vehicleDef.drive.bodyRadius;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (this.cityMap.isBlocked(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
    }
    return this.cityMap.isBlocked(x, y);
  }

  private updatePlayer(dt: number): void {
    const c = this.controls.read();
    const d = this.vehicleDef.drive;
    const fueled = state().vehicles[this.vehicleDef.id].fueled;
    const maxSpeed = fueled ? d.maxSpeed : d.maxSpeed * 0.8;

    if (c.sirenToggled) {
      this.sirenOn = c.siren;
      if (this.sirenOn) Sound.play('siren', { loop: true });
      else Sound.stop('siren');
    }

    if (c.throttle) this.speed = Math.min(maxSpeed, this.speed + d.accel * dt);
    else if (c.brake) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - d.brake * dt);
      else this.speed = Math.max(-d.reverseSpeed, this.speed - d.accel * 0.6 * dt);
    } else {
      const sign = Math.sign(this.speed);
      this.speed = sign * Math.max(0, Math.abs(this.speed) - d.drag * dt);
    }

    // Lenken nur bei Fahrt; die Drehrate wächst mit der Geschwindigkeit.
    const steerFactor = Phaser.Math.Clamp(Math.abs(this.speed) / (maxSpeed * 0.5), 0, 1);
    const dir = this.speed < 0 ? -1 : 1;
    if (c.left) this.heading -= d.turnRate * steerFactor * dir * dt;
    if (c.right) this.heading += d.turnRate * steerFactor * dir * dt;

    const rad = Phaser.Math.DegToRad(this.heading);
    // Wandkollision über das Raster: Schritt vorab prüfen, bei Treffer abprallen.
    const nx = this.player.x + Math.cos(rad) * this.speed * dt;
    const ny = this.player.y + Math.sin(rad) * this.speed * dt;
    if (this.hitsWall(nx, ny)) {
      this.onWallHit();
    }
    this.player.setAngle(this.heading);
    this.player.setVelocity(Math.cos(rad) * this.speed, Math.sin(rad) * this.speed);

    this.sirenLight.setPosition(this.player.x, this.player.y);
    this.sirenLight.setVisible(this.sirenOn && Math.floor(this.time.now / 120) % 2 === 0);

    // Kompasspfeil zum Ziel
    const tx = this.target.rect.centerX;
    const ty = this.target.rect.centerY;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tx, ty);
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, tx, ty);
    this.arrow.setVisible(this.mode !== 'free' && dist > 280);
    this.arrow.setPosition(this.player.x + Math.cos(ang) * 80, this.player.y + Math.sin(ang) * 80);
    this.arrow.setRotation(ang);
  }

  private updateCars(dt: number): void {
    for (const car of this.cars) {
      const sp = car.sprite;
      const target = car.points[car.next];
      const toTarget = new Phaser.Math.Vector2(target.x - sp.x, target.y - sp.y);
      const dist = toTarget.length();
      if (dist < 8) {
        car.next = (car.next + 1) % car.points.length;
        continue;
      }
      const dir = toTarget.normalize();
      // Ausweichen: bei Sondersignal in Reichweite anhalten; ohne Sondersignal nur, wenn der Spieler direkt vor dem Auto steht.
      const dPlayer = Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y);
      const ahead = dir.dot(new Phaser.Math.Vector2(this.player.x - sp.x, this.player.y - sp.y)) > 0;
      const shouldStop = (this.sirenOn && dPlayer < SIREN_RANGE) || (ahead && dPlayer < 104);
      car.factor = Phaser.Math.Linear(car.factor, shouldStop ? 0 : 1, Math.min(1, dt * 4));
      sp.setRotation(Math.atan2(dir.y, dir.x));
      sp.setVelocity(dir.x * car.speed * car.factor, dir.y * car.speed * car.factor);
    }
  }

  private updateHud(): void {
    const s = state();
    const v = s.vehicles[this.vehicleDef.id];
    const left = `${this.vehicleDef.name}  ${Math.round(Math.abs(this.speed) * KMH_PER_PXS)} km/h${v.fueled ? '' : '  RESERVE'}`;
    const center = this.sirenOn ? 'SONDERSIGNAL' : this.mode === 'free' ? 'FREIES FAHREN' : '';
    const right = this.mode === 'free' ? 'V: Fahrzeug  ESC: Start' : s.progress && !s.progress.completed ? `Zeit ${formatTime(s.progress.elapsedMs)}` : `Zustand ${v.condition}%`;
    this.ui()?.hud.set(left, center, right);
  }

  private checkClosureHint(): void {
    if (this.closureHintShown) return;
    const closure = this.zones.find((z) => z.kind === 'closure');
    if (!closure) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, closure.rect.centerX, closure.rect.centerY) < 224) {
      this.closureHintShown = true;
      this.toast('Baustelle. Hier geht es nicht weiter, Umweg fahren.', 2500);
    }
  }

  private checkArrival(): void {
    if (this.mode === 'free') return;
    if (!Phaser.Geom.Rectangle.Contains(this.target.rect, this.player.x, this.player.y)) return;
    if (Math.abs(this.speed) > ARRIVE_SPEED) {
      if (Math.floor(this.time.now / 800) % 2 === 0) this.ui()?.hud.set('', 'ANHALTEN', '');
      return;
    }
    this.arriving = true;
    this.speed = 0;
    this.player.setVelocity(0, 0);
    Sound.stop('siren');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.mode === 'out') {
        setPhase('on-site');
        this.scene.start(SCENES.side);
      } else {
        arriveAtDepot();
        this.scene.start(SCENES.hall);
      }
    });
  }
}
