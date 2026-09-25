// Erzeugt assets/maps/city.tmj aus OpenStreetMap-Daten (siehe tools/fetch-osm.mjs).
//   node tools/gen-map-osm.mjs [data/osm/datei.json]
// Ein Tile entspricht METERS_PER_TILE Metern. Straßen, Gebäude, Wasser und
// Grünflächen werden gerastert; Unterkunft, Einsatzzonen, Sperrung und
// Zivilrouten werden automatisch auf dem Straßennetz platziert.
import fs from 'node:fs';
import { TILES } from './tiles.mjs';

const file = process.argv[2] ?? 'data/osm/oldenburg-artillerieweg.json';
const METERS_PER_TILE = 4;
const T = 16;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const { center, radiusM } = data;
const id = (name) => TILES.indexOf(name) + 1;

// ---------------------------------------------------------------- Projektion
const mPerDegLat = 111320;
const mPerDegLon = 111320 * Math.cos((center.lat * Math.PI) / 180);
const W = Math.ceil((2 * radiusM) / METERS_PER_TILE);
const H = W;
/** lon/lat -> Tile-Koordinaten (float), y nach unten */
const toTile = (lat, lon) => ({
  x: ((lon - center.lon) * mPerDegLon + radiusM) / METERS_PER_TILE,
  y: ((center.lat - lat) * mPerDegLat + radiusM) / METERS_PER_TILE,
});

const ground = new Array(W * H).fill(id('grass'));
const marks = new Array(W * H).fill(0);
const buildings = new Array(W * H).fill(0);
const roadMask = new Uint8Array(W * H); // 1 = befahrbar (breite Straße), 2 = Weg
const roadDir = new Float32Array(W * H); // Richtung der Straße am Tile in Grad
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const at = (layer, x, y, v) => { if (inside(x, y)) layer[y * W + x] = v; };
const get = (layer, x, y) => (inside(x, y) ? layer[y * W + x] : 0);

// ---------------------------------------------------------------- Polygon-Rasterung (Scanline)
function fillPolygon(pts, cb) {
  if (pts.length < 3) return;
  const ys = pts.map((p) => p.y);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) xs.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(W, Math.round(xs[i + 1])); x++) cb(x, y);
    }
  }
}
/** Linie mit Breite (in Tiles) rastern. */
function strokeLine(pts, width, cb) {
  const r = width / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len * 2));
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    for (let s = 0; s <= steps; s++) {
      const px = a.x + ((b.x - a.x) * s) / steps;
      const py = a.y + ((b.y - a.y) * s) / steps;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r * r + 0.3) cb(Math.floor(px + dx), Math.floor(py + dy), ang);
      }
    }
  }
}

const ways = data.elements.filter((e) => e.type === 'way' && e.geometry);
const geom = (w) => w.geometry.map((g) => toTile(g.lat, g.lon));
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// ---------------------------------------------------------------- 1. Flächen
for (const w of ways) {
  const t = w.tags ?? {};
  const pts = geom(w);
  const set = (tile) => fillPolygon(pts, (x, y) => at(ground, x, y, id(tile)));
  if (t.landuse === 'farmland' || t.landuse === 'farmyard') set('field');
  else if (t.landuse === 'forest' || t.natural === 'wood') fillPolygon(pts, (x, y) => { at(ground, x, y, id('grass-alt')); if (hash(x * 977 + y) % 10 < 4) at(buildings, x, y, id('tree')); });
  else if (t.landuse === 'grass' || t.landuse === 'meadow' || t.leisure === 'park' || t.leisure === 'garden' || t.natural === 'grassland') fillPolygon(pts, (x, y) => at(ground, x, y, id(hash(x * 13 + y * 7) % 9 === 0 ? 'flower' : 'grass-alt')));
  else if (t.leisure === 'pitch' || t.leisure === 'playground') set('gravel');
  else if (t.landuse === 'industrial' || t.landuse === 'retail' || t.landuse === 'commercial') set('gravel');
  else if (t.natural === 'scrub') fillPolygon(pts, (x, y) => { if (hash(x * 31 + y) % 5 === 0) at(buildings, x, y, id('tree')); });
}
// Wasser
for (const w of ways) {
  const t = w.tags ?? {};
  const pts = geom(w);
  if (t.natural === 'water' || t.landuse === 'reservoir') fillPolygon(pts, (x, y) => { at(ground, x, y, id('water')); at(buildings, x, y, id('water')); });
  else if (t.waterway === 'river' || t.waterway === 'stream' || t.waterway === 'canal') strokeLine(pts, t.waterway === 'river' ? 4 : 1.5, (x, y) => { at(ground, x, y, id('water')); at(buildings, x, y, id('water')); });
}

// ---------------------------------------------------------------- 2. Gebäude
const buildingTiles = new Set();
for (const w of ways) {
  const t = w.tags ?? {};
  if (!t.building) continue;
  const pts = geom(w);
  const roof = ['roof', 'roof-red', 'roof', 'roof-blue'][hash(w.id) % 4];
  const cells = [];
  fillPolygon(pts, (x, y) => cells.push([x, y]));
  if (cells.length === 0) {
    // Kleines Gebäude unter Tile-Größe: ein Tile am Schwerpunkt
    const cx = Math.floor(pts.reduce((a, p) => a + p.x, 0) / pts.length);
    const cy = Math.floor(pts.reduce((a, p) => a + p.y, 0) / pts.length);
    cells.push([cx, cy]);
  }
  const set = new Set(cells.map(([x, y]) => y * W + x));
  for (const [x, y] of cells) {
    const wallRow = !set.has((y + 1) * W + x); // unterste Zeile -> Wand
    at(buildings, x, y, wallRow ? id(hash(w.id + x) % 2 ? 'wall-a' : 'wall-b') : id(roof));
    buildingTiles.add(y * W + x);
  }
}

// ---------------------------------------------------------------- 3. Straßen und Bahn
const ROAD_WIDTH = {
  motorway: 6, trunk: 5, primary: 5, secondary: 4, tertiary: 4, unclassified: 3, residential: 3, living_street: 3,
  service: 2, motorway_link: 4, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 3,
};
const PATH_TYPES = new Set(['footway', 'cycleway', 'path', 'track', 'pedestrian', 'bridleway']);
const roadWays = [];
for (const w of ways) {
  const t = w.tags ?? {};
  if (t.railway === 'rail') { strokeLine(geom(w), 1.5, (x, y) => { at(ground, x, y, id('gravel')); at(marks, x, y, id('road-edge-h')); }); continue; }
  if (!t.highway) continue;
  if (PATH_TYPES.has(t.highway)) {
    strokeLine(geom(w), 1, (x, y) => { if (!buildingTiles.has(y * W + x)) { at(ground, x, y, id('gravel')); roadMask[y * W + x] = Math.max(roadMask[y * W + x], 2); } });
    continue;
  }
  const width = ROAD_WIDTH[t.highway];
  if (!width) continue;
  const pts = geom(w);
  roadWays.push({ way: w, pts, width, name: t.name ?? '' });
  strokeLine(pts, width, (x, y, ang) => {
    if (!inside(x, y)) return;
    at(ground, x, y, id('road'));
    at(buildings, x, y, 0); // Straße gewinnt gegen Gebäude/Bäume
    at(marks, x, y, 0);
    roadMask[y * W + x] = 1;
    roadDir[y * W + x] = ang;
  });
}
// Mittellinien: Tile liegt auf der Mittellinie, wenn Straße >= 3 breit
for (const r of roadWays) {
  if (r.width < 3) continue;
  strokeLine(r.pts, 0.6, (x, y, ang) => {
    if (!inside(x, y) || roadMask[y * W + x] !== 1) return;
    const horizontal = Math.abs(Math.cos((ang * Math.PI) / 180)) > 0.7;
    if ((x + y) % 2 === 0) at(marks, x, y, id(horizontal ? 'road-line-h' : 'road-line-v'));
  });
}
// Gehwege neben Straßen
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (roadMask[y * W + x] || get(buildings, x, y)) continue;
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && roadMask[(y + dy) * W + x + dx] === 1);
  if (near && get(ground, x, y) !== id('water')) at(ground, x, y, id('sidewalk'));
}

// ---------------------------------------------------------------- 4. Unterkunft, Zonen, Sperrung
const centerTile = toTile(center.lat, center.lon);
function nearestRoadTile(tx, ty, maxR = 40) {
  let best = null;
  for (let y = Math.floor(ty - maxR); y <= ty + maxR; y++) for (let x = Math.floor(tx - maxR); x <= tx + maxR; x++) {
    if (!inside(x, y) || roadMask[y * W + x] !== 1) continue;
    const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}
const depot = nearestRoadTile(centerTile.x, centerTile.y);
if (!depot) throw new Error('Keine Straße in der Nähe der Unterkunft gefunden');
const depotHeading = Math.round(roadDir[depot.y * W + depot.x]);
// Unterkunftsgebäude neben der Straße (senkrecht zur Fahrtrichtung, auf der freien Seite)
{
  const rad = (depotHeading * Math.PI) / 180;
  const nx = Math.round(-Math.sin(rad));
  const ny = Math.round(Math.cos(rad));
  for (const side of [1, -1]) {
    const bx = depot.x + nx * side * 4;
    const by = depot.y + ny * side * 4;
    let free = true;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (!inside(bx + dx, by + dy) || roadMask[(by + dy) * W + bx + dx]) free = false;
    if (!free) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) { at(buildings, bx + dx, by + dy, id(dy === 2 ? 'depot-wall' : 'roof-blue')); at(ground, bx + dx, by + dy, id('depot-floor')); }
    // Ausfahrt
    for (let s = 1; s < 4 * 1; s++) { const ex = depot.x + nx * side * s; const ey = depot.y + ny * side * s; at(ground, ex, ey, id('depot-floor')); at(ground, ex + ny, ey + nx, id('depot-floor')); at(buildings, ex, ey, 0); at(buildings, ex + ny, ey + nx, 0); }
    break;
  }
}

/** Straßen-Tiles mit Abstand im Bereich [min,max] Meter zur Unterkunft. */
function roadTilesInRing(minM, maxM) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (roadMask[y * W + x] !== 1) continue;
    const d = Math.hypot(x - depot.x, y - depot.y) * METERS_PER_TILE;
    if (d >= minM && d <= maxM) out.push({ x, y, ang: Math.atan2(y - depot.y, x - depot.x) });
  }
  return out;
}
const ring = roadTilesInRing(radiusM * 0.55, radiusM * 0.85);
if (ring.length < 2) throw new Error('Zu wenig Straßen im Zielring');
const missionA = ring.reduce((a, b) => (b.x > a.x ? b : a));
const missionB = ring.reduce((a, b) => {
  const da = Math.abs(Math.atan2(Math.sin(a.ang - missionA.ang), Math.cos(a.ang - missionA.ang)));
  const db = Math.abs(Math.atan2(Math.sin(b.ang - missionA.ang), Math.cos(b.ang - missionA.ang)));
  return db > da ? b : a;
});
// Sperrung: Straßen-Tile etwa auf einem Drittel des Weges zu Einsatz A, ganze Straßenbreite blockieren
const closureRing = roadTilesInRing(radiusM * 0.2, radiusM * 0.35);
const towardA = closureRing.reduce((a, b) => (Math.abs(Math.atan2(Math.sin(b.ang - missionA.ang), Math.cos(b.ang - missionA.ang))) < Math.abs(Math.atan2(Math.sin(a.ang - missionA.ang), Math.cos(a.ang - missionA.ang))) ? b : a), closureRing[0]);
if (towardA) {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = towardA.x + dx;
    const y = towardA.y + dy;
    if (inside(x, y) && roadMask[y * W + x] === 1) { at(buildings, x, y, id('construction')); }
  }
}
for (const m of [missionA, missionB]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) at(marks, m.x + dx, m.y + dy, id('marker'));

const px = (t) => t * T;
const zoneRect = (x, y) => ({ x: px(x - 1), y: px(y - 1), width: px(3), height: px(3) });
const heading = (t) => (Math.round(roadDir[t.y * W + t.x]) + 360) % 360;
const zones = [
  { id: 1, name: 'unterkunft', ...zoneRect(depot.x, depot.y), properties: [{ name: 'kind', type: 'string', value: 'depot' }, { name: 'heading', type: 'int', value: depotHeading }] },
  { id: 2, name: 'einsatz-storm-tree', ...zoneRect(missionA.x, missionA.y), properties: [{ name: 'kind', type: 'string', value: 'mission' }, { name: 'mission', type: 'string', value: 'storm-tree' }, { name: 'heading', type: 'int', value: heading(missionA) }] },
  { id: 3, name: 'einsatz-water-basement', ...zoneRect(missionB.x, missionB.y), properties: [{ name: 'kind', type: 'string', value: 'mission' }, { name: 'mission', type: 'string', value: 'water-basement' }, { name: 'heading', type: 'int', value: heading(missionB) }] },
];
if (towardA) zones.push({ id: 4, name: 'sperrung', ...zoneRect(towardA.x, towardA.y), properties: [{ name: 'kind', type: 'string', value: 'closure' }] });

// ---------------------------------------------------------------- 5. Zivilrouten: lange Straßenzüge, hin und zurück
const wayLen = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
const longWays = roadWays.filter((r) => r.width >= 3 && wayLen(r.pts) * METERS_PER_TILE > 250).sort((a, b) => wayLen(b.pts) - wayLen(a.pts));
const sprites = ['civil-car-a-top', 'civil-car-b-top', 'civil-car-c-top', 'civil-car-a-top', 'civil-car-b-top'];
const objects = [{ id: 10, name: 'spawn-depot', type: 'spawn', x: px(depot.x) + 8, y: px(depot.y) + 8, width: 0, height: 0, point: true, rotation: 0 }];
longWays.slice(0, 5).forEach((r, i) => {
  const pts = r.pts.map((p) => ({ x: Math.max(1, Math.min(W - 1, p.x)), y: Math.max(1, Math.min(H - 1, p.y)) }));
  const loop = [...pts, ...pts.slice(1, -1).reverse()];
  const [o] = loop;
  objects.push({
    id: 11 + i, name: `route-${r.name || r.way.id}`, type: 'route', x: px(o.x), y: px(o.y), width: 0, height: 0, rotation: 0,
    polygon: loop.map((p) => ({ x: px(p.x - o.x), y: px(p.y - o.y) })),
    properties: [{ name: 'sprite', type: 'string', value: sprites[i] }, { name: 'speed', type: 'int', value: 36 + i * 4 }],
  });
});

// ---------------------------------------------------------------- 6. Schreiben
const layer = (lid, name, d) => ({ id: lid, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: d });
const collidingTiles = ['wall-a', 'wall-b', 'roof', 'roof-blue', 'roof-red', 'fence', 'tree', 'water', 'construction', 'depot-wall'];
const map = {
  type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H, tilewidth: T, tileheight: T, infinite: false, nextlayerid: 6, nextobjectid: 20,
  properties: [{ name: 'source', type: 'string', value: `OpenStreetMap, ${data.address}, Radius ${radiusM} m, ${METERS_PER_TILE} m/Tile` }],
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
console.log(`geschrieben: assets/maps/city.tmj ${W}x${H} Tiles, ${roadWays.length} Straßen, Unterkunft bei Tile ${depot.x}/${depot.y}, Einsätze bei ${missionA.x}/${missionA.y} und ${missionB.x}/${missionB.y}`);
