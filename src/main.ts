import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE_HEX } from './config/game';
import { BootScene } from './scenes/BootScene';
import { HallScene } from './scenes/HallScene';
import { DriveScene } from './scenes/DriveScene';
import { DriveUiScene } from './scenes/DriveUiScene';
import { SideScene } from './scenes/SideScene';
import { GameOverScene } from './scenes/GameOverScene';
import { SummaryScene } from './scenes/SummaryScene';

/** Größter ganzzahliger Zoom, der ins Fenster passt (mindestens 1). */
function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT)));
}

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
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: integerZoom(),
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, HallScene, DriveScene, DriveUiScene, SideScene, GameOverScene, SummaryScene],
});

window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));

// Im Dev-Modus für Tests und Debugging erreichbar.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
