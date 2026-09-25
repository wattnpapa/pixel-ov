import Phaser from 'phaser';
import { SCENES } from '../config/game';
import { runFinished, state } from './GameState';

/**
 * Springt anhand des gespeicherten Spielzustands in die passende Szene.
 * Wird nach dem Laden eines Spielstands und nach dem Endbildschirm benutzt.
 */
export function continueFromState(scene: Phaser.Scene): void {
  const s = state();
  if (runFinished() && s.phase === 'hall' && !s.progress) {
    scene.scene.start(SCENES.summary);
    return;
  }
  switch (s.phase) {
    case 'driving-out':
      scene.scene.start(SCENES.drive, { mode: 'out' });
      break;
    case 'on-site':
      scene.scene.start(SCENES.side);
      break;
    case 'driving-back':
      scene.scene.start(SCENES.drive, { mode: 'back' });
      break;
    default:
      scene.scene.start(SCENES.hall);
  }
}
