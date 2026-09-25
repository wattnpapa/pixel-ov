import paletteJson from './palette.json';

/** Interne Auflösung der Szenen. Wird per Integer-Skalierung auf das Fenster gebracht. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;
export const TILE_SIZE = 32;

/** Feste Farbpalette (siehe palette.json). Als Zahl für Phaser-Graphics. */
export const PALETTE = Object.fromEntries(
  Object.entries(paletteJson).map(([k, v]) => [k, parseInt(v.slice(1, 7), 16)]),
) as Record<keyof typeof paletteJson, number>;

/** Dieselbe Palette als CSS-Hex-Strings, z. B. für Tint per Name in Daten. */
export const PALETTE_HEX = paletteJson as Record<keyof typeof paletteJson, string>;
export type PaletteColor = keyof typeof paletteJson;

/** Anzahl Einsätze pro Durchgang, danach kommt der Endbildschirm. */
export const MISSIONS_PER_RUN = 3;

/** Schlüssel im localStorage. */
export const SAVE_KEY = 'einsatzbereit.save.v1';

export const SCENES = {
  boot: 'BootScene',
  hall: 'HallScene',
  drive: 'DriveScene',
  driveUi: 'DriveUiScene',
  side: 'SideScene',
  gameOver: 'GameOverScene',
  summary: 'SummaryScene',
} as const;
