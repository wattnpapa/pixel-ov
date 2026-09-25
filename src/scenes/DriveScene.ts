import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game';
import { FONT } from '../systems/Dialog';
import { onceAnyPointer } from '../systems/Input';

export interface DriveSceneData {
  mode: 'out' | 'back';
}

/** Platzhalter: Fahrmodus. Klick wechselt in die Einsatz- bzw. Hallenszene. */
export class DriveScene extends Phaser.Scene {
  constructor() {
    super(SCENES.drive);
  }

  create(data: DriveSceneData): void {
    const map = this.make.tilemap({ key: 'city' });
    const tiles = map.addTilesetImage('city-tileset', 'city-tileset');
    if (tiles) {
      map.createLayer('Boden', tiles, 0, 0);
      map.createLayer('Markierung', tiles, 0, 0);
      map.createLayer('Gebaeude', tiles, 0, 0);
    }
    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2, FONT, `Fahrmodus (Platzhalter, ${data.mode})\nKlick: weiter`).setOrigin(0.5).setCenterAlign().setScrollFactor(0);
    onceAnyPointer(this, () => this.scene.start(data.mode === 'out' ? SCENES.side : SCENES.hall));
  }
}
