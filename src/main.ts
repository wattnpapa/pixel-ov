import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE_HEX } from './config/game';
import { BootScene } from './scenes/BootScene';
import { HallScene } from './scenes/HallScene';
import { DriveScene } from './scenes/DriveScene';
import { DriveUiScene } from './scenes/DriveUiScene';
import { SideScene } from './scenes/SideScene';
import { GameOverScene } from './scenes/GameOverScene';
import { SummaryScene } from './scenes/SummaryScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: PALETTE_HEX.black,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    // Füllt das Fenster bei festem 16:9-Seitenverhältnis; auf Handys wird verkleinert.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, HallScene, DriveScene, DriveUiScene, SideScene, GameOverScene, SummaryScene],
});

window.addEventListener('orientationchange', () => setTimeout(() => game.scale.refresh(), 100));

// Im Dev-Modus für Tests und Debugging erreichbar.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
