// Erzeugt assets/maps/city.tmj aus OpenStreetMap-Daten (siehe tools/fetch-osm.mjs).
//   node tools/gen-map-osm.mjs [data/osm/datei.json]
// Ein Tile entspricht METERS_PER_TILE Metern. Straßen, Gebäude, Wasser und
// Grünflächen werden gerastert; Unterkunft, Einsatzzonen, Sperrung und
// Zivilrouten werden automatisch auf dem Straßennetz platziert.
import fs from 'node:fs';
import { TILES } from './tiles.mjs';

const file = process.argv[2] ?? 'data/osm/oldenburg-artillerieweg.json';
const METERS_PER_TILE = 4;
const T = 64;
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
const roadClass = new Uint8Array(W * H); // 1 = Stadtstraße, 2 = Autobahn/Schnellstraße, 3 = Zufahrt/Service
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
  const roof = ['roof', 'roof-red', 'roof'][hash(w.id) % 3];
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
const FAST_TYPES = new Set(['motorway', 'trunk', 'motorway_link', 'trunk_link', 'primary_link']);
const CITY_TYPES = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'secondary_link', 'tertiary_link']);
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
  const cls = FAST_TYPES.has(t.highway) ? 2 : CITY_TYPES.has(t.highway) ? 1 : 3;
  roadWays.push({ way: w, pts, width, name: t.name ?? '', cls });
  strokeLine(pts, width, (x, y, ang) => {
    if (!inside(x, y)) return;
    at(ground, x, y, id('road'));
    at(buildings, x, y, 0); // Straße gewinnt gegen Gebäude/Bäume
    at(marks, x, y, 0);
    roadMask[y * W + x] = 1;
    roadDir[y * W + x] = ang;
    // Stadtstraßen überschreiben die Klasse von Zufahrten, Autobahnen bleiben Autobahn
    if (roadClass[y * W + x] === 0 || cls < roadClass[y * W + x]) roadClass[y * W + x] = cls;
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
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && roadMask[(y + dy) * W + x + dx] === 1 && roadClass[(y + dy) * W + x + dx] === 1);
  if (near && get(ground, x, y) !== id('water')) at(ground, x, y, id('sidewalk'));
}

// ---------------------------------------------------------------- 4. Unterkunft, Zonen, Sperrung
const centerTile = toTile(center.lat, center.lon);
function nearestRoadTile(tx, ty, maxR = 40) {
  let best = null;
  for (let y = Math.floor(ty - maxR); y <= ty + maxR; y++) for (let x = Math.floor(tx - maxR); x <= tx + maxR; x++) {
    if (!inside(x, y) || roadMask[y * W + x] !== 1 || roadClass[y * W + x] !== 1) continue;
    const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}
const depot = nearestRoadTile(centerTile.x, centerTile.y);
if (!depot) throw new Error('Keine Straße in der Nähe der Unterkunft gefunden');
const depotHeading = Math.round(roadDir[depot.y * W + depot.x]);
// Das Gebäude an der Adresse (oder das nächste) wird zur THW-Halle: blaues Dach, Tor zur Straße
{
  const buildingWays = ways.filter((w) => w.tags?.building);
  const dist2 = (w) => { const pts = geom(w); const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length; const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length; return (cx - centerTile.x) ** 2 + (cy - centerTile.y) ** 2; };
  const home = buildingWays.sort((a, b) => dist2(a) - dist2(b))[0];
  if (home) {
    const cells = [];
    fillPolygon(geom(home), (x, y) => cells.push([x, y]));
    const set = new Set(cells.map(([x, y]) => y * W + x));
    for (const [x, y] of cells) {
      if (get(buildings, x, y) === 0) continue; // Straße hat gewonnen
      const wallRow = !set.has((y + 1) * W + x);
      at(buildings, x, y, id(wallRow ? 'depot-wall' : 'roof-blue'));
    }
    // Zufahrt vom Gebäude zur Straße als Hallenboden
    const cx = Math.round(cells.reduce((a, c) => a + c[0], 0) / Math.max(1, cells.length));
    const cy = Math.round(cells.reduce((a, c) => a + c[1], 0) / Math.max(1, cells.length));
    const steps = Math.max(Math.abs(depot.x - cx), Math.abs(depot.y - cy));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(cx + ((depot.x - cx) * i) / steps);
      const y = Math.round(cy + ((depot.y - cy) * i) / steps);
      if (inside(x, y) && !roadMask[y * W + x] && !set.has(y * W + x)) { at(ground, x, y, id('depot-floor')); at(buildings, x, y, 0); }
    }
  }
}

/** Straßen-Tiles mit Abstand im Bereich [min,max] Meter zur Unterkunft. */
function roadTilesInRing(minM, maxM) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (roadMask[y * W + x] !== 1 || roadClass[y * W + x] !== 1) continue;
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
    if (inside(x, y) && roadMask[y * W + x] === 1 && roadClass[y * W + x] === 1) { at(buildings, x, y, id('construction')); }
  }
}
for (const m of [missionA, missionB]) at(marks, m.x, m.y, id('marker'));

/** Name der nächsten benannten Straße zu einem Tile. */
function streetNameAt(tx, ty) {
  let best = null;
  for (const r of roadWays) {
    if (!r.name) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i]; const b = r.pts[i + 1];
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((tx - a.x) * (b.x - a.x) + (ty - a.y) * (b.y - a.y)) / l2));
      const d = Math.hypot(a.x + (b.x - a.x) * t - tx, a.y + (b.y - a.y) * t - ty);
      if (!best || d < best.d) best = { d, name: r.name };
    }
  }
  return best && best.d < 6 ? best.name : '';
}

// Ausgabe in Pixeln: PX_PER_M Pixel pro Meter (Fahrzeuge sind in diesem Maßstab gezeichnet)
const PX_PER_M = 16;
const mpx = (tiles) => Math.round(tiles * METERS_PER_TILE * PX_PER_M);
const heading = (t) => (Math.round(roadDir[t.y * W + t.x]) + 360) % 360;
const ZONE_M = 12;
const zone = (name, t, extra) => ({ name, x: mpx(t.x + 0.5) - (ZONE_M * PX_PER_M) / 2, y: mpx(t.y + 0.5) - (ZONE_M * PX_PER_M) / 2, w: ZONE_M * PX_PER_M, h: ZONE_M * PX_PER_M, heading: heading(t), street: streetNameAt(t.x, t.y), ...extra });
const zones = [
  zone('unterkunft', depot, { kind: 'depot' }),
  zone('einsatz-storm-tree', missionA, { kind: 'mission', mission: 'storm-tree' }),
  zone('einsatz-water-basement', missionB, { kind: 'mission', mission: 'water-basement' }),
];
if (towardA) zones.push(zone('sperrung', towardA, { kind: 'closure' }));

// ---------------------------------------------------------------- 5. Zivilrouten: lange Straßenzüge, hin und zurück
const wayLen = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
const longWays = roadWays.filter((r) => r.cls === 1 && r.width >= 3 && wayLen(r.pts) * METERS_PER_TILE > 250).sort((a, b) => wayLen(b.pts) - wayLen(a.pts));
const sprites = ['civil-car-a-top', 'civil-car-b-top', 'civil-car-c-top', 'civil-car-a-top', 'civil-car-b-top'];
const routes = longWays.slice(0, 6).map((r, i) => {
  const pts = r.pts.map((p) => ({ x: Math.max(1, Math.min(W - 1, p.x)), y: Math.max(1, Math.min(H - 1, p.y)) }));
  const loop = [...pts, ...pts.slice(1, -1).reverse()];
  return { name: r.name || String(r.way.id), sprite: sprites[i % sprites.length], speed: 110 + (i % 3) * 12, points: loop.map((p) => [mpx(p.x), mpx(p.y)]) };
});

// ---------------------------------------------------------------- 6. Vektor-Karte schreiben
const P = JSON.parse(fs.readFileSync(new URL('../src/config/palette.json', import.meta.url), 'utf8'));
const toPx = (pts) => pts.map((p) => [mpx(p.x), mpx(p.y)]);
const simplify = (pts, tol = 0.15) => {
  // Douglas-Peucker in Tile-Einheiten, entfernt Zwischenpunkte auf fast geraden Strecken
  if (pts.length < 3) return pts;
  const dp = (a, b) => {
    let maxD = 0; let idx = -1;
    const p0 = pts[a]; const p1 = pts[b];
    for (let i = a + 1; i < b; i++) {
      const p = pts[i];
      const l2 = (p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((p.x - p0.x) * (p1.x - p0.x) + (p.y - p0.y) * (p1.y - p0.y)) / l2));
      const d = Math.hypot(p0.x + (p1.x - p0.x) * t - p.x, p0.y + (p1.y - p0.y) * t - p.y);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) return [...dp(a, idx).slice(0, -1), ...dp(idx, b)];
    return [pts[a], pts[b]];
  };
  return dp(0, pts.length - 1);
};
const AREA_KIND = (t) => {
  if (t.natural === 'water' || t.landuse === 'reservoir') return 'water';
  if (t.landuse === 'forest' || t.natural === 'wood') return 'forest';
  if (t.landuse === 'farmland' || t.landuse === 'farmyard') return 'field';
  if (t.landuse === 'grass' || t.landuse === 'meadow' || t.leisure === 'park' || t.leisure === 'garden' || t.natural === 'grassland') return 'park';
  if (t.leisure === 'pitch' || t.leisure === 'playground' || t.landuse === 'industrial' || t.landuse === 'retail' || t.landuse === 'commercial' || t.amenity === 'parking') return 'gravel';
  if (t.natural === 'scrub') return 'scrub';
  return null;
};
const areas = [];
for (const w of ways) {
  const kind = AREA_KIND(w.tags ?? {});
  if (!kind) continue;
  const pts = simplify(geom(w));
  if (pts.length >= 3) areas.push({ kind, poly: toPx(pts) });
}
const waterways = ways.filter((w) => ['river', 'stream', 'canal'].includes(w.tags?.waterway)).map((w) => ({ width: (w.tags.waterway === 'river' ? 8 : 3) * PX_PER_M, points: toPx(simplify(geom(w))) }));
// Reale Fahrbahnbreiten in Metern (OSM-Ways sind bei Autobahnen je Richtungsfahrbahn)
const ROAD_WIDTH_M = {
  motorway: 11, trunk: 10, primary: 9, secondary: 8, tertiary: 7, unclassified: 6, residential: 6, living_street: 5,
  service: 4, motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 6, tertiary_link: 6,
};
/** Ebene: OSM layer, sonst 1 für Brücken, -1 für Tunnel, 0 am Boden. */
const layerOf = (t) => { const l = parseInt(t.layer ?? '', 10); if (!Number.isNaN(l)) return l; if (t.bridge && t.bridge !== 'no') return 1; if (t.tunnel && t.tunnel !== 'no') return -1; return 0; };
const bridgeOf = (t) => !!t.bridge && t.bridge !== 'no';
const roads = roadWays.map((r) => ({ cls: r.cls, width: (ROAD_WIDTH_M[r.way.tags.highway] ?? 6) * PX_PER_M, name: r.name, layer: layerOf(r.way.tags), bridge: bridgeOf(r.way.tags), points: toPx(simplify(r.pts)) }));
const paths = ways.filter((w) => PATH_TYPES.has(w.tags?.highway)).map((w) => ({ layer: layerOf(w.tags), bridge: bridgeOf(w.tags), points: toPx(simplify(geom(w))) }));
const homeId = (() => { const bw = ways.filter((w) => w.tags?.building); const d2 = (w) => { const p = geom(w); const cx = p.reduce((a, q) => a + q.x, 0) / p.length; const cy = p.reduce((a, q) => a + q.y, 0) / p.length; return (cx - centerTile.x) ** 2 + (cy - centerTile.y) ** 2; }; return bw.sort((a, b) => d2(a) - d2(b))[0]?.id; })();
const buildingsOut = ways.filter((w) => w.tags?.building).map((w) => ({ roof: w.id === homeId ? 'depot' : ['roof', 'roof-red', 'roof'][hash(w.id) % 3], poly: toPx(simplify(geom(w), 0.1)) })).filter((b) => b.poly.length >= 3);
const railways = ways.filter((w) => w.tags?.railway === 'rail').map((w) => ({ layer: layerOf(w.tags), bridge: bridgeOf(w.tags), points: toPx(simplify(geom(w))) }));

const cityMap = {
  source: `OpenStreetMap, ${data.address}, Radius ${radiusM} m`,
  pxPerMeter: PX_PER_M,
  width: mpx(W),
  height: mpx(H),
  spawn: { x: mpx(depot.x + 0.5), y: mpx(depot.y + 0.5), heading: depotHeading },
  zones,
  routes,
  areas,
  waterways,
  roads,
  paths,
  railways,
  buildings: buildingsOut,
  closure: towardA ? { x: mpx(towardA.x + 0.5), y: mpx(towardA.y + 0.5), heading: heading(towardA), width: 5 * PX_PER_M * 3 } : null,
  overview: { image: 'maps/city-overview.png', metersPerPixel: METERS_PER_TILE },
};
fs.mkdirSync('assets/maps', { recursive: true });
fs.writeFileSync('assets/maps/city.json', JSON.stringify(cityMap));

// Übersichtskarte: 1 Pixel pro Tile (4 m) aus der Tile-Rasterung
{
  const { Canvas } = await import('./png.mjs');
  const col = { grass: P.olive, 'grass-alt': P.oliveLight, road: P.asphaltLight, 'road-line-h': P.asphaltLight, 'road-line-v': P.asphaltLight, sidewalk: P.concrete, 'wall-a': P.brownLight, 'wall-b': P.tan, roof: P.grayLight, fence: P.brownLight, tree: P.green, water: P.water, construction: P.red, 'depot-floor': P.grayLight, 'depot-wall': P.thwBlueLight, field: P.brownLight, 'road-edge-h': P.gray, 'road-edge-v': P.gray, 'roof-blue': P.thwBlueLight, 'roof-red': P.red, flower: P.oliveLight, gravel: P.concrete, marker: P.yellow, empty: P.black };
  const c = new Canvas(W, H, P.olive);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = buildings[y * W + x] || ground[y * W + x];
    c.set(x, y, col[TILES[v - 1]] ?? P.olive);
  }
  c.save('assets/maps/city-overview.png');
}
try { fs.unlinkSync('assets/maps/city.tmj'); } catch { /* war schon weg */ }
const kb = Math.round(fs.statSync('assets/maps/city.json').size / 1024);
console.log(`geschrieben: assets/maps/city.json (${kb} KB): ${roads.length} Straßen, ${buildingsOut.length} Gebäude, ${areas.length} Flächen; Unterkunft ${zones[0].street}, Einsätze ${zones[1].street} / ${zones[2].street}`);
