import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game';
import { FONT } from '../systems/Dialog';
import { onceAnyPointer } from '../systems/Input';
import { completeMission, state } from '../systems/GameState';

/** Platzhalter: Einsatzstelle. Klick beendet den Einsatz und startet die Rückfahrt. */
export class SideScene extends Phaser.Scene {
  constructor() {
    super(SCENES.side);
  }

  create(): void {
    const bg = state().progress?.missionId === 'water-basement' ? 'water-basement-bg' : 'storm-tree-bg';
    this.add.image(0, 0, bg).setOrigin(0);
    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2, FONT, 'Einsatzstelle (Platzhalter)\nKlick: Einsatz beenden, Rückfahrt').setOrigin(0.5).setCenterAlign();
    onceAnyPointer(this, () => {
      const p = state().progress;
      if (p && !p.completed) {
        completeMission({ title: p.missionId, elapsedMs: p.elapsedMs, procedureErrors: 0, optionalDone: 0, optionalTotal: 0, reinforcement: false, gameOvers: 0, rating: 'Platzhalter' });
      }
      this.scene.start(SCENES.drive, { mode: 'back' });
    });
  }
}
