import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game';
import { FONT } from '../systems/Dialog';
import { onceAnyPointer } from '../systems/Input';

/** Platzhalter: Fahrzeughalle. Klick wechselt in den Fahrmodus. */
export class HallScene extends Phaser.Scene {
  constructor() {
    super(SCENES.hall);
  }

  create(): void {
    this.add.image(0, 0, 'hall-bg').setOrigin(0);
    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2, FONT, 'Fahrzeughalle (Platzhalter)\nKlick: Ausrücken').setOrigin(0.5).setCenterAlign();
    onceAnyPointer(this, () => this.scene.start(SCENES.drive, { mode: 'out' }));
  }
}
