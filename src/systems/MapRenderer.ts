import Phaser from 'phaser';
import { PALETTE_HEX } from '../config/game';

/** Vektor-Karte, wie tools/gen-map-osm.mjs sie schreibt. Koordinaten in Pixeln (16 px pro Meter). */
export interface CityMap {
  pxPerMeter: number;
  width: number;
  height: number;
  spawn: { x: number; y: number; heading: number };
  zones: { name: string; kind: string; mission?: string; heading: number; street: string; x: number; y: number; w: number; h: number }[];
  routes: { name: string; sprite: string; speed: number; points: [number, number][] }[];
  areas: { kind: 'water' | 'forest' | 'field' | 'park' | 'gravel' | 'scrub'; poly: [number, number][] }[];
  waterways: { width: number; points: [number, number][] }[];
  roads: { cls: number; width: number; name: string; layer: number; bridge: boolean; points: [number, number][] }[];
  paths: { layer: number; bridge: boolean; points: [number, number][] }[];
  railways: { layer: number; bridge: boolean; points: [number, number][] }[];
  buildings: { roof: 'roof' | 'roof-red' | 'depot'; poly: [number, number][] }[];
  closure: { x: number; y: number; heading: number; width: number } | null;
  overview: { image: string; metersPerPixel: number };
}

type Pt = [number, number];

/** Kachelgröße in Pixeln (64 m). Muss ein Vielfaches der Texturkachel (64 px) sein. */
export const CHUNK = 1024;
/** Kollisionsraster in Pixeln: 8 px = 50 cm. */
export const CELL = 8;
const MAX_CHUNKS = 40;
const TILE = 64;
/** Reihenfolge im Tileset (tools/tiles.mjs). */
const TILE_INDEX: Record<string, number> = { grass: 0, 'grass-alt': 1, road: 2, sidewalk: 5, roof: 8, water: 11, 'depot-floor': 13, field: 15, 'roof-blue': 18, 'roof-red': 19, gravel: 21 };

function bboxOf(pts: Pt[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

/**
 * Zeichnet die Vektor-Karte kachelweise in Canvas-Texturen rund um die Kamera und
 * hält ein Kollisionsraster (Gebäude, Wasser, Wald, Sperrung) in 50-cm-Zellen.
 */
export class MapRenderer {
  readonly map: CityMap;
  readonly cols: number;
  readonly rows: number;
  private chunks = new Map<string, Phaser.GameObjects.Image>();
  private buckets = new Map<string, { areas: number[]; roads: number[]; paths: number[]; buildings: number[]; waterways: number[]; railways: number[] }>();
  private patterns = new Map<string, HTMLCanvasElement>();
  private blocked: Uint8Array;
  private gridW: number;
  private gridH: number;
  private lastCenter = { cx: -1, cy: -1 };

  constructor(private scene: Phaser.Scene, map: CityMap) {
    this.map = map;
    this.cols = Math.ceil(map.width / CHUNK);
    this.rows = Math.ceil(map.height / CHUNK);
    this.gridW = Math.ceil(map.width / CELL);
    this.gridH = Math.ceil(map.height / CELL);
    this.blocked = new Uint8Array(this.gridW * this.gridH);
    this.buildPatterns();
    this.buildIndex();
    this.buildCollision();
  }

  // ------------------------------------------------------------ Aufbau

  private buildPatterns(): void {
    const src = this.scene.textures.get('city-tileset').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    for (const [name, idx] of Object.entries(TILE_INDEX)) {
      const c = document.createElement('canvas');
      c.width = TILE;
      c.height = TILE;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, (idx % 8) * TILE, Math.floor(idx / 8) * TILE, TILE, TILE, 0, 0, TILE, TILE);
      this.patterns.set(name, c);
    }
  }

  private bucketKeysFor(bbox: [number, number, number, number], margin: number): string[] {
    const keys: string[] = [];
    const cx0 = Math.max(0, Math.floor((bbox[0] - margin) / CHUNK));
    const cy0 = Math.max(0, Math.floor((bbox[1] - margin) / CHUNK));
    const cx1 = Math.min(this.cols - 1, Math.floor((bbox[2] + margin) / CHUNK));
    const cy1 = Math.min(this.rows - 1, Math.floor((bbox[3] + margin) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) keys.push(`${cx},${cy}`);
    return keys;
  }

  private buildIndex(): void {
    const add = (kind: 'areas' | 'roads' | 'paths' | 'buildings' | 'waterways' | 'railways', i: number, pts: Pt[], margin: number) => {
      for (const key of this.bucketKeysFor(bboxOf(pts), margin)) {
        let b = this.buckets.get(key);
        if (!b) { b = { areas: [], roads: [], paths: [], buildings: [], waterways: [], railways: [] }; this.buckets.set(key, b); }
        b[kind].push(i);
      }
    };
    this.map.areas.forEach((a, i) => add('areas', i, a.poly, 64));
    this.map.waterways.forEach((w, i) => add('waterways', i, w.points, w.width));
    this.map.roads.forEach((r, i) => add('roads', i, r.points, r.width + 64));
    this.map.paths.forEach((p, i) => add('paths', i, p.points, 32));
    this.map.railways.forEach((r, i) => add('railways', i, r.points, 32));
    this.map.buildings.forEach((b, i) => add('buildings', i, b.poly, 8));
  }

  private fillPolygonCells(poly: Pt[]): void {
    const [, y0, , y1] = bboxOf(poly);
    const r0 = Math.max(0, Math.floor(y0 / CELL));
    const r1 = Math.min(this.gridH - 1, Math.floor(y1 / CELL));
    for (let r = r0; r <= r1; r++) {
      const cy = (r + 0.5) * CELL;
      const xs: number[] = [];
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const c0 = Math.max(0, Math.floor(xs[i] / CELL));
        const c1 = Math.min(this.gridW - 1, Math.floor(xs[i + 1] / CELL));
        for (let c = c0; c <= c1; c++) this.blocked[r * this.gridW + c] = 1;
      }
    }
  }

  /** Setzt alle Zellen entlang einer Linie mit Breite auf den Wert (Straßen schneiden Wald, Wasser und Gebäude frei). */
  /** Parallel verschobene Linie (positiv = rechts in Fahrtrichtung). */
  private offsetLine(pts: Pt[], d: number): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[Math.max(0, i - 1)];
      const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      out.push([pts[i][0] - ((by - ay) / len) * d, pts[i][1] + ((bx - ax) / len) * d]);
    }
    return out;
  }

  private strokeCells(pts: Pt[], width: number, value: number, keep?: number): void {
    const r = width / 2 / CELL;
    const r2 = r * r;
    const ri = Math.ceil(r);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(len / (CELL / 2)));
      for (let s = 0; s <= steps; s++) {
        const cx = (ax + ((bx - ax) * s) / steps) / CELL;
        const cy = (ay + ((by - ay) * s) / steps) / CELL;
        const c0 = Math.max(0, Math.floor(cx - ri)), c1 = Math.min(this.gridW - 1, Math.ceil(cx + ri));
        const r0 = Math.max(0, Math.floor(cy - ri)), r1 = Math.min(this.gridH - 1, Math.ceil(cy + ri));
        for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
          const dx = col + 0.5 - cx, dy = row + 0.5 - cy;
          if (dx * dx + dy * dy <= r2 && (keep === undefined || this.blocked[row * this.gridW + col] !== keep)) this.blocked[row * this.gridW + col] = value;
        }
      }
    }
  }

  private buildCollision(): void {
    for (const b of this.map.buildings) this.fillPolygonCells(b.poly);
    for (const a of this.map.areas) if (a.kind === 'water' || a.kind === 'forest') this.fillPolygonCells(a.poly);
    for (const w of this.map.waterways) this.strokeCells(w.points, w.width, 1);
    // Straßen sind frei (Wert 3), auch wo Flächen oder Bäche sie überlappen (Brücken, Waldränder bis zur Fahrbahnmitte)
    const m = this.map.pxPerMeter;
    for (const r of this.map.roads) this.strokeCells(r.points, r.width + (r.cls === 1 ? 3 * m : 16), 3);
    // Gleise sperren, außer an Bahnübergängen; Brückengeländer sperren, außer wo eine Straße darunter durchführt
    for (const rw of this.map.railways) this.strokeCells(rw.points, 3 * m, 1, 3);
    for (const r of this.map.roads) if (r.bridge) for (const side of [-1, 1]) this.strokeCells(this.offsetLine(r.points, side * (r.width / 2 + 0.6 * m)), 0.8 * m, 1, 3);
    const c = this.map.closure;
    if (c) {
      // Sperrung: Balken quer zur Straße
      const rad = (c.heading * Math.PI) / 180;
      const nx = -Math.sin(rad), ny = Math.cos(rad);
      const half = c.width / 2;
      const thick = 24;
      const poly: Pt[] = [
        [c.x + nx * half - Math.cos(rad) * thick, c.y + ny * half - Math.sin(rad) * thick],
        [c.x + nx * half + Math.cos(rad) * thick, c.y + ny * half + Math.sin(rad) * thick],
        [c.x - nx * half + Math.cos(rad) * thick, c.y - ny * half + Math.sin(rad) * thick],
        [c.x - nx * half - Math.cos(rad) * thick, c.y - ny * half - Math.sin(rad) * thick],
      ];
      this.fillPolygonCells(poly);
    }
  }

  /** Ist die Weltposition blockiert (Gebäude, Wasser, Wald, Sperrung, Kartenrand)? */
  isBlocked(x: number, y: number): boolean {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= this.gridW || r >= this.gridH) return true;
    return this.blocked[r * this.gridW + c] === 1;
  }

  // ------------------------------------------------------------ Zeichnen

  /** Kacheln rund um die Kamera bereitstellen; weit entfernte freigeben. */
  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    const view = cam.worldView;
    const cx0 = Math.max(0, Math.floor(view.x / CHUNK) - 1);
    const cy0 = Math.max(0, Math.floor(view.y / CHUNK) - 1);
    const cx1 = Math.min(this.cols - 1, Math.floor(view.right / CHUNK) + 1);
    const cy1 = Math.min(this.rows - 1, Math.floor(view.bottom / CHUNK) + 1);
    const center = { cx: Math.floor(view.centerX / CHUNK), cy: Math.floor(view.centerY / CHUNK) };
    if (center.cx === this.lastCenter.cx && center.cy === this.lastCenter.cy && this.chunks.size > 0) return;
    this.lastCenter = center;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.ensureChunk(cx, cy);
    if (this.chunks.size > MAX_CHUNKS) {
      const far = [...this.chunks.keys()]
        .map((k) => { const [x, y] = k.split(',').map(Number); return { k, d: Math.hypot(x - center.cx, y - center.cy) }; })
        .sort((a, b) => b.d - a.d)
        .slice(0, this.chunks.size - MAX_CHUNKS);
      for (const { k } of far) this.dropChunk(k);
    }
  }

  private dropChunk(key: string): void {
    const img = this.chunks.get(key);
    if (!img) return;
    img.destroy();
    this.scene.textures.remove(`chunk-${key}`);
    this.chunks.delete(key);
  }

  private ensureChunk(cx: number, cy: number): void {
    const key = `${cx},${cy}`;
    if (this.chunks.has(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK;
    canvas.height = CHUNK;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(-cx * CHUNK, -cy * CHUNK);
    this.drawChunk(ctx, cx, cy);
    const texKey = `chunk-${key}`;
    this.scene.textures.addCanvas(texKey, canvas);
    const img = this.scene.add.image(cx * CHUNK, cy * CHUNK, texKey).setOrigin(0).setDepth(0);
    this.chunks.set(key, img);
  }

  private pattern(ctx: CanvasRenderingContext2D, name: string): CanvasPattern {
    return ctx.createPattern(this.patterns.get(name)!, 'repeat')!;
  }

  private path(ctx: CanvasRenderingContext2D, pts: Pt[], close = false): void {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (close) ctx.closePath();
  }

  private drawChunk(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const b = this.buckets.get(`${cx},${cy}`);
    const m = this.map;
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    // Grund: Gras
    ctx.fillStyle = this.pattern(ctx, 'grass');
    ctx.fillRect(x0, y0, CHUNK, CHUNK);
    if (!b) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Flächen
    for (const i of b.areas) {
      const a = m.areas[i];
      const pat = a.kind === 'water' ? 'water' : a.kind === 'field' ? 'field' : a.kind === 'gravel' ? 'gravel' : a.kind === 'park' ? 'grass-alt' : a.kind === 'forest' ? 'grass-alt' : 'grass';
      this.path(ctx, a.poly, true);
      ctx.fillStyle = this.pattern(ctx, pat);
      ctx.fill();
      if (a.kind === 'forest' || a.kind === 'scrub') this.drawTrees(ctx, a.poly, a.kind === 'forest' ? 48 : 96, x0, y0);
    }
    for (const i of b.waterways) {
      const w = m.waterways[i];
      this.path(ctx, w.points);
      ctx.strokeStyle = this.pattern(ctx, 'water');
      ctx.lineWidth = w.width;
      ctx.stroke();
    }
    // Verkehrswege nach Ebene: Tunnel und Unterführungen zuerst, dann Boden, dann Brücken
    const roads = b.roads.map((i) => m.roads[i]);
    const paths = b.paths.map((i) => m.paths[i]);
    const rails = b.railways.map((i) => m.railways[i]);
    const layers = [...new Set([...roads, ...paths, ...rails].map((f) => f.layer))].sort((p, q) => p - q);
    for (const layer of layers) {
      const lr = roads.filter((r) => r.layer === layer);
      const lp = paths.filter((p) => p.layer === layer);
      const lrw = rails.filter((r) => r.layer === layer);
      const mp = m.pxPerMeter;
      if (layer > 0) {
        // Brückenschatten und Geländer, gerade Deckenden
        ctx.lineCap = 'butt';
        ctx.save();
        ctx.translate(6, 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        for (const r of lr) { this.path(ctx, r.points); ctx.lineWidth = r.width + 2 * mp; ctx.stroke(); }
        for (const r of lrw) { this.path(ctx, r.points); ctx.lineWidth = 4 * mp; ctx.stroke(); }
        for (const p of lp) { this.path(ctx, p.points); ctx.lineWidth = 2.5 * mp; ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = PALETTE_HEX.concrete;
        for (const r of lr) { this.path(ctx, r.points); ctx.lineWidth = r.width + 2 * mp; ctx.stroke(); }
        for (const r of lrw) { this.path(ctx, r.points); ctx.lineWidth = 4 * mp; ctx.stroke(); }
        for (const p of lp) { this.path(ctx, p.points); ctx.lineWidth = 2.5 * mp; ctx.stroke(); }
        ctx.strokeStyle = PALETTE_HEX.grayLight;
        for (const r of lr) { this.path(ctx, r.points); ctx.lineWidth = r.width + 1.2 * mp; ctx.stroke(); }
        ctx.lineCap = 'round';
      }
      // Bahn: Schotterbett und Schwellen
      for (const r of lrw) {
        this.path(ctx, r.points);
        ctx.strokeStyle = this.pattern(ctx, 'gravel');
        ctx.lineWidth = 3 * mp;
        ctx.stroke();
        ctx.strokeStyle = PALETTE_HEX.brownDark;
        ctx.lineWidth = 2.4 * mp;
        ctx.setLineDash([5, 11]);
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
      }
      // Wege
      for (const p of lp) {
        this.path(ctx, p.points);
        ctx.strokeStyle = this.pattern(ctx, 'gravel');
        ctx.lineWidth = 1.5 * mp;
        ctx.stroke();
      }
      // Straßen: Gehwege der Stadtstraßen (nicht auf Brücken), Asphalt nach Klasse, Mittellinien
      ctx.strokeStyle = this.pattern(ctx, 'sidewalk');
      for (const r of lr) {
        if (r.cls !== 1 || r.bridge) continue;
        this.path(ctx, r.points);
        ctx.lineWidth = r.width + 3 * mp;
        ctx.stroke();
      }
      ctx.strokeStyle = this.pattern(ctx, 'road');
      for (const cls of [3, 1, 2]) for (const r of lr) {
        if (r.cls !== cls) continue;
        this.path(ctx, r.points);
        ctx.lineWidth = r.width;
        ctx.stroke();
      }
      ctx.strokeStyle = PALETTE_HEX.concreteLight;
      ctx.lineWidth = 3;
      ctx.setLineDash([32, 32]);
      for (const r of lr) {
        if (r.width < 5.5 * mp) continue;
        this.path(ctx, r.points);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Schienen zuletzt, damit sie an Bahnübergängen über der Straße liegen
      ctx.strokeStyle = PALETTE_HEX.grayLight;
      ctx.lineWidth = 3;
      for (const r of lrw) for (const side of [-1, 1]) { this.path(ctx, this.offsetLine(r.points, side * 0.75 * mp)); ctx.stroke(); }
    }
    // Gebäude
    for (const i of b.buildings) {
      const bd = m.buildings[i];
      this.path(ctx, bd.poly, true);
      ctx.fillStyle = this.pattern(ctx, bd.roof === 'depot' ? 'roof-blue' : bd.roof);
      ctx.fill();
      ctx.strokeStyle = PALETTE_HEX.dark;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (bd.roof === 'depot') {
        ctx.strokeStyle = PALETTE_HEX.yellow;
        ctx.lineWidth = 6;
        ctx.setLineDash([24, 12]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Sperrung
    const c = m.closure;
    if (c && Math.abs(c.x - (x0 + CHUNK / 2)) < CHUNK && Math.abs(c.y - (y0 + CHUNK / 2)) < CHUNK) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate((c.heading * Math.PI) / 180);
      const half = c.width / 2;
      for (let y = -half; y < half; y += 16) {
        ctx.fillStyle = Math.floor((y + half) / 16) % 2 ? PALETTE_HEX.white : PALETTE_HEX.red;
        ctx.fillRect(-12, y, 24, 16);
      }
      ctx.fillStyle = PALETTE_HEX.dark;
      ctx.fillRect(-14, -half, 4, c.width);
      ctx.fillRect(10, -half, 4, c.width);
      ctx.restore();
    }
  }

  private drawTrees(ctx: CanvasRenderingContext2D, poly: Pt[], spacing: number, x0: number, y0: number): void {
    ctx.save();
    this.path(ctx, poly, true);
    ctx.clip();
    const [bx0, by0, bx1, by1] = bboxOf(poly);
    const sx = Math.max(bx0, x0 - spacing), sy = Math.max(by0, y0 - spacing);
    const ex = Math.min(bx1, x0 + CHUNK + spacing), ey = Math.min(by1, y0 + CHUNK + spacing);
    for (let y = Math.floor(sy / spacing) * spacing; y < ey; y += spacing) for (let x = Math.floor(sx / spacing) * spacing; x < ex; x += spacing) {
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const jx = (h % 1000) / 1000 - 0.5, jy = ((h >> 10) % 1000) / 1000 - 0.5;
      const px = x + jx * spacing * 0.8, py = y + jy * spacing * 0.8;
      const r = 14 + (h % 7);
      ctx.fillStyle = PALETTE_HEX.oliveDark;
      ctx.beginPath(); ctx.arc(px + 4, py + 4, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE_HEX.green;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE_HEX.greenLight;
      ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  destroy(): void {
    for (const k of [...this.chunks.keys()]) this.dropChunk(k);
  }
}
