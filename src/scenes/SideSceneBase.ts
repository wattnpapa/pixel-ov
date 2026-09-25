import Phaser from 'phaser';
import { GAME_WIDTH, PALETTE } from '../config/game';
import type { HotspotDef } from '../config/missions/types';
import { Dialog, FONT } from '../systems/Dialog';
import { Hud, ProgressBar } from '../systems/ui';
import { Sound } from '../systems/Sound';

const WALK_SPEED = 60; // px/s

/**
 * Gemeinsame Basis für Seitenansicht-Szenen (Halle, Einsatzstelle):
 * Hintergrund, Hotspots mit Hover-Label, laufender Helfer, Dialog, Fortschrittsbalken.
 */
export abstract class SideSceneBase extends Phaser.Scene {
  protected dialog!: Dialog;
  protected hud!: Hud;
  protected helper!: Phaser.GameObjects.Sprite;
  protected bar!: ProgressBar;
  protected groundY = 150;
  /** Während einer Aktion sind Hotspots gesperrt. */
  protected busy = false;
  private hoverLabel!: Phaser.GameObjects.BitmapText;
  private hoverBg!: Phaser.GameObjects.Rectangle;

  protected setupSide(bgKey: string, groundY: number, helperX: number): void {
    this.busy = false;
    this.groundY = groundY;
    this.add.image(0, 0, bgKey).setOrigin(0).setDepth(0);
    this.helper = this.add.sprite(helperX, groundY, 'helper', 0).setOrigin(0.5, 1).setDepth(50);
    this.helper.play('helper-idle');
    this.bar = new ProgressBar(this, helperX, groundY - 34);
    this.hoverBg = this.add.rectangle(0, 0, 10, 11, PALETTE.black, 0.8).setOrigin(0, 1).setDepth(600).setVisible(false);
    this.hoverLabel = this.add.bitmapText(0, 0, FONT, '').setOrigin(0, 1).setDepth(601).setTint(PALETTE.yellow).setVisible(false);
    this.dialog = new Dialog(this);
    this.hud = new Hud(this);
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  protected addHotspot(def: HotspotDef, onClick: (def: HotspotDef) => void): Phaser.GameObjects.Rectangle {
    const zone = this.add
      .rectangle(def.x, def.y, def.w, def.h, PALETTE.white, 0)
      .setOrigin(0)
      .setDepth(40)
      .setStrokeStyle(1, PALETTE.yellow, 0.25)
      .setInteractive({ useHandCursor: true });
    zone.setData('def', def);
    zone.on('pointerover', () => {
      zone.setStrokeStyle(1, PALETTE.yellow, 0.9);
      this.showHover(def);
    });
    zone.on('pointerout', () => {
      zone.setStrokeStyle(1, PALETTE.yellow, 0.25);
      this.hideHover();
    });
    zone.on('pointerdown', () => {
      if (this.busy || this.dialog.isOpen()) return;
      this.hideHover();
      onClick(def);
    });
    return zone;
  }

  private showHover(def: HotspotDef): void {
    const label = this.currentLabelFor(def);
    this.hoverLabel.setText(label).setVisible(true);
    const w = this.hoverLabel.width + 6;
    let x = def.x;
    if (x + w > GAME_WIDTH - 2) x = GAME_WIDTH - 2 - w;
    const y = Math.max(22, def.y - 2);
    this.hoverBg.setPosition(x, y).setSize(w, 11).setVisible(true);
    this.hoverLabel.setPosition(x + 3, y - 1);
  }

  private hideHover(): void {
    this.hoverLabel.setVisible(false);
    this.hoverBg.setVisible(false);
  }

  /** Kann von Unterklassen überschrieben werden, um dynamische Labels zu zeigen. */
  protected currentLabelFor(def: HotspotDef): string {
    return def.label;
  }

  /** Helfer läuft auf der Bodenlinie zu x. */
  protected walkTo(x: number): Promise<void> {
    return new Promise((resolve) => {
      const dist = Math.abs(this.helper.x - x);
      if (dist < 2) return resolve();
      this.helper.setFlipX(x < this.helper.x);
      this.helper.play('helper-walk');
      this.tweens.add({
        targets: this.helper,
        x,
        duration: (dist / WALK_SPEED) * 1000,
        onComplete: () => {
          this.helper.play('helper-idle');
          resolve();
        },
      });
    });
  }

  /** Aktion mit Fortschrittsbalken über dem Helfer. onProgress bekommt 0..1. */
  protected doAction(label: string, ms: number, onProgress?: (p: number) => void): Promise<void> {
    return new Promise((resolve) => {
      this.bar.setPosition(this.helper.x, this.groundY - 34);
      this.bar.setLabel(label);
      this.bar.setProgress(0);
      this.bar.setVisible(true);
      const counter = { p: 0 };
      this.tweens.add({
        targets: counter,
        p: 1,
        duration: ms,
        onUpdate: () => {
          this.bar.setProgress(counter.p);
          onProgress?.(counter.p);
        },
        onComplete: () => {
          this.bar.setVisible(false);
          Sound.play('task-done');
          resolve();
        },
      });
    });
  }

  protected fadeTo(cb: () => void): void {
    this.busy = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, cb);
  }
}
