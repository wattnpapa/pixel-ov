// Erzeugt die Stadtkarte assets/maps/city.tmj im Tiled-JSON-Format.
// Die Datei kann danach in Tiled geöffnet und von Hand weiterbearbeitet werden.
//   node tools/gen-map.mjs
import fs from 'node:fs';
import { TILES } from './tiles.mjs';

const W = 48;
const H = 36;
const T = 16;
const id = (name) => TILES.indexOf(name) + 1; // Tiled-GIDs sind 1-basiert, 0 = leer

const ground = new Array(W * H).fill(id('grass'));
const marks = new Array(W * H).fill(0);
const buildings = new Array(W * H).fill(0);
const at = (layer, x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) layer[y * W + x] = v; };
const get = (layer, x, y) => layer[y * W + x];
const fill = (layer, x, y, w, h, v) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) at(layer, xx, yy, v); };

// Straßen: 3 Tiles breit. Ring (Umgehungsstraße) + zwei Innenstraßen.
const HROADS = [3, 15, 27]; // obere Zeile jedes horizontalen Straßenbands
const VROADS = [3, 17, 31, 42];
for (const y of HROADS) fill(ground, 0, y, W, 3, id('road'));
for (const x of VROADS) fill(ground, x, 0, 3, H, id('road'));
// Ecken außerhalb des Rings bleiben Grün: Ring geht nicht bis zum Kartenrand.
fill(ground, 0, 0, W, 3, id('grass'));
fill(ground, 0, 30, W, 6, id('grass'));
fill(ground, 0, 0, 3, H, id('grass'));
fill(ground, 45, 0, 3, H, id('grass'));
// Vertikale Straßen nur zwischen Ring oben und unten
for (const x of VROADS) { fill(ground, x, 0, 3, 3, id('grass')); fill(ground, x, 30, 3, 6, id('grass')); }
// Horizontale Straßen nur zwischen Ring links und rechts
for (const y of HROADS) { fill(ground, 0, y, 3, 3, id('grass')); fill(ground, 45, y, 3, 3, id('grass')); }

// Mittellinien (gestrichelt), nicht an Kreuzungen
const isRoad = (x, y) => x >= 0 && y >= 0 && x < W && y < H && get(ground, x, y) === id('road');
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!isRoad(x, y)) continue;
  const hCenter = HROADS.some((r) => y === r + 1);
  const vCenter = VROADS.some((r) => x === r + 1);
  const onH = HROADS.some((r) => y >= r && y < r + 3);
  const onV = VROADS.some((r) => x >= r && x < r + 3);
  if (onH && onV) continue; // Kreuzung
  if (hCenter && x % 2 === 0) at(marks, x, y, id('road-line-h'));
  if (vCenter && y % 2 === 0) at(marks, x, y, id('road-line-v'));
}

// Gehwege rund um Straßen
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (isRoad(x, y)) continue;
  if (isRoad(x - 1, y) || isRoad(x + 1, y) || isRoad(x, y - 1) || isRoad(x, y + 1)) at(ground, x, y, id('sidewalk'));
}

// Felder außerhalb des Rings (Landstraße unten = Feldrand)
fill(ground, 0, 31, W, 5, id('field'));
fill(ground, 45, 0, 3, H, id('field'));

// Gebäude: Rechteck mit Dach, unterste Zeile = Wand
function house(x, y, w, h, roof = 'roof') {
  fill(buildings, x, y, w, h - 1, id(roof));
  fill(buildings, x, y + h - 1, w, 1, Math.random() < 0.5 ? id('wall-a') : id('wall-b'));
}
function trees(x, y, w, h, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (rnd() < 0.35) at(buildings, xx, yy, id('tree'));
    else if (rnd() < 0.1) at(ground, xx, yy, id('flower'));
  }
}
Math.random = (() => { let s = 42; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();

// Block A (x 7..15, y 7..13): Unterkunft (THW-Ortsverband)
fill(buildings, 8, 7, 7, 5, id('roof-blue'));
fill(buildings, 8, 12, 7, 1, id('depot-wall'));
fill(ground, 15, 9, 2, 3, id('depot-floor')); // Ausfahrt zur Straße x=17
fill(ground, 7, 13, 8, 1, id('gravel'));
trees(7, 7, 1, 6, 1);

// Block B (x 21..29, y 7..13)
house(22, 7, 4, 4); house(27, 7, 3, 4, 'roof-red'); house(22, 11, 7, 3);
// Block C (x 35..40, y 7..13)
house(36, 7, 5, 3, 'roof-red'); trees(35, 10, 6, 4, 2);
// Block D (x 7..15, y 19..25)
house(8, 19, 3, 4); house(12, 19, 3, 4, 'roof-red'); house(8, 24, 7, 2);
// Block E (x 21..29, y 19..25)
trees(21, 19, 9, 7, 3); // Park
fill(ground, 24, 22, 3, 2, id('water'));
fill(buildings, 24, 22, 3, 2, id('water'));
// Block F (x 35..40, y 19..25)
house(35, 19, 6, 3); house(35, 23, 3, 3, 'roof-red'); fill(buildings, 39, 23, 2, 3, id('fence'));

// Sperrung (Baustelle) auf der Straße x=17..19 zwischen Mittel- und Südstraße
fill(buildings, 17, 21, 3, 2, id('construction'));

// Einsatzstellen-Markierungen auf der Straße (nur Optik, Zonen kommen aus dem Objektlayer)
fill(marks, 36, 27, 3, 3, id('marker'));
fill(marks, 31, 8, 3, 3, id('marker'));

const px = (t) => t * T;
const zones = [
  { id: 1, name: 'unterkunft', x: px(15), y: px(9), width: px(3), height: px(3), properties: [{ name: 'kind', type: 'string', value: 'depot' }, { name: 'heading', type: 'int', value: 0 }] },
  { id: 2, name: 'einsatz-storm-tree', x: px(36), y: px(27), width: px(3), height: px(3), properties: [{ name: 'kind', type: 'string', value: 'mission' }, { name: 'mission', type: 'string', value: 'storm-tree' }, { name: 'heading', type: 'int', value: 180 }] },
  { id: 3, name: 'einsatz-water-basement', x: px(31), y: px(8), width: px(3), height: px(3), properties: [{ name: 'kind', type: 'string', value: 'mission' }, { name: 'mission', type: 'string', value: 'water-basement' }, { name: 'heading', type: 'int', value: 270 }] },
  { id: 4, name: 'sperrung', x: px(17), y: px(21), width: px(3), height: px(2), properties: [{ name: 'kind', type: 'string', value: 'closure' }] },
];
const objects = [
  { id: 10, name: 'spawn-depot', type: 'spawn', x: px(15) + 8, y: px(10) + 8, width: 0, height: 0, point: true, rotation: 0 },
  // Zivilfahrzeuge: Polyline als Rundkurs (Punkte relativ zum Objektursprung)
  route(11, 'route-ring', 'civil-car-a-top', 42, [[4, 4], [43, 4], [43, 28], [4, 28]]),
  route(12, 'route-inner', 'civil-car-b-top', 38, [[18, 4], [32, 4], [32, 16], [18, 16]]),
  route(13, 'route-south', 'civil-car-c-top', 46, [[4, 16], [32, 16], [32, 28], [4, 28]]),
];
function route(oid, name, sprite, speed, pts) {
  const [ox, oy] = pts[0];
  return {
    id: oid, name, type: 'route', x: px(ox) + 8, y: px(oy) + 8, width: 0, height: 0, rotation: 0,
    polygon: pts.map(([x, y]) => ({ x: px(x - ox), y: px(y - oy) })),
    properties: [{ name: 'sprite', type: 'string', value: sprite }, { name: 'speed', type: 'int', value: speed }],
  };
}

const layer = (lid, name, data) => ({ id: lid, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const collidingTiles = ['wall-a', 'wall-b', 'roof', 'roof-blue', 'roof-red', 'fence', 'tree', 'water', 'construction', 'depot-wall'];
const map = {
  type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: T, tileheight: T, infinite: false, nextlayerid: 6, nextobjectid: 20,
  tilesets: [{
    firstgid: 1, name: 'city-tileset', image: '../tiles/city-tileset.png', imagewidth: 128, imageheight: 48,
    tilewidth: T, tileheight: T, tilecount: TILES.length, columns: 8, margin: 0, spacing: 0,
    tiles: TILES.map((name, i) => ({ id: i, type: name, properties: collidingTiles.includes(name) ? [{ name: 'collides', type: 'bool', value: true }] : [] })),
  }],
  layers: [
    layer(1, 'Boden', ground),
    layer(2, 'Markierung', marks),
    layer(3, 'Gebaeude', buildings),
    { id: 4, name: 'Objekte', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects },
    { id: 5, name: 'Zonen', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: zones },
  ],
};
fs.mkdirSync('assets/maps', { recursive: true });
fs.writeFileSync('assets/maps/city.tmj', JSON.stringify(map));
console.log('geschrieben: assets/maps/city.tmj', `${W}x${H} Tiles`);
