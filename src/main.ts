import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE_HEX } from './config/game';
import { BootScene } from './scenes/BootScene';
import { HallScene } from './scenes/HallScene';
import { DriveScene } from './scenes/DriveScene';
import { DriveUiScene } from './scenes/DriveUiScene';
import { SideScene } from './scenes/SideScene';
import { GameOverScene } from './scenes/GameOverScene';
import { SummaryScene } from './scenes/SummaryScene';

/**
 * Größter ganzzahliger Zoom, der ins Fenster passt. Auf kleinen Bildschirmen
 * (Handy) ist das weniger als 1: dann wird passend verkleinert, sonst ist
 * die 640x360-Fläche größer als der Bildschirm.
 */
function fittingZoom(): number {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const raw = Math.min(vw / GAME_WIDTH, vh / GAME_HEIGHT);
  return raw >= 1 ? Math.floor(raw) : Math.max(0.25, raw);
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
    zoom: fittingZoom(),
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 3 },
  scene: [BootScene, HallScene, DriveScene, DriveUiScene, SideScene, GameOverScene, SummaryScene],
});

const applyZoom = () => game.scale.setZoom(fittingZoom());
window.addEventListener('resize', applyZoom);
window.addEventListener('orientationchange', () => setTimeout(applyZoom, 100));
window.visualViewport?.addEventListener('resize', applyZoom);

// Im Dev-Modus für Tests und Debugging erreichbar.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
