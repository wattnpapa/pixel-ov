// Erzeugt Platzhalter-Grafiken in assets/. Jede Datei kann später durch eine
// gepixelte Version gleicher Größe ersetzt werden, ohne den Code anzufassen.
//   node tools/gen-assets.mjs
import fs from 'node:fs';
import { Canvas } from './png.mjs';
import { GLYPHS, GLYPH_W, GLYPH_H, CHARS, CHARS_PER_ROW } from './font-glyphs.mjs';
import { TILES } from './tiles.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../src/config/palette.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- Schrift
{
  const rows = Math.ceil(CHARS.length / CHARS_PER_ROW);
  const c = new Canvas(CHARS_PER_ROW * (GLYPH_W + 1), rows * (GLYPH_H + 1));
  [...CHARS].forEach((ch, i) => {
    const gx = (i % CHARS_PER_ROW) * (GLYPH_W + 1);
    const gy = Math.floor(i / CHARS_PER_ROW) * (GLYPH_H + 1);
    c.pattern(gx, gy, GLYPHS[ch], { '#': P.white });
  });
  c.save('assets/fonts/pixel-5x7.png');
  fs.writeFileSync(
    'assets/fonts/pixel-5x7.json',
    JSON.stringify({ image: 'fonts/pixel-5x7.png', width: GLYPH_W, height: GLYPH_H, chars: CHARS, charsPerRow: CHARS_PER_ROW, spacingX: 1, spacingY: 1 }, null, 2),
  );
}

// ---------------------------------------------------------------- Tileset (16x16)

const TILE = 16;
{
  const cols = 8;
  const rows = Math.ceil(TILES.length / cols);
  const c = new Canvas(cols * TILE, rows * TILE);
  const draw = {
    grass: (x, y) => { c.rect(x, y, 16, 16, P.olive); c.noise(x, y, 16, 16, P.oliveLight, 0.12, 3); },
    'grass-alt': (x, y) => { c.rect(x, y, 16, 16, P.olive); c.noise(x, y, 16, 16, P.oliveDark, 0.15, 7); },
    road: (x, y) => { c.rect(x, y, 16, 16, P.asphalt); c.noise(x, y, 16, 16, P.asphaltLight, 0.06, 11); },
    'road-line-h': (x, y) => { draw.road(x, y); c.rect(x + 2, y + 7, 8, 2, P.concreteLight); },
    'road-line-v': (x, y) => { draw.road(x, y); c.rect(x + 7, y + 2, 2, 8, P.concreteLight); },
    'road-edge-h': (x, y) => { draw.road(x, y); c.rect(x, y, 16, 1, P.concrete); },
    'road-edge-v': (x, y) => { draw.road(x, y); c.rect(x, y, 1, 16, P.concrete); },
    sidewalk: (x, y) => { c.rect(x, y, 16, 16, P.concrete); c.outline(x, y, 16, 16, P.concreteLight); c.rect(x + 8, y, 1, 16, P.concreteLight); c.rect(x, y + 8, 16, 1, P.concreteLight); },
    'wall-a': (x, y) => { c.rect(x, y, 16, 16, P.brown); for (let r = 0; r < 4; r++) c.rect(x + (r % 2) * 4, y + r * 4 + 3, 16, 1, P.brownDark); c.rect(x + 5, y + 5, 6, 6, P.skyLight); },
    'wall-b': (x, y) => { c.rect(x, y, 16, 16, P.tan); c.rect(x + 3, y + 3, 4, 6, P.sky); c.rect(x + 9, y + 3, 4, 6, P.sky); c.rect(x, y + 15, 16, 1, P.brownDark); },
    roof: (x, y) => { c.rect(x, y, 16, 16, P.grayDark); c.noise(x, y, 16, 16, P.gray, 0.2, 5); c.outline(x, y, 16, 16, P.dark); },
    'roof-blue': (x, y) => { c.rect(x, y, 16, 16, P.thwBlueDark); c.noise(x, y, 16, 16, P.thwBlue, 0.2, 9); c.outline(x, y, 16, 16, P.dark); },
    'roof-red': (x, y) => { c.rect(x, y, 16, 16, P.redDark); c.noise(x, y, 16, 16, P.red, 0.2, 13); c.outline(x, y, 16, 16, P.dark); },
    fence: (x, y) => { draw.grass(x, y); c.rect(x, y + 6, 16, 2, P.brownLight); c.rect(x, y + 11, 16, 2, P.brownLight); for (let i = 1; i < 16; i += 5) c.rect(x + i, y + 3, 2, 12, P.brown); },
    tree: (x, y) => { draw.grass(x, y); c.rect(x + 3, y + 2, 10, 10, P.green); c.rect(x + 5, y + 4, 6, 6, P.greenLight); c.rect(x + 7, y + 11, 2, 4, P.brownDark); },
    water: (x, y) => { c.rect(x, y, 16, 16, P.water); c.noise(x, y, 16, 16, P.waterLight, 0.15, 17); },
    construction: (x, y) => { draw.road(x, y); for (let i = 0; i < 16; i += 4) { c.rect(x + i, y + 4, 2, 8, P.red); c.rect(x + i + 2, y + 4, 2, 8, P.white); } c.rect(x, y + 3, 16, 1, P.dark); c.rect(x, y + 12, 16, 1, P.dark); },
    'depot-floor': (x, y) => { c.rect(x, y, 16, 16, P.grayLight); c.noise(x, y, 16, 16, P.concreteLight, 0.1, 19); },
    'depot-wall': (x, y) => { c.rect(x, y, 16, 16, P.thwBlue); c.outline(x, y, 16, 16, P.thwBlueDark); c.rect(x + 2, y + 6, 12, 4, P.yellow); },
    field: (x, y) => { c.rect(x, y, 16, 16, P.brownLight); for (let i = 0; i < 16; i += 4) c.rect(x, y + i, 16, 1, P.brown); },
    flower: (x, y) => { draw.grass(x, y); c.set(x + 3, y + 4, P.pink); c.set(x + 10, y + 9, P.yellow); c.set(x + 6, y + 12, P.pink); c.set(x + 12, y + 3, P.white); },
    gravel: (x, y) => { c.rect(x, y, 16, 16, P.concrete); c.noise(x, y, 16, 16, P.gray, 0.3, 23); },
    marker: (x, y) => { c.rect(x + 2, y + 2, 12, 12, P.yellow); c.outline(x + 2, y + 2, 12, 12, P.dark); c.rect(x + 7, y + 4, 2, 5, P.dark); c.rect(x + 7, y + 10, 2, 2, P.dark); },
    empty: () => {},
  };
  TILES.forEach((name, i) => draw[name]((i % cols) * TILE, Math.floor(i / cols) * TILE));
  c.save('assets/tiles/city-tileset.png');
}

// ---------------------------------------------------------------- Top-down-Fahrzeuge (Blickrichtung: rechts / +x)
function topdownVehicle(file, w, h, body, roofColor, opts = {}) {
  const c = new Canvas(w, h);
  c.rect(1, 1, w - 2, h - 2, body);
  c.outline(1, 1, w - 2, h - 2, P.dark);
  // Fahrerkabine vorne (rechts)
  c.rect(w - 8, 3, 4, h - 6, roofColor);
  // Windschutzscheibe
  c.rect(w - 4, 3, 2, h - 6, P.skyLight);
  // Scheinwerfer / Rücklichter
  c.set(w - 2, 2, P.yellow); c.set(w - 2, h - 3, P.yellow);
  c.set(1, 2, P.red); c.set(1, h - 3, P.red);
  if (opts.stripe) c.rect(3, Math.floor(h / 2) - 1, w - 12, 2, opts.stripe);
  if (opts.lightbar) { c.rect(w - 11, Math.floor(h / 2) - 1, 2, 2, P.thwBlueLight); }
  c.save(file);
}
topdownVehicle('assets/sprites/vehicle-mtw-top.png', 20, 10, P.thwBlue, P.thwBlueDark, { stripe: P.yellow, lightbar: true });
topdownVehicle('assets/sprites/vehicle-gkw-top.png', 28, 12, P.thwBlue, P.thwBlueDark, { stripe: P.yellow, lightbar: true });
topdownVehicle('assets/sprites/civil-car-a-top.png', 18, 9, P.red, P.redDark);
topdownVehicle('assets/sprites/civil-car-b-top.png', 18, 9, P.concreteLight, P.gray);
topdownVehicle('assets/sprites/civil-car-c-top.png', 18, 9, P.green, P.oliveDark);

// ---------------------------------------------------------------- Seitenansicht-Fahrzeuge (Front links)
function sideVehicle(file, w, h, cabW) {
  const c = new Canvas(w, h);
  const bodyTop = 4;
  const bodyH = h - 10;
  c.rect(cabW, bodyTop, w - cabW - 1, bodyH, P.thwBlue);
  c.outline(cabW, bodyTop, w - cabW - 1, bodyH, P.thwBlueDark);
  c.rect(1, bodyTop + 4, cabW, bodyH - 4, P.thwBlue);
  c.outline(1, bodyTop + 4, cabW, bodyH - 4, P.thwBlueDark);
  c.rect(3, bodyTop + 6, cabW - 5, 8, P.skyLight);
  c.rect(cabW + 2, bodyTop + bodyH - 6, w - cabW - 5, 3, P.yellow);
  c.rect(1 + Math.floor(cabW / 2), bodyTop, 6, 3, P.thwBlueLight);
  // Räder
  const wheel = (x) => { c.rect(x, h - 8, 10, 8, P.dark); c.rect(x + 3, h - 5, 4, 3, P.gray); };
  wheel(4); wheel(w - 16);
  // Tür-Markierung
  c.rect(cabW - 2, bodyTop + 5, 1, bodyH - 8, P.thwBlueDark);
  c.save(file);
}
sideVehicle('assets/sprites/vehicle-mtw-side.png', 64, 36, 18);
sideVehicle('assets/sprites/vehicle-gkw-side.png', 96, 48, 22);

// ---------------------------------------------------------------- Helfer (Seitenansicht, 12x24, 2 Frames: stehen / gehen)
{
  const c = new Canvas(24, 24);
  const frame = (ox, legOffset) => {
    c.rect(ox + 3, 1, 6, 4, P.white); // Helm
    c.rect(ox + 4, 5, 4, 3, P.skin); // Gesicht
    c.rect(ox + 2, 8, 8, 9, P.thwBlue); // Jacke
    c.rect(ox + 2, 11, 8, 2, P.yellow); // Reflexstreifen
    c.rect(ox + 3 - legOffset, 17, 3, 7, P.thwBlueDark);
    c.rect(ox + 6 + legOffset, 17, 3, 7, P.thwBlueDark);
    c.rect(ox + 2 - legOffset, 23, 4, 1, P.dark);
    c.rect(ox + 6 + legOffset, 23, 4, 1, P.dark);
  };
  frame(0, 0);
  frame(12, 1);
  c.save('assets/sprites/helper.png');
}

// ---------------------------------------------------------------- Szenen-Hintergründe (320x180)
function sceneCanvas() {
  return new Canvas(320, 180, P.sky);
}
// Fahrzeughalle: Innenraum
{
  const c = sceneCanvas();
  c.rect(0, 0, 320, 180, P.concreteLight); // Rückwand
  c.rect(0, 0, 320, 24, P.grayLight); // Deckenstreifen
  for (let x = 20; x < 320; x += 60) c.rect(x, 4, 24, 4, P.white); // Leuchten
  c.rect(0, 24, 320, 3, P.thwBlue); // Blaue Bordüre
  c.rect(0, 150, 320, 30, P.gray); // Hallenboden
  c.rect(0, 150, 320, 2, P.grayDark);
  c.rect(60, 152, 90, 26, P.grayDark); // Stellplatz MTW
  c.rect(160, 152, 110, 26, P.grayDark); // Stellplatz GKW
  c.rect(60, 152, 90, 1, P.yellow); c.rect(160, 152, 110, 1, P.yellow);
  // Tor rechts
  c.rect(276, 40, 44, 110, P.grayLight);
  for (let y = 44; y < 150; y += 8) c.rect(278, y, 40, 2, P.gray);
  c.outline(276, 40, 44, 110, P.dark);
  // Alarmmonitor Rahmen
  c.rect(8, 40, 44, 34, P.dark);
  c.rect(10, 42, 40, 30, P.black);
  c.rect(26, 74, 8, 6, P.dark);
  // Werkbank
  c.rect(6, 118, 50, 6, P.brownLight);
  c.rect(8, 124, 4, 26, P.brown); c.rect(50, 124, 4, 26, P.brown);
  c.rect(12, 128, 36, 20, P.brownDark);
  c.rect(14, 112, 8, 6, P.red); c.rect(30, 112, 10, 6, P.gray);
  c.save('assets/scenes/hall-bg.png');
}
// Sturmschaden: Landstraße
{
  const c = sceneCanvas();
  c.rect(0, 0, 320, 100, P.sky);
  c.rect(0, 20, 320, 30, P.grayLight); c.noise(0, 20, 320, 30, P.skyLight, 0.4, 31); // Wolken
  c.rect(0, 60, 320, 40, P.oliveDark); // Waldrand
  for (let x = 0; x < 320; x += 14) { c.rect(x + 2, 52 + (x % 3) * 4, 10, 40, P.green); c.rect(x + 5, 80, 4, 20, P.brownDark); }
  c.rect(0, 100, 320, 20, P.olive); // Bankett
  c.rect(0, 120, 320, 44, P.asphalt); // Straße
  c.noise(0, 120, 320, 44, P.asphaltLight, 0.05, 37);
  for (let x = 0; x < 320; x += 24) c.rect(x, 141, 12, 2, P.concreteLight);
  c.rect(0, 164, 320, 16, P.olive); // Bankett unten
  c.rect(0, 164, 320, 2, P.oliveDark);
  c.save('assets/scenes/storm-tree-bg.png');
}
// Wasserschaden: Mehrfamilienhaus mit Kellertreppe
{
  const c = sceneCanvas();
  c.rect(0, 0, 320, 180, P.sky);
  c.rect(0, 0, 200, 130, P.tan); // Hausfassade
  c.outline(0, 0, 200, 130, P.brownDark);
  for (let fy = 12; fy < 100; fy += 40) for (let fx = 20; fx < 190; fx += 40) { c.rect(fx, fy, 16, 22, P.skyLight); c.outline(fx, fy, 16, 22, P.brownDark); }
  c.rect(100, 96, 26, 34, P.brown); c.outline(100, 96, 26, 34, P.brownDark); // Haustür
  c.rect(0, 130, 200, 8, P.concrete); // Sockel
  c.rect(0, 138, 320, 18, P.concreteLight); // Gehweg
  c.rect(0, 156, 320, 24, P.asphalt); // Straße
  c.noise(0, 156, 320, 24, P.asphaltLight, 0.05, 41);
  // Kellerschacht (offen, Wasser wird als Prop gezeichnet)
  c.rect(24, 138, 60, 42, P.grayDark);
  c.rect(24, 138, 60, 42, P.dark); c.outline(24, 138, 60, 42, P.gray);
  for (let s = 0; s < 5; s++) c.rect(28 + s * 6, 142 + s * 7, 50 - s * 6, 3, P.gray); // Treppe
  // Gully
  c.rect(200, 158, 16, 6, P.dark); for (let i = 0; i < 16; i += 4) c.rect(200 + i, 158, 2, 6, P.gray);
  // Sicherungskasten neben der Tür
  c.rect(132, 104, 12, 16, P.grayLight); c.outline(132, 104, 12, 16, P.dark); c.rect(135, 108, 6, 2, P.red);
  c.save('assets/scenes/water-basement-bg.png');
}
console.log('fertig');
