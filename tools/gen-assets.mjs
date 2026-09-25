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
  // 5x7-Glyphen, mit Faktor FS gerendert (10x14 bei FS = 2), passend zur 640x360-Auflösung.
  const FS = 2;
  const gw = GLYPH_W * FS;
  const gh = GLYPH_H * FS;
  const sp = FS;
  const rows = Math.ceil(CHARS.length / CHARS_PER_ROW);
  const c = new Canvas(CHARS_PER_ROW * (gw + sp), rows * (gh + sp));
  [...CHARS].forEach((ch, i) => {
    const gx = (i % CHARS_PER_ROW) * (gw + sp);
    const gy = Math.floor(i / CHARS_PER_ROW) * (gh + sp);
    GLYPHS[ch].forEach((row, ry) => [...row].forEach((px, rx) => { if (px === '#') c.rect(gx + rx * FS, gy + ry * FS, FS, FS, P.white); }));
  });
  c.save('assets/fonts/pixel-font.png');
  fs.writeFileSync(
    'assets/fonts/pixel-font.json',
    JSON.stringify({ image: 'fonts/pixel-font.png', width: gw, height: gh, chars: CHARS, charsPerRow: CHARS_PER_ROW, spacingX: sp, spacingY: sp, lineSpacing: FS * 2 }, null, 2),
  );
}

// ---------------------------------------------------------------- Tileset (32x32)
const TILE = 32;
{
  const cols = 8;
  const rows = Math.ceil(TILES.length / cols);
  const c = new Canvas(cols * TILE, rows * TILE);
  const grassBase = (x, y, seed) => { c.rect(x, y, 32, 32, P.olive); c.noise(x, y, 32, 32, P.oliveLight, 0.10, seed); c.noise(x, y, 32, 32, P.oliveDark, 0.06, seed + 1); for (let i = 0; i < 5; i++) { const tx = x + ((seed * 7 + i * 13) % 28); const ty = y + ((seed * 11 + i * 17) % 28); c.rect(tx, ty, 1, 3, P.oliveLight); c.rect(tx + 2, ty + 1, 1, 2, P.oliveLight); } };
  const roadBase = (x, y, seed) => { c.rect(x, y, 32, 32, P.asphalt); c.noise(x, y, 32, 32, P.asphaltLight, 0.05, seed); c.noise(x, y, 32, 32, P.asphaltDark, 0.05, seed + 3); };
  const roofBase = (x, y, base, light, seed) => { c.rect(x, y, 32, 32, base); for (let ry = 0; ry < 32; ry += 4) { const off = (ry / 4) % 2 ? 4 : 0; for (let rx = -8; rx < 32; rx += 8) c.rect(x + Math.max(0, rx + off), y + ry, Math.min(7, 32 - Math.max(0, rx + off)), 3, light); } c.noise(x, y, 32, 32, P.dark, 0.04, seed); c.outline(x, y, 32, 32, P.dark); };
  const draw = {
    grass: (x, y) => grassBase(x, y, 3),
    'grass-alt': (x, y) => { grassBase(x, y, 7); c.noise(x, y, 32, 32, P.oliveDark, 0.12, 9); },
    road: (x, y) => roadBase(x, y, 11),
    'road-line-h': (x, y) => { roadBase(x, y, 11); c.rect(x + 4, y + 15, 18, 3, P.concreteLight); },
    'road-line-v': (x, y) => { roadBase(x, y, 11); c.rect(x + 15, y + 4, 3, 18, P.concreteLight); },
    'road-edge-h': (x, y) => { roadBase(x, y, 11); c.rect(x, y, 32, 2, P.concrete); },
    'road-edge-v': (x, y) => { roadBase(x, y, 11); c.rect(x, y, 2, 32, P.concrete); },
    sidewalk: (x, y) => { c.rect(x, y, 32, 32, P.concrete); for (const [px, py] of [[0, 0], [16, 0], [0, 16], [16, 16]]) { c.rect(x + px + 1, y + py + 1, 14, 14, P.concreteLight); c.noise(x + px + 1, y + py + 1, 14, 14, P.concrete, 0.08, px + py); } },
    'wall-a': (x, y) => { c.rect(x, y, 32, 32, P.brown); for (let r = 0; r < 8; r++) { const off = r % 2 ? 4 : 0; for (let bx = -8; bx < 32; bx += 8) c.rect(x + Math.max(0, bx + off), y + r * 4, Math.min(7, 32 - Math.max(0, bx + off)), 3, P.brownLight); } c.rect(x + 6, y + 8, 8, 12, P.skyLight); c.outline(x + 6, y + 8, 8, 12, P.brownDark); c.rect(x + 18, y + 8, 8, 12, P.skyLight); c.outline(x + 18, y + 8, 8, 12, P.brownDark); c.rect(x + 13, y + 22, 6, 10, P.brownDark); },
    'wall-b': (x, y) => { c.rect(x, y, 32, 32, P.tan); c.noise(x, y, 32, 32, P.brownLight, 0.06, 5); c.rect(x + 4, y + 6, 8, 12, P.sky); c.outline(x + 4, y + 6, 8, 12, P.brownDark); c.rect(x + 20, y + 6, 8, 12, P.sky); c.outline(x + 20, y + 6, 8, 12, P.brownDark); c.rect(x + 12, y + 20, 8, 12, P.brownDark); c.rect(x + 17, y + 26, 1, 2, P.yellow); c.rect(x, y + 31, 32, 1, P.brownDark); },
    roof: (x, y) => roofBase(x, y, P.grayDark, P.gray, 13),
    'roof-blue': (x, y) => roofBase(x, y, P.thwBlueDark, P.thwBlue, 15),
    'roof-red': (x, y) => roofBase(x, y, P.redDark, P.red, 17),
    fence: (x, y) => { grassBase(x, y, 19); c.rect(x, y + 12, 32, 3, P.brownLight); c.rect(x, y + 22, 32, 3, P.brownLight); for (let i = 2; i < 32; i += 10) { c.rect(x + i, y + 6, 4, 24, P.brown); c.rect(x + i, y + 6, 4, 2, P.brownDark); } },
    tree: (x, y) => { grassBase(x, y, 21); c.circle(x + 17, y + 18, 11, P.oliveDark); c.circle(x + 15, y + 15, 11, P.green); c.circle(x + 13, y + 12, 6, P.greenLight); c.rect(x + 14, y + 24, 4, 6, P.brownDark); },
    water: (x, y) => { c.rect(x, y, 32, 32, P.water); c.noise(x, y, 32, 32, P.waterDark, 0.08, 23); for (let i = 0; i < 4; i++) c.rect(x + ((i * 9) % 24), y + 4 + i * 7, 8, 1, P.waterLight); },
    construction: (x, y) => { roadBase(x, y, 25); c.rect(x + 2, y + 8, 28, 4, P.dark); c.rect(x + 2, y + 20, 28, 4, P.dark); for (let i = 0; i < 28; i += 8) { c.rect(x + 2 + i, y + 12, 4, 8, P.red); c.rect(x + 6 + i, y + 12, 4, 8, P.white); } c.rect(x + 4, y + 4, 3, 24, P.grayLight); c.rect(x + 25, y + 4, 3, 24, P.grayLight); c.rect(x + 13, y + 2, 6, 4, P.orange); },
    'depot-floor': (x, y) => { c.rect(x, y, 32, 32, P.grayLight); c.noise(x, y, 32, 32, P.concreteLight, 0.1, 27); c.rect(x, y, 32, 1, P.gray); c.rect(x, y, 1, 32, P.gray); },
    'depot-wall': (x, y) => { c.rect(x, y, 32, 32, P.thwBlue); c.outline(x, y, 32, 32, P.thwBlueDark); c.rect(x + 3, y + 12, 26, 8, P.yellow); c.rect(x + 8, y + 24, 16, 8, P.grayLight); for (let i = 0; i < 8; i += 2) c.rect(x + 8, y + 24 + i, 16, 1, P.gray); },
    field: (x, y) => { c.rect(x, y, 32, 32, P.brownLight); for (let i = 0; i < 32; i += 6) { c.rect(x, y + i, 32, 2, P.brown); c.noise(x, y + i + 2, 32, 4, P.oliveLight, 0.1, i); } },
    flower: (x, y) => { grassBase(x, y, 29); for (const [fx, fy, col] of [[6, 8, P.pink], [20, 18, P.yellow], [12, 24, P.pink], [24, 6, P.white], [4, 22, P.yellow]]) { c.rect(x + fx, y + fy, 2, 2, col); c.rect(x + fx, y + fy + 2, 1, 2, P.oliveDark); } },
    gravel: (x, y) => { c.rect(x, y, 32, 32, P.concrete); c.noise(x, y, 32, 32, P.gray, 0.25, 31); c.noise(x, y, 32, 32, P.concreteLight, 0.15, 33); },
    marker: (x, y) => { c.rect(x + 4, y + 4, 24, 24, P.yellow); c.outline(x + 4, y + 4, 24, 24, P.dark); c.rect(x + 14, y + 8, 4, 10, P.dark); c.rect(x + 14, y + 20, 4, 4, P.dark); },
    empty: () => {},
  };
  TILES.forEach((name, i) => draw[name]((i % cols) * TILE, Math.floor(i / cols) * TILE));
  c.save('assets/tiles/city-tileset.png');
}

// ---------------------------------------------------------------- Top-down-Fahrzeuge (Blickrichtung: rechts / +x)
function topdownVehicle(file, w, h, body, roofColor, opts = {}) {
  const c = new Canvas(w, h);
  const cab = opts.cab ?? 14;
  // Schatten und Karosserie
  c.rect(2, 2, w - 3, h - 3, P.dark);
  c.rect(1, 1, w - 3, h - 3, body);
  c.outline(1, 1, w - 3, h - 3, P.dark);
  // Reifen
  for (const x of opts.wheels ?? [5, w - 12]) { c.rect(x, 0, 6, 2, P.dark); c.rect(x, h - 3, 6, 2, P.dark); }
  // Aufbau/Dach
  if (opts.box) { c.rect(3, 3, w - cab - 6, h - 6, opts.box); c.outline(3, 3, w - cab - 6, h - 6, P.dark); for (let y = 5; y < h - 5; y += 3) c.rect(4, y, w - cab - 8, 1, P.grayLight); }
  // Fahrerkabine vorne (rechts): Dach, Windschutzscheibe
  c.rect(w - cab - 2, 3, cab - 4, h - 6, roofColor);
  c.rect(w - 7, 3, 3, h - 6, P.skyLight);
  c.rect(w - 6, 4, 1, h - 8, P.sky);
  // Scheinwerfer und Rücklichter
  c.rect(w - 3, 2, 2, 3, P.yellow); c.rect(w - 3, h - 5, 2, 3, P.yellow);
  c.rect(1, 2, 1, 3, P.red); c.rect(1, h - 5, 1, 3, P.red);
  if (opts.stripe) { c.rect(3, Math.floor(h / 2) - 1, w - cab - 6, 3, opts.stripe); }
  if (opts.lightbar) { c.rect(w - cab - 1, Math.floor(h / 2) - 2, 3, 4, P.thwBlueLight); c.rect(w - cab + 4, Math.floor(h / 2) - 2, 3, 4, P.thwBlueLight); }
  c.save(file);
}
topdownVehicle('assets/sprites/vehicle-mtw-top.png', 40, 20, P.thwBlue, P.thwBlueDark, { cab: 12, stripe: P.yellow, lightbar: true, wheels: [6, 28] });
topdownVehicle('assets/sprites/vehicle-gkw-top.png', 56, 24, P.thwBlue, P.thwBlueDark, { cab: 16, box: P.thwBlueDark, lightbar: true, wheels: [8, 40] });
topdownVehicle('assets/sprites/civil-car-a-top.png', 36, 18, P.red, P.redDark, { cab: 16, wheels: [5, 25] });
topdownVehicle('assets/sprites/civil-car-b-top.png', 36, 18, P.concreteLight, P.gray, { cab: 16, wheels: [5, 25] });
topdownVehicle('assets/sprites/civil-car-c-top.png', 36, 18, P.green, P.oliveDark, { cab: 16, wheels: [5, 25] });

// ---------------------------------------------------------------- Seitenansicht-Fahrzeuge (Front links)
/** Schreibt Text mit den Font-Glyphen (Faktor fs) auf die Canvas. */
function stamp(c, x, y, text, color, fs = 1) {
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, ry) => [...row].forEach((px, rx) => { if (px === '#') c.rect(x + (i * (GLYPH_W + 1) + rx) * fs, y + ry * fs, fs, fs, color); }));
  });
}
/** Rad mit Reifen, Felge, Nabe und Profil. */
function wheel(c, cx, cy, r) {
  c.circle(cx, cy, r, P.dark);
  for (let a = 0; a < 8; a++) { const px = cx + Math.round(Math.cos(a * 0.785) * (r - 1)); const py = cy + Math.round(Math.sin(a * 0.785) * (r - 1)); c.rect(px, py, 2, 2, P.grayDark); }
  c.circle(cx, cy, Math.round(r * 0.55), P.gray);
  c.circle(cx, cy, Math.round(r * 0.25), P.grayDark);
  c.rect(cx - 1, cy - 1, 2, 2, P.grayLight);
}

/** GKW: Doppelkabine, Kofferaufbau mit Rollläden, weiße Stoßstange. 224x96, Front links. */
function gkwSide(file) {
  const w = 224;
  const h = 96;
  const c = new Canvas(w, h);
  const B = P.thwBlue, BD = P.thwBlueDark, BL = P.thwBlueLight, W = P.white, S = P.grayLight, SD = P.gray, D = P.dark;
  // Rahmen
  c.rect(10, 70, 208, 8, D);
  // Kofferaufbau
  c.rect(96, 14, 124, 58, B);
  c.outline(96, 14, 124, 58, BD);
  c.rect(98, 16, 120, 3, BL);
  stamp(c, 97, 21, 'Technisches Hilfswerk', W, 1);
  for (const x of [102, 142, 182]) {
    c.rect(x, 30, 34, 38, S);
    c.outline(x, 30, 34, 38, SD);
    for (let y = 34; y < 66; y += 4) c.rect(x + 1, y, 32, 1, SD);
    c.rect(x + 12, 63, 10, 3, D);
  }
  c.rect(98, 69, 120, 2, W);
  c.rect(216, 36, 4, 34, W);
  for (let y = 36; y < 70; y += 8) c.rect(216, y, 4, 4, P.red);
  c.rect(200, 8, 14, 6, BL); c.rect(203, 6, 8, 2, BL);
  // Fahrerhaus (Doppelkabine)
  c.rect(12, 22, 82, 50, B);
  c.rect(6, 34, 8, 38, B);
  c.rect(8, 28, 6, 6, B);
  c.rect(10, 24, 4, 4, B);
  c.outline(12, 22, 82, 50, BD);
  c.rect(12, 22, 82, 3, BL);
  c.rect(14, 28, 6, 18, P.skyLight); c.rect(10, 32, 4, 14, P.skyLight); c.rect(14, 28, 6, 4, P.sky); // Windschutzscheibe
  c.rect(24, 28, 26, 18, P.skyLight); c.outline(24, 28, 26, 18, BD); c.rect(25, 29, 24, 4, P.sky); // Fenster Tür 1
  c.rect(56, 28, 30, 18, P.skyLight); c.outline(56, 28, 30, 18, BD); c.rect(57, 29, 28, 4, P.sky); // Fenster Tür 2
  c.rect(52, 26, 1, 44, BD); c.rect(88, 26, 1, 44, BD); // Türfugen
  c.rect(44, 50, 6, 2, S); c.rect(80, 50, 6, 2, S); // Türgriffe
  stamp(c, 60, 48, 'THW', W, 1);
  c.rect(6, 56, 88, 4, W); // Weißer Streifen
  // Blaulichter und Dachbalken
  c.rect(30, 18, 38, 4, S);
  c.rect(16, 16, 12, 6, BL); c.rect(18, 14, 8, 2, BL);
  c.rect(70, 16, 12, 6, BL); c.rect(72, 14, 8, 2, BL);
  // Spiegel, Kühlergrill, Stoßstange
  c.rect(2, 30, 4, 12, D); c.rect(2, 30, 4, 2, S);
  c.rect(6, 46, 8, 10, D); for (let y = 48; y < 56; y += 3) c.rect(7, y, 6, 1, SD);
  stamp(c, 3, 40, 'T', W, 1);
  c.rect(0, 62, 16, 12, W); c.outline(0, 62, 16, 12, S);
  c.rect(2, 65, 5, 4, P.yellow); c.rect(9, 65, 5, 4, P.yellow);
  c.rect(2, 70, 12, 2, P.orange);
  // Trittstufe
  c.rect(90, 62, 10, 12, S); c.noise(90, 62, 10, 12, SD, 0.3, 5);
  // Radkästen und Räder
  c.rect(26, 60, 44, 14, W); c.rect(132, 60, 44, 14, W);
  c.rect(28, 62, 40, 12, D); c.rect(134, 62, 40, 12, D);
  wheel(c, 48, 78, 17);
  wheel(c, 154, 78, 17);
  c.save(file);
}

/** MTW: Kleinbus, 128x72, Front links. */
function mtwSide(file) {
  const w = 128;
  const h = 72;
  const c = new Canvas(w, h);
  const B = P.thwBlue, BD = P.thwBlueDark, BL = P.thwBlueLight, W = P.white, S = P.grayLight, D = P.dark;
  c.rect(8, 20, 116, 42, B);
  c.rect(4, 28, 6, 34, B); c.rect(6, 24, 4, 4, B);
  c.outline(8, 20, 116, 42, BD);
  c.rect(10, 22, 112, 3, BL);
  c.rect(8, 26, 6, 16, P.skyLight); c.rect(5, 30, 4, 12, P.skyLight); // Windschutzscheibe
  for (const [x, ww] of [[18, 26], [48, 30], [82, 34]]) { c.rect(x, 26, ww, 16, P.skyLight); c.outline(x, 26, ww, 16, BD); c.rect(x + 1, 27, ww - 2, 3, P.sky); }
  c.rect(46, 24, 1, 34, BD); c.rect(80, 24, 1, 34, BD); c.rect(118, 24, 1, 34, BD);
  c.rect(40, 46, 6, 2, S); c.rect(74, 46, 6, 2, S);
  c.rect(4, 50, 120, 4, W);
  stamp(c, 52, 55, 'THW', W, 1);
  c.rect(24, 14, 10, 6, BL); c.rect(26, 12, 6, 2, BL);
  c.rect(90, 14, 10, 6, BL); c.rect(92, 12, 6, 2, BL);
  c.rect(1, 28, 3, 10, D);
  c.rect(0, 54, 12, 8, W); c.outline(0, 54, 12, 8, S);
  c.rect(2, 56, 4, 3, P.yellow); c.rect(7, 56, 4, 3, P.yellow);
  c.rect(120, 36, 4, 24, W); for (let y = 36; y < 60; y += 6) c.rect(120, y, 4, 3, P.red);
  c.rect(14, 52, 28, 10, D); c.rect(88, 52, 28, 10, D);
  wheel(c, 28, 60, 11);
  wheel(c, 102, 60, 11);
  c.save(file);
}
mtwSide('assets/sprites/vehicle-mtw-side.png');
gkwSide('assets/sprites/vehicle-gkw-side.png');

// ---------------------------------------------------------------- Helfer (Seitenansicht, 24x48, 2 Frames: stehen / gehen)
{
  const c = new Canvas(48, 48);
  const frame = (ox, step) => {
    c.rect(ox + 6, 2, 12, 8, P.white); // Helm
    c.rect(ox + 5, 9, 14, 2, P.grayLight); // Helmrand
    c.rect(ox + 8, 11, 8, 6, P.skin); // Gesicht
    c.rect(ox + 4, 17, 16, 17, P.thwBlue); // Jacke
    c.rect(ox + 4, 22, 16, 3, P.yellow); // Reflexstreifen
    c.rect(ox + 4, 29, 16, 2, P.yellow);
    c.rect(ox + 1, 18, 3, 12, P.thwBlue); c.rect(ox + 20, 18, 3, 12, P.thwBlue); // Arme
    c.rect(ox + 1, 30, 3, 3, P.skin); c.rect(ox + 20, 30, 3, 3, P.skin);
    c.rect(ox + 6 - step, 34, 5, 12, P.thwBlueDark); // Beine
    c.rect(ox + 13 + step, 34, 5, 12, P.thwBlueDark);
    c.rect(ox + 4 - step, 45, 8, 3, P.dark); // Stiefel
    c.rect(ox + 12 + step, 45, 8, 3, P.dark);
  };
  frame(0, 0);
  frame(24, 2);
  c.save('assets/sprites/helper.png');
}

// ---------------------------------------------------------------- Szenen-Hintergründe (640x360)
const SW = 640;
const SH = 360;
function bricks(c, x, y, w, h, a, b, bw = 12, bh = 6) {
  c.rect(x, y, w, h, a);
  for (let yy = y; yy < y + h; yy += bh) {
    const off = ((yy - y) / bh) % 2 === 0 ? 0 : bw / 2;
    for (let xx = x - off; xx < x + w; xx += bw) c.rect(Math.max(x, xx), yy, Math.min(bw - 1, x + w - Math.max(x, xx)), bh - 1, b);
  }
}
function window_(c, x, y, w, h) {
  c.rect(x, y, w, h, P.skyLight);
  c.rect(x, y, w, Math.floor(h / 3), P.sky);
  c.outline(x, y, w, h, P.brownDark);
  c.rect(x + Math.floor(w / 2), y, 1, h, P.brownDark);
  c.rect(x, y + Math.floor(h / 2), w, 1, P.brownDark);
}
// Fahrzeughalle: Innenraum
{
  const c = new Canvas(SW, SH, P.concreteLight);
  bricks(c, 0, 48, SW, 252, P.concreteLight, P.concrete, 16, 8); // Rückwand
  c.rect(0, 0, SW, 48, P.grayLight); // Deckenstreifen
  for (let x = 40; x < SW; x += 120) { c.rect(x, 8, 48, 8, P.white); c.rect(x + 2, 16, 44, 2, P.yellow); } // Leuchten
  c.rect(0, 48, SW, 6, P.thwBlue); // Blaue Bordüre
  // Hallenboden mit Fugen
  c.rect(0, 300, SW, 60, P.gray);
  for (let x = 0; x < SW; x += 40) c.rect(x, 300, 1, 60, P.grayDark);
  for (let y = 300; y < SH; y += 20) c.rect(0, y, SW, 1, P.grayDark);
  c.rect(0, 300, SW, 4, P.grayDark);
  c.rect(120, 304, 180, 52, P.grayDark); c.rect(320, 304, 220, 52, P.grayDark); // Stellplätze
  c.rect(120, 304, 180, 2, P.yellow); c.rect(320, 304, 220, 2, P.yellow);
  c.rect(120, 304, 2, 52, P.yellow); c.rect(298, 304, 2, 52, P.yellow); c.rect(320, 304, 2, 52, P.yellow); c.rect(538, 304, 2, 52, P.yellow);
  // Tor rechts mit Warnmarkierung
  c.rect(552, 80, 88, 220, P.grayLight);
  for (let y = 88; y < 300; y += 16) c.rect(556, y, 80, 4, P.gray);
  c.outline(552, 80, 88, 220, P.dark);
  for (let y = 80; y < 300; y += 16) { c.rect(546, y, 6, 8, P.yellow); c.rect(546, y + 8, 6, 8, P.dark); }
  // Alarmmonitor
  c.rect(16, 80, 88, 68, P.dark);
  c.rect(20, 84, 80, 60, P.black);
  c.rect(52, 148, 16, 12, P.dark); c.rect(40, 158, 40, 4, P.dark);
  // Regal mit Ausrüstung
  c.rect(16, 180, 90, 4, P.brownLight); c.rect(16, 210, 90, 4, P.brownLight);
  c.rect(22, 190, 14, 20, P.red); c.rect(40, 196, 20, 14, P.gray); c.rect(66, 186, 10, 24, P.orange); c.rect(82, 194, 18, 16, P.thwBlueDark);
  // Werkbank
  c.rect(12, 236, 100, 12, P.brownLight);
  c.rect(16, 248, 8, 52, P.brown); c.rect(100, 248, 8, 52, P.brown);
  c.rect(24, 256, 72, 40, P.brownDark);
  c.rect(28, 262, 64, 2, P.brown); c.rect(28, 280, 64, 2, P.brown);
  c.rect(28, 224, 16, 12, P.red); c.rect(60, 226, 20, 10, P.gray); c.rect(88, 222, 8, 14, P.yellow);
  // Schläuche und Feuerlöscher an der Wand
  c.rect(300, 90, 24, 24, P.red); c.outline(300, 90, 24, 24, P.redDark); c.rect(308, 84, 8, 6, P.dark);
  c.save('assets/scenes/hall-bg.png');
}
// Sturmschaden: Landstraße
{
  const c = new Canvas(SW, SH, P.sky);
  c.rect(0, 0, SW, 200, P.sky);
  c.rect(0, 30, SW, 40, P.skyLight); c.noise(0, 30, SW, 40, P.grayLight, 0.3, 31); // Wolkenband
  c.rect(0, 120, SW, 80, P.oliveDark); // Waldrand
  for (let x = 0; x < SW; x += 28) {
    const hgt = 60 + (x * 7) % 30;
    c.rect(x + 4, 200 - hgt, 20, hgt, P.green);
    c.rect(x + 8, 200 - hgt + 8, 12, hgt - 16, P.greenLight);
    c.rect(x + 12, 176, 6, 24, P.brownDark);
  }
  c.rect(0, 200, SW, 40, P.olive); c.noise(0, 200, SW, 40, P.oliveLight, 0.15, 33); // Bankett
  c.rect(0, 240, SW, 88, P.asphalt); // Straße
  c.noise(0, 240, SW, 88, P.asphaltLight, 0.04, 37);
  c.rect(0, 240, SW, 3, P.concreteLight); c.rect(0, 325, SW, 3, P.concreteLight); // Randlinien
  for (let x = 0; x < SW; x += 48) c.rect(x, 282, 24, 4, P.concreteLight); // Mittellinie
  c.rect(0, 328, SW, 32, P.olive); // Bankett unten
  c.noise(0, 328, SW, 32, P.oliveDark, 0.15, 39);
  c.rect(0, 328, SW, 3, P.oliveDark);
  c.save('assets/scenes/storm-tree-bg.png');
}
// Wasserschaden: Mehrfamilienhaus mit Kellertreppe
{
  const c = new Canvas(SW, SH, P.sky);
  c.rect(0, 20, SW, 30, P.skyLight); c.noise(0, 20, SW, 30, P.grayLight, 0.2, 43);
  bricks(c, 0, 0, 400, 260, P.tan, P.brownLight, 16, 8); // Fassade
  c.outline(0, 0, 400, 260, P.brownDark);
  c.rect(0, 0, 400, 10, P.redDark); // Dachkante
  for (let fy = 24; fy < 200; fy += 80) for (let fx = 40; fx < 380; fx += 80) { window_(c, fx, fy, 32, 44); c.rect(fx - 2, fy + 44, 36, 3, P.concrete); }
  // Haustür mit Stufe und Klingelschild
  c.rect(200, 192, 52, 68, P.brown); c.outline(200, 192, 52, 68, P.brownDark);
  c.rect(206, 200, 18, 24, P.skyLight); c.rect(228, 200, 18, 24, P.skyLight);
  c.rect(240, 232, 4, 4, P.yellow);
  c.rect(196, 258, 60, 6, P.concrete);
  c.rect(258, 210, 10, 14, P.grayLight); c.outline(258, 210, 10, 14, P.dark);
  c.rect(0, 260, 400, 16, P.concrete); // Sockel
  c.rect(0, 276, SW, 36, P.concreteLight); // Gehweg
  for (let x = 0; x < SW; x += 32) c.rect(x, 276, 1, 36, P.concrete);
  c.rect(0, 310, SW, 2, P.gray); // Bordstein
  c.rect(0, 312, SW, 48, P.asphalt); // Straße
  c.noise(0, 312, SW, 48, P.asphaltLight, 0.04, 41);
  // Kellerschacht mit Treppe
  c.rect(48, 276, 120, 84, P.dark); c.outline(48, 276, 120, 84, P.gray);
  for (let s = 0; s < 5; s++) c.rect(56 + s * 12, 284 + s * 14, 100 - s * 12, 6, P.gray);
  c.rect(44, 272, 128, 4, P.grayLight); // Schachtrand
  // Gully
  c.rect(360, 316, 32, 12, P.dark); for (let i = 0; i < 32; i += 8) c.rect(360 + i, 316, 4, 12, P.gray);
  // Sicherungskasten neben der Tür
  c.rect(264, 208, 24, 32, P.grayLight); c.outline(264, 208, 24, 32, P.dark); c.rect(270, 216, 12, 4, P.red); c.rect(270, 224, 12, 2, P.dark);
  // Straßenlaterne rechts
  c.rect(600, 120, 6, 156, P.grayDark); c.rect(590, 112, 26, 10, P.grayLight); c.rect(594, 114, 18, 4, P.yellow);
  c.save('assets/scenes/water-basement-bg.png');
}
console.log('fertig');
