import Phaser from 'phaser';
import { PALETTE, SCENES } from '../config/game';
import { fullscreenText } from '../systems/ui';
import { onceAnyPointer } from '../systems/Input';
import { restartMissionOnSite } from '../systems/GameState';
import { Sound } from '../systems/Sound';

export interface GameOverData {
  reason: string;
}

/** Game Over nach Sicherheitsverstoß. Der Einsatz beginnt an der Einsatzstelle neu. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.gameOver);
  }

  create(data: GameOverData): void {
    Sound.play('game-over');
    fullscreenText(this, 'GAME OVER', data.reason, 'Drücke um neu zu starten', PALETTE.red);
    this.time.delayedCall(600, () => {
      onceAnyPointer(this, () => {
        restartMissionOnSite();
        this.scene.start(SCENES.side);
      });
    });
  }
}
