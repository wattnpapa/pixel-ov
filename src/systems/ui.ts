import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../config/game';
import { FONT } from './Dialog';

/** Kleine Statuszeile oben (schwarzer Balken), z. B. für Timer und Fahrzeugname. */
export class Hud {
  private left: Phaser.GameObjects.BitmapText;
  private right: Phaser.GameObjects.BitmapText;
  private center: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene) {
    scene.add.rectangle(0, 0, GAME_WIDTH, 44, PALETTE.black, 0.85).setOrigin(0).setScrollFactor(0).setDepth(800);
    this.left = scene.add.bitmapText(12, 8, FONT, '').setScrollFactor(0).setDepth(801);
    this.center = scene.add.bitmapText(GAME_WIDTH / 2, 8, FONT, '').setOrigin(0.5, 0).setScrollFactor(0).setDepth(801).setTint(PALETTE.yellow);
    this.right = scene.add.bitmapText(GAME_WIDTH - 12, 8, FONT, '').setOrigin(1, 0).setScrollFactor(0).setDepth(801);
  }

  set(left: string, center = '', right = ''): void {
    this.left.setText(left);
    this.center.setText(center);
    this.right.setText(right);
  }
}

/** Vollbild-Textscreen (Titel, Game Over, Zusammenfassung). */
export function fullscreenText(scene: Phaser.Scene, title: string, body: string, footer: string, titleTint = PALETTE.yellow): void {
  scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, PALETTE.black).setOrigin(0);
  scene.add.bitmapText(GAME_WIDTH / 2, 72, FONT, title).setOrigin(0.5, 0).setTint(titleTint).setScale(2);
  scene.add.bitmapText(GAME_WIDTH / 2, 192, FONT, body).setOrigin(0.5, 0).setMaxWidth(GAME_WIDTH - 128).setCenterAlign();
  const f = scene.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 64, FONT, footer).setOrigin(0.5, 0).setTint(PALETTE.grayLight);
  scene.tweens.add({ targets: f, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
}

/** Fortschrittsbalken über einer Figur während einer Aktion. */
export class ProgressBar {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, x: number, y: number, private w = 160) {
    this.bg = scene.add.rectangle(x, y, w, 20, PALETTE.dark).setOrigin(0.5, 0).setDepth(700).setStrokeStyle(4, PALETTE.white);
    this.fill = scene.add.rectangle(x - w / 2 + 4, y + 4, 0, 12, PALETTE.yellow).setOrigin(0).setDepth(701);
    this.label = scene.add.bitmapText(x, y - 40, FONT, '').setOrigin(0.5, 0).setDepth(701);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.bg.setVisible(v);
    this.fill.setVisible(v);
    this.label.setVisible(v);
  }

  setPosition(x: number, y: number): void {
    this.bg.setPosition(x, y);
    this.fill.setPosition(x - this.w / 2 + 4, y + 4);
    this.label.setPosition(x, y - 40);
  }

  setLabel(t: string): void {
    this.label.setText(t);
  }

  setProgress(p: number): void {
    this.fill.width = Math.max(0, Math.min(1, p)) * (this.w - 8);
  }
}
