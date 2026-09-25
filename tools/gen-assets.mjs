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
  // 5x7-Glyphen, mit Faktor FS gerendert (20x28 bei FS = 4), passend zur 1280x720-Auflösung.
  const FS = 4;
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

/** Schreibt Text mit den Font-Glyphen (Faktor fs) auf die Canvas. */
function stamp(c, x, y, text, color, fs = 1) {
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, ry) => [...row].forEach((px, rx) => { if (px === '#') c.rect(x + (i * (GLYPH_W + 1) + rx) * fs, y + ry * fs, fs, fs, color); }));
  });
}
// ---------------------------------------------------------------- Tileset (64x64)
const TILE = 64;
{
  const cols = 8;
  const rows = Math.ceil(TILES.length / cols);
  const c = new Canvas(cols * TILE, rows * TILE);
  const S = TILE;
  const rnd = (seed) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
  const grassBase = (x, y, seed) => {
    c.rect(x, y, S, S, P.olive);
    c.noise(x, y, S, S, P.oliveLight, 0.08, seed);
    c.noise(x, y, S, S, P.oliveDark, 0.05, seed + 1);
    const r = rnd(seed);
    for (let i = 0; i < 14; i++) { const tx = x + Math.floor(r() * (S - 4)); const ty = y + Math.floor(r() * (S - 6)); c.rect(tx, ty + 2, 1, 4, P.oliveLight); c.rect(tx + 2, ty, 1, 5, P.oliveLight); c.rect(tx + 4, ty + 3, 1, 3, P.oliveDark); }
  };
  const roadBase = (x, y, seed) => {
    c.rect(x, y, S, S, P.asphalt);
    c.noise(x, y, S, S, P.asphaltLight, 0.04, seed);
    c.noise(x, y, S, S, P.asphaltDark, 0.04, seed + 3);
    const r = rnd(seed + 7);
    for (let i = 0; i < 3; i++) { const cx = x + Math.floor(r() * S); const cy = y + Math.floor(r() * S); c.rect(cx, cy, 6, 1, P.asphaltDark); c.rect(cx + 6, cy + 1, 4, 1, P.asphaltDark); }
  };
  const bricks = (x, y, base, light, dark, bw = 12, bh = 6) => {
    c.rect(x, y, S, S, base);
    for (let ry = 0; ry < S; ry += bh) {
      const off = (ry / bh) % 2 ? bw / 2 : 0;
      for (let bx = -bw; bx < S; bx += bw) { const sx = Math.max(0, bx + off); const w = Math.min(bw - 1, S - sx); if (w > 0) { c.rect(x + sx, y + ry, w, bh - 1, light); c.rect(x + sx, y + ry + bh - 2, w, 1, dark); } }
    }
  };
  const roofBase = (x, y, base, light, dark, seed) => {
    c.rect(x, y, S, S, base);
    for (let ry = 0; ry < S; ry += 8) { const off = (ry / 8) % 2 ? 8 : 0; for (let rx = -16; rx < S; rx += 16) { const sx = Math.max(0, rx + off); const w = Math.min(15, S - sx); if (w > 0) { c.rect(x + sx, y + ry + 1, w, 6, light); c.rect(x + sx, y + ry + 6, w, 1, dark); } } }
    c.noise(x, y, S, S, dark, 0.03, seed);
    c.outline(x, y, S, S, P.dark);
  };
  const window_ = (x, y, w, h) => { c.rect(x, y, w, h, P.skyLight); c.rect(x, y, w, Math.floor(h / 3), P.sky); c.outline(x, y, w, h, P.dark); c.rect(x + Math.floor(w / 2), y, 1, h, P.dark); c.rect(x, y + Math.floor(h / 2), w, 1, P.dark); c.rect(x - 1, y + h, w + 2, 2, P.grayLight); };
  const draw = {
    grass: (x, y) => grassBase(x, y, 3),
    'grass-alt': (x, y) => { grassBase(x, y, 7); c.noise(x, y, S, S, P.oliveDark, 0.1, 9); },
    road: (x, y) => roadBase(x, y, 11),
    'road-line-h': (x, y) => { roadBase(x, y, 11); c.rect(x + 8, y + 30, 36, 5, P.concreteLight); },
    'road-line-v': (x, y) => { roadBase(x, y, 11); c.rect(x + 30, y + 8, 5, 36, P.concreteLight); },
    'road-edge-h': (x, y) => { roadBase(x, y, 11); c.rect(x, y, S, 3, P.concrete); },
    'road-edge-v': (x, y) => { roadBase(x, y, 11); c.rect(x, y, 3, S, P.concrete); },
    sidewalk: (x, y) => { c.rect(x, y, S, S, P.concrete); for (let py = 0; py < S; py += 16) for (let px = 0; px < S; px += 16) { c.rect(x + px + 1, y + py + 1, 14, 14, P.concreteLight); c.noise(x + px + 1, y + py + 1, 14, 14, P.concrete, 0.06, px * 3 + py); c.rect(x + px + 1, y + py + 14, 14, 1, P.gray); } },
    'wall-a': (x, y) => { bricks(x, y, P.brown, P.brownLight, P.brownDark); window_(x + 8, y + 12, 16, 22); window_(x + 40, y + 12, 16, 22); c.rect(x + 26, y + 40, 12, 24, P.brownDark); c.rect(x + 28, y + 42, 8, 10, P.brown); c.rect(x + 35, y + 54, 2, 2, P.yellow); c.rect(x + 22, y + 62, 20, 2, P.concrete); },
    'wall-b': (x, y) => { c.rect(x, y, S, S, P.tan); c.noise(x, y, S, S, P.brownLight, 0.05, 5); c.rect(x, y, S, 4, P.concreteLight); window_(x + 6, y + 10, 14, 20); window_(x + 25, y + 10, 14, 20); window_(x + 44, y + 10, 14, 20); window_(x + 6, y + 38, 14, 20); c.rect(x + 25, y + 38, 14, 26, P.brownDark); c.rect(x + 27, y + 40, 10, 12, P.brown); c.rect(x + 35, y + 52, 2, 2, P.yellow); window_(x + 44, y + 38, 14, 20); c.rect(x, y + 63, S, 1, P.brownDark); },
    roof: (x, y) => roofBase(x, y, P.grayDark, P.gray, P.dark, 13),
    'roof-blue': (x, y) => roofBase(x, y, P.thwBlueDark, P.thwBlue, P.dark, 15),
    'roof-red': (x, y) => roofBase(x, y, P.redDark, P.red, P.dark, 17),
    fence: (x, y) => { grassBase(x, y, 19); c.rect(x, y + 24, S, 5, P.brownLight); c.rect(x, y + 44, S, 5, P.brownLight); for (let i = 4; i < S; i += 20) { c.rect(x + i, y + 12, 8, 48, P.brown); c.rect(x + i, y + 12, 8, 3, P.brownDark); c.rect(x + i + 2, y + 10, 4, 2, P.brownDark); } },
    tree: (x, y) => { grassBase(x, y, 21); c.circle(x + 36, y + 38, 23, P.oliveDark); c.circle(x + 31, y + 31, 23, P.green); c.noise(x + 10, y + 10, 44, 44, P.greenLight, 0.12, 22); c.circle(x + 26, y + 24, 12, P.greenLight); c.noise(x + 14, y + 12, 24, 24, P.green, 0.25, 24); c.rect(x + 29, y + 50, 6, 12, P.brownDark); },
    water: (x, y) => { c.rect(x, y, S, S, P.water); c.noise(x, y, S, S, P.waterDark, 0.06, 23); for (let i = 0; i < 7; i++) { const wx = x + ((i * 19) % 48); const wy = y + 6 + i * 8; c.rect(wx, wy, 10, 1, P.waterLight); c.rect(wx + 3, wy + 1, 4, 1, P.waterLight); } },
    construction: (x, y) => { roadBase(x, y, 25); c.rect(x + 6, y + 14, 52, 6, P.dark); c.rect(x + 6, y + 40, 52, 6, P.dark); for (let i = 0; i < 52; i += 16) { c.rect(x + 6 + i, y + 20, 8, 20, P.red); c.rect(x + 14 + i, y + 20, 8, 20, P.white); } c.rect(x + 8, y + 8, 5, 50, P.grayLight); c.rect(x + 51, y + 8, 5, 50, P.grayLight); c.rect(x + 26, y + 2, 12, 8, P.orange); c.rect(x + 28, y + 4, 8, 4, P.yellow); },
    'depot-floor': (x, y) => { c.rect(x, y, S, S, P.grayLight); c.noise(x, y, S, S, P.concreteLight, 0.1, 27); c.rect(x, y, S, 2, P.gray); c.rect(x, y, 2, S, P.gray); },
    'depot-wall': (x, y) => { c.rect(x, y, S, S, P.thwBlue); c.outline(x, y, S, S, P.thwBlueDark); c.rect(x + 6, y + 22, 52, 14, P.yellow); c.rect(x + 14, y + 44, 36, 20, P.grayLight); for (let i = 0; i < 20; i += 4) c.rect(x + 14, y + 44 + i, 36, 1, P.gray); c.rect(x + 12, y + 42, 40, 2, P.dark); },
    field: (x, y) => { c.rect(x, y, S, S, P.brownLight); for (let i = 0; i < S; i += 10) { c.rect(x, y + i, S, 4, P.brown); c.noise(x, y + i + 4, S, 6, P.oliveLight, 0.12, i); } },
    flower: (x, y) => { grassBase(x, y, 29); const r = rnd(30); for (let i = 0; i < 9; i++) { const fx = x + 4 + Math.floor(r() * 56); const fy = y + 4 + Math.floor(r() * 54); const col = [P.pink, P.yellow, P.white][i % 3]; c.rect(fx, fy, 3, 3, col); c.rect(fx + 1, fy + 1, 1, 1, P.yellowDark); c.rect(fx + 1, fy + 3, 1, 3, P.oliveDark); } },
    gravel: (x, y) => { c.rect(x, y, S, S, P.concrete); c.noise(x, y, S, S, P.gray, 0.22, 31); c.noise(x, y, S, S, P.concreteLight, 0.15, 33); c.noise(x, y, S, S, P.grayDark, 0.04, 35); },
    marker: (x, y) => { c.rect(x + 8, y + 8, 48, 48, P.yellow); c.outline(x + 8, y + 8, 48, 48, P.dark); c.outline(x + 10, y + 10, 44, 44, P.yellowDark); c.rect(x + 28, y + 16, 8, 20, P.dark); c.rect(x + 28, y + 40, 8, 8, P.dark); },
    empty: () => {},
  };
  TILES.forEach((name, i) => draw[name]((i % cols) * TILE, Math.floor(i / cols) * TILE));
  c.save('assets/tiles/city-tileset.png');
}

// ---------------------------------------------------------------- Top-down-Fahrzeuge (Blickrichtung: rechts / +x)
function topdownVehicle(file, w, h, body, roofColor, opts = {}) {
  const c = new Canvas(w, h);
  const cab = opts.cab ?? 28;
  const wheels = opts.wheels ?? [10, w - 24];
  // Schatten, Karosserie
  c.rect(3, 3, w - 4, h - 4, P.dark);
  c.rect(2, 2, w - 5, h - 5, body);
  c.outline(2, 2, w - 5, h - 5, P.dark);
  // Reifen (ragen oben und unten heraus)
  for (const x of wheels) { c.rect(x, 0, 12, 4, P.dark); c.rect(x + 2, 1, 8, 2, P.grayDark); c.rect(x, h - 4, 12, 4, P.dark); c.rect(x + 2, h - 3, 8, 2, P.grayDark); }
  // Aufbau (Koffer) mit Dachsicken
  if (opts.box) { c.rect(5, 5, w - cab - 9, h - 10, opts.box); c.outline(5, 5, w - cab - 9, h - 10, P.dark); for (let y = 8; y < h - 8; y += 5) c.rect(6, y, w - cab - 11, 1, P.grayLight); if (opts.label) stamp(c, 12, Math.floor(h / 2) - 7, opts.label, P.white, 2); }
  else if (opts.roofHatch) { c.rect(10, 8, w - cab - 16, h - 16, roofColor); c.outline(10, 8, w - cab - 16, h - 16, P.dark); if (opts.label) stamp(c, 14, Math.floor(h / 2) - 7, opts.label, P.white, 2); }
  // Kabinendach, Windschutzscheibe, Heckscheibe
  c.rect(w - cab - 3, 5, cab - 8, h - 10, roofColor);
  c.rect(w - 12, 5, 6, h - 10, P.skyLight);
  c.rect(w - 11, 6, 2, h - 12, P.sky);
  c.rect(w - cab - 3, 6, 2, h - 12, P.skyLight);
  // Außenspiegel
  c.rect(w - cab + 2, 0, 4, 3, P.dark); c.rect(w - cab + 2, h - 3, 4, 3, P.dark);
  // Scheinwerfer, Rücklichter, Kühlergrill
  c.rect(w - 5, 3, 3, 5, P.yellow); c.rect(w - 5, h - 8, 3, 5, P.yellow);
  c.rect(w - 4, 9, 2, h - 18, P.grayDark);
  c.rect(2, 3, 2, 5, P.red); c.rect(2, h - 8, 2, 5, P.red);
  if (opts.stripe) c.rect(6, Math.floor(h / 2) - 2, w - cab - 10, 4, opts.stripe);
  if (opts.lightbar) { c.rect(w - cab - 1, Math.floor(h / 2) - 4, 5, 8, P.thwBlueLight); c.rect(w - cab + 8, Math.floor(h / 2) - 4, 5, 8, P.thwBlueLight); c.rect(w - cab + 4, Math.floor(h / 2) - 2, 4, 4, P.grayLight); }
  c.save(file);
}
topdownVehicle('assets/sprites/vehicle-mtw-top.png', 80, 40, P.thwBlue, P.thwBlueDark, { cab: 24, roofHatch: true, label: 'THW', lightbar: true, wheels: [12, 56] });
topdownVehicle('assets/sprites/vehicle-gkw-top.png', 112, 48, P.thwBlue, P.thwBlueDark, { cab: 32, box: P.thwBlueDark, label: 'THW', lightbar: true, wheels: [16, 80] });
topdownVehicle('assets/sprites/civil-car-a-top.png', 72, 36, P.red, P.redDark, { cab: 32, wheels: [10, 50] });
topdownVehicle('assets/sprites/civil-car-b-top.png', 72, 36, P.concreteLight, P.gray, { cab: 32, wheels: [10, 50] });
topdownVehicle('assets/sprites/civil-car-c-top.png', 72, 36, P.green, P.oliveDark, { cab: 32, wheels: [10, 50] });


/**
 * Zeichenfläche mit Faktor K: alle Koordinaten der Seitenansicht-Grafiken sind im
 * 640x360-Entwurfsraster notiert und werden für 1280x720 verdoppelt.
 */
const K = 2;
function scaled(c, k = K) {
  return {
    width: c.width / k,
    height: c.height / k,
    set: (x, y, hex) => c.rect(x * k, y * k, k, k, hex),
    rect: (x, y, w, h, hex) => c.rect(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k), hex),
    outline: (x, y, w, h, hex) => { c.rect(x * k, y * k, w * k, k, hex); c.rect(x * k, (y + h) * k - k, w * k, k, hex); c.rect(x * k, y * k, k, h * k, hex); c.rect((x + w) * k - k, y * k, k, h * k, hex); },
    circle: (cx, cy, r, hex) => c.circle(Math.round(cx * k + k / 2), Math.round(cy * k + k / 2), Math.round(r * k), hex),
    noise: (x, y, w, h, hex, density, seed) => c.noise(x * k, y * k, w * k, h * k, hex, density, seed),
    pattern: (x, y, rows, legend) => rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.' && legend[ch]) c.rect((x + rx) * k, (y + ry) * k, k, k, legend[ch]); })),
    save: (file) => c.save(file),
  };
}
const sideCanvas = (w, h, fill) => scaled(new Canvas(w * K, h * K, fill));

// ---------------------------------------------------------------- Seitenansicht-Fahrzeuge (Front links)
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
  const c = sideCanvas(w, h);
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
  const c = sideCanvas(w, h);
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

// ---------------------------------------------------------------- Helfer (Seitenansicht, 24x48 im Entwurf, 2 Frames: stehen / gehen)
{
  const c = sideCanvas(48, 48);
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

// ---------------------------------------------------------------- Szenen-Hintergründe (640x360 im Entwurf, gerendert 1280x720)
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
  const c = sideCanvas(SW, SH, P.concreteLight);
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
  const c = sideCanvas(SW, SH, P.sky);
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
  const c = sideCanvas(SW, SH, P.sky);
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
