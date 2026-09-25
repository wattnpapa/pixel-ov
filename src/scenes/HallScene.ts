import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/game';
import { FONT } from '../systems/Dialog';
import { onceAnyPointer } from '../systems/Input';
import { acceptAlarm, chooseVehicle, nextAlarm, state } from '../systems/GameState';
import { continueFromState } from '../systems/flow';

/** Platzhalter: Fahrzeughalle. Klick nimmt den Alarm an und rückt mit dem GKW aus. */
export class HallScene extends Phaser.Scene {
  constructor() {
    super(SCENES.hall);
  }

  create(): void {
    if (state().phase !== 'hall') {
      continueFromState(this);
      return;
    }
    this.add.image(0, 0, 'hall-bg').setOrigin(0);
    const alarm = nextAlarm();
    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2, FONT, `Fahrzeughalle (Platzhalter)\nAlarm: ${alarm?.kind ?? 'keiner'}\nKlick: mit GKW ausrücken`).setOrigin(0.5).setCenterAlign();
    onceAnyPointer(this, () => {
      if (!state().progress) acceptAlarm();
      chooseVehicle('gkw');
      this.scene.start(SCENES.drive, { mode: 'out' });
    });
  }
}
