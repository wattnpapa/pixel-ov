import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game';
import { FONT } from '../systems/Dialog';
import { onceAnyPointer } from '../systems/Input';

/** Platzhalter: Einsatzstelle. Klick startet die Rückfahrt. */
export class SideScene extends Phaser.Scene {
  constructor() {
    super(SCENES.side);
  }

  create(): void {
    this.add.image(0, 0, 'storm-tree-bg').setOrigin(0);
    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2, FONT, 'Einsatzstelle (Platzhalter)\nKlick: Rückfahrt').setOrigin(0.5).setCenterAlign();
    onceAnyPointer(this, () => this.scene.start(SCENES.drive, { mode: 'back' }));
  }
}
