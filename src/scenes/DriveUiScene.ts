import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, SCENES } from '../config/game';
import type { DriveInput } from '../systems/Input';
import { Dialog, FONT } from '../systems/Dialog';
import { Hud } from '../systems/ui';
import type { CityMap } from '../systems/MapRenderer';
import type { DriveScene } from './DriveScene';

export interface DriveUiData {
  input: DriveInput;
  drive: DriveScene;
}

const MINI = 220;
const BIG = 660;

/**
 * Overlay über dem Fahrmodus: HUD, Hinweise, Touch-Tasten und die Übersichtskarte
 * (klein unten rechts, mit M groß in der Mitte).
 */
export class DriveUiScene extends Phaser.Scene {
  hud!: Hud;
  private dialog!: Dialog;
  private drive!: DriveScene;
  private map!: CityMap;
  private overview!: Phaser.GameObjects.Image;
  private frame!: Phaser.GameObjects.Rectangle;
  private dots!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.BitmapText;
  private big = false;

  constructor() {
    super(SCENES.driveUi);
  }

  create(data: DriveUiData): void {
    this.drive = data.drive;
    this.map = this.cache.json.get('city') as CityMap;
    this.hud = new Hud(this);
    this.dialog = new Dialog(this);
    data.input.attachTouchButtons(this);

    this.frame = this.add.rectangle(0, 0, MINI + 8, MINI + 8, PALETTE.black, 0.8).setOrigin(0).setDepth(850).setStrokeStyle(2, PALETTE.grayLight);
    this.overview = this.add.image(0, 0, 'city-overview').setOrigin(0).setDepth(851);
    this.dots = this.add.graphics().setDepth(852);
    this.label = this.add.bitmapText(0, 0, FONT, 'M: Karte').setDepth(853).setTint(PALETTE.grayLight);
    this.layout();

    this.input.keyboard?.on('keydown-M', () => { this.big = !this.big; this.layout(); });
    this.input.keyboard?.on('keydown-F', () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); });
    this.frame.setInteractive().on('pointerdown', () => { this.big = !this.big; this.layout(); });
  }

  private layout(): void {
    const size = this.big ? BIG : MINI;
    const x = this.big ? (GAME_WIDTH - size) / 2 : GAME_WIDTH - size - 16;
    const y = this.big ? (GAME_HEIGHT - size) / 2 : GAME_HEIGHT - size - 16;
    this.frame.setPosition(x - 4, y - 4).setSize(size + 8, size + 8);
    this.overview.setPosition(x, y).setDisplaySize(size, size);
    this.label.setPosition(x, this.big ? y + size + 8 : y - 24).setText(this.big ? 'M: Karte schließen   F: Vollbild' : 'M: Karte');
  }

  toast(text: string, ms?: number): void {
    this.dialog?.toast(text, ms);
  }

  update(): void {
    if (!this.drive.scene.isActive()) return;
    const info = this.drive.overviewInfo();
    const size = this.big ? BIG : MINI;
    const sx = size / this.map.width;
    const sy = size / this.map.height;
    const ox = this.overview.x;
    const oy = this.overview.y;
    const g = this.dots;
    g.clear();
    // Unterkunft: blaues Quadrat, Ziel: gelb blinkend, Spieler: weißer Pfeil
    g.fillStyle(PALETTE.thwBlueLight, 1);
    g.fillRect(ox + info.depot.x * sx - 4, oy + info.depot.y * sy - 4, 8, 8);
    if (!this.drive.isFreeDrive() && Math.floor(this.time.now / 400) % 2 === 0) {
      g.fillStyle(PALETTE.yellow, 1);
      g.fillCircle(ox + info.target.x * sx, oy + info.target.y * sy, this.big ? 8 : 5);
    }
    const px = ox + info.player.x * sx;
    const py = oy + info.player.y * sy;
    const rad = (info.heading * Math.PI) / 180;
    const r = this.big ? 9 : 6;
    g.fillStyle(PALETTE.white, 1);
    g.fillTriangle(
      px + Math.cos(rad) * r, py + Math.sin(rad) * r,
      px + Math.cos(rad + 2.5) * r, py + Math.sin(rad + 2.5) * r,
      px + Math.cos(rad - 2.5) * r, py + Math.sin(rad - 2.5) * r,
    );
  }
}
