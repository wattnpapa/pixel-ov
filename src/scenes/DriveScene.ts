import Phaser from 'phaser';
import { PALETTE, SCENES } from '../config/game';
import { VEHICLES, type VehicleDef } from '../config/vehicles';
import { CAMPAIGN } from '../config/campaign';
import { DriveInput } from '../systems/Input';
import type { DriveUiScene } from './DriveUiScene';
import { Sound } from '../systems/Sound';
import { arriveAtDepot, damageVehicle, formatTime, setPhase, state, tickMission } from '../systems/GameState';

export interface DriveSceneData {
  mode: 'out' | 'back';
}

interface Zone {
  name: string;
  kind: string;
  mission?: string;
  heading: number;
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

const SIREN_RANGE = 130;
const ARRIVE_SPEED = 8;

/**
 * Top-down-Fahrmodus auf der Stadtkarte. Arcade-Physik: das Fahrzeug dreht sich
 * um die eigene Achse und beschleunigt in Fahrtrichtung.
 */
export class DriveScene extends Phaser.Scene {
  private mode: 'out' | 'back' = 'out';
  private vehicleDef!: VehicleDef;
  private player!: Phaser.Physics.Arcade.Image;
  private sirenLight!: Phaser.GameObjects.Rectangle;
  private speed = 0;
  private heading = 0;
  private controls!: DriveInput;
  private zones: Zone[] = [];
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
    setPhase(this.mode === 'out' ? 'driving-out' : 'driving-back');

    const s = state();
    this.vehicleDef = VEHICLES[s.currentVehicle ?? 'mtw'];

    const map = this.make.tilemap({ key: 'city' });
    const tiles = map.addTilesetImage('city-tileset', 'city-tileset');
    if (!tiles) throw new Error('Tileset fehlt');
    map.createLayer('Boden', tiles, 0, 0);
    map.createLayer('Markierung', tiles, 0, 0);
    const buildings = map.createLayer('Gebaeude', tiles, 0, 0);
    if (!buildings) throw new Error('Layer Gebaeude fehlt');
    buildings.setCollisionByProperty({ collides: true });

    this.zones = this.readZones(map);
    const depot = this.zones.find((z) => z.kind === 'depot');
    const missionZone = this.zones.find((z) => z.kind === 'mission' && z.mission === s.progress?.missionId);
    if (!depot) throw new Error('Zone unterkunft fehlt');
    this.target = this.mode === 'out' ? (missionZone ?? depot) : depot;
    const spawnZone = this.mode === 'out' ? depot : (missionZone ?? depot);

    this.player = this.physics.add.image(spawnZone.rect.centerX, spawnZone.rect.centerY, this.vehicleDef.topSprite).setDepth(10);
    const r = this.vehicleDef.drive.bodyRadius;
    this.player.setCircle(r, this.player.width / 2 - r, this.player.height / 2 - r);
    this.heading = spawnZone.heading;
    this.player.setAngle(this.heading);
    this.sirenLight = this.add.rectangle(0, 0, 3, 3, PALETTE.thwBlueLight).setDepth(11).setVisible(false);

    this.physics.add.collider(this.player, buildings, () => this.onWallHit());
    this.createCivilTraffic(map, buildings);

    this.targetMarker = this.add
      .rectangle(this.target.rect.centerX, this.target.rect.centerY, this.target.rect.width, this.target.rect.height)
      .setStrokeStyle(2, PALETTE.yellow)
      .setDepth(5);
    this.tweens.add({ targets: this.targetMarker, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
    this.arrow = this.add.triangle(0, 0, 0, -3, 8, 0, 0, 3, PALETTE.yellow).setDepth(12);

    // Welt 2x gezoomt: 16px-Tiles erscheinen wie 32px, das HUD liegt in der Overlay-Szene bei Zoom 1.
    this.cameras.main.setZoom(2);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setRoundPixels(true);

    this.controls = new DriveInput(this);
    this.scene.launch(SCENES.driveUi, { input: this.controls });

    const alarm = s.progress ? CAMPAIGN[s.progress.alarmIndex] : null;
    const targetText = this.mode === 'out' ? `Ziel: ${alarm?.address ?? '?'}` : 'Ziel: Unterkunft';
    this.time.delayedCall(50, () => this.toast(this.mode === 'out' ? `Ausrücken mit dem ${this.vehicleDef.name}. ${targetText}` : 'Rückfahrt zur Unterkunft.', 2500));
    Sound.play('engine-start');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      this.scene.stop(SCENES.driveUi);
    });
  }

  private ui(): DriveUiScene | null {
    const s = this.scene.get(SCENES.driveUi) as DriveUiScene | null;
    return s && s.hud ? s : null;
  }

  private toast(text: string, ms?: number): void {
    this.ui()?.toast(text, ms);
  }

  private readZones(map: Phaser.Tilemaps.Tilemap): Zone[] {
    const layer = map.getObjectLayer('Zonen');
    if (!layer) return [];
    return layer.objects.map((o) => {
      const props = Object.fromEntries((o.properties ?? []).map((p: { name: string; value: unknown }) => [p.name, p.value]));
      return {
        name: o.name,
        kind: String(props.kind ?? ''),
        mission: props.mission ? String(props.mission) : undefined,
        heading: Number(props.heading ?? 0),
        rect: new Phaser.Geom.Rectangle(o.x ?? 0, o.y ?? 0, o.width ?? 16, o.height ?? 16),
      };
    });
  }

  private createCivilTraffic(map: Phaser.Tilemaps.Tilemap, buildings: Phaser.Tilemaps.TilemapLayer): void {
    const layer = map.getObjectLayer('Objekte');
    if (!layer) return;
    const group = this.physics.add.group({ immovable: true });
    for (const o of layer.objects) {
      if (o.type !== 'route' || !o.polygon) continue;
      const props = Object.fromEntries((o.properties ?? []).map((p: { name: string; value: unknown }) => [p.name, p.value]));
      const points = o.polygon.map((p) => new Phaser.Math.Vector2((o.x ?? 0) + p.x, (o.y ?? 0) + p.y));
      const sprite = group.create(points[0].x, points[0].y, String(props.sprite ?? 'civil-car-a-top')) as Phaser.Physics.Arcade.Image;
      sprite.setDepth(9).setCircle(5, sprite.width / 2 - 5, sprite.height / 2 - 5);
      this.cars.push({ sprite, points, next: 1, speed: Number(props.speed ?? 40), factor: 1 });
    }
    this.physics.add.collider(this.player, group, () => this.onCarHit());
    this.physics.add.collider(group, buildings);
  }

  private onWallHit(): void {
    if (Math.abs(this.speed) > 50) this.crash(Math.abs(this.speed) / 40);
    this.speed *= -0.25;
  }

  private onCarHit(): void {
    if (Math.abs(this.speed) > 25) this.crash(2 + Math.abs(this.speed) / 40);
    this.speed *= 0.2;
  }

  private crash(damage: number): void {
    const now = this.time.now;
    if (now - this.lastCrashAt < 600) return;
    this.lastCrashAt = now;
    damageVehicle(Math.round(damage * this.vehicleDef.drive.mass));
    Sound.play('crash');
    this.cameras.main.shake(120, 0.004);
    this.toast('Blechschaden.', 900);
  }

  update(_time: number, deltaMs: number): void {
    if (this.arriving) return;
    const dt = deltaMs / 1000;
    const s = state();
    if (s.progress && !s.progress.completed) tickMission(deltaMs);

    this.updatePlayer(dt);
    this.updateCars(dt);
    this.updateHud();
    this.checkClosureHint();
    this.checkArrival();
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
    this.player.setAngle(this.heading);
    this.player.setVelocity(Math.cos(rad) * this.speed, Math.sin(rad) * this.speed);

    this.sirenLight.setPosition(this.player.x, this.player.y);
    this.sirenLight.setVisible(this.sirenOn && Math.floor(this.time.now / 120) % 2 === 0);

    // Kompasspfeil zum Ziel
    const tx = this.target.rect.centerX;
    const ty = this.target.rect.centerY;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tx, ty);
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, tx, ty);
    this.arrow.setVisible(dist > 70);
    this.arrow.setPosition(this.player.x + Math.cos(ang) * 22, this.player.y + Math.sin(ang) * 22);
    this.arrow.setRotation(ang);
  }

  private updateCars(dt: number): void {
    for (const car of this.cars) {
      const sp = car.sprite;
      const target = car.points[car.next];
      const toTarget = new Phaser.Math.Vector2(target.x - sp.x, target.y - sp.y);
      const dist = toTarget.length();
      if (dist < 3) {
        car.next = (car.next + 1) % car.points.length;
        continue;
      }
      const dir = toTarget.normalize();
      // Ausweichen: bei Sondersignal in Reichweite anhalten; ohne Sondersignal nur, wenn der Spieler direkt vor dem Auto steht.
      const dPlayer = Phaser.Math.Distance.Between(sp.x, sp.y, this.player.x, this.player.y);
      const ahead = dir.dot(new Phaser.Math.Vector2(this.player.x - sp.x, this.player.y - sp.y)) > 0;
      const shouldStop = (this.sirenOn && dPlayer < SIREN_RANGE) || (ahead && dPlayer < 26);
      car.factor = Phaser.Math.Linear(car.factor, shouldStop ? 0 : 1, Math.min(1, dt * 4));
      sp.setRotation(Math.atan2(dir.y, dir.x));
      sp.setVelocity(dir.x * car.speed * car.factor, dir.y * car.speed * car.factor);
    }
  }

  private updateHud(): void {
    const s = state();
    const v = s.vehicles[this.vehicleDef.id];
    const left = `${this.vehicleDef.name}  ${Math.round(Math.abs(this.speed))} km/h${v.fueled ? '' : '  RESERVE'}`;
    const center = this.sirenOn ? 'SONDERSIGNAL' : '';
    const right = s.progress && !s.progress.completed ? `Zeit ${formatTime(s.progress.elapsedMs)}` : `Zustand ${v.condition}%`;
    this.ui()?.hud.set(left, center, right);
  }

  private checkClosureHint(): void {
    if (this.closureHintShown) return;
    const closure = this.zones.find((z) => z.kind === 'closure');
    if (!closure) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, closure.rect.centerX, closure.rect.centerY) < 56) {
      this.closureHintShown = true;
      this.toast('Baustelle. Hier geht es nicht weiter, Umweg über die Umgehungsstraße.', 2500);
    }
  }

  private checkArrival(): void {
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
