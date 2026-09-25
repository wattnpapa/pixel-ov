// Minimaler PNG-Encoder (RGBA, 8 Bit) ohne Abhängigkeiten.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

export class Canvas {
  constructor(width, height, fill = '#00000000') {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.rect(0, 0, width, height, fill);
  }
  set(x, y, hex) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b, a] = hexToRgba(hex);
    const i = (y * this.width + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }
  rect(x, y, w, h, hex) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, hex);
  }
  /** Gefüllter Kreis. */
  circle(cx, cy, r, hex) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      this.rect(cx - half, cy + dy, half * 2 + 1, 1, hex);
    }
  }
  outline(x, y, w, h, hex) {
    this.rect(x, y, w, 1, hex);
    this.rect(x, y + h - 1, w, 1, hex);
    this.rect(x, y, 1, h, hex);
    this.rect(x + w - 1, y, 1, h, hex);
  }
  /** Zeichnet ein Muster aus Zeilen-Strings; Zeichen -> Farbe laut Legende. '.' bleibt frei. */
  pattern(x, y, rows, legend) {
    rows.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        if (ch !== '.' && legend[ch]) this.set(x + rx, y + ry, legend[ch]);
      });
    });
  }
  /** Zufällig gestreute Pixel für Textur, deterministisch per Seed. */
  noise(x, y, w, h, hex, density, seed = 1) {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (rnd() < density) this.set(xx, yy, hex);
  }
  toPng() {
    const stride = this.width * 4;
    const raw = Buffer.alloc((stride + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (stride + 1)] = 0;
      Buffer.from(this.data.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.toPng());
    console.log('geschrieben:', file, `${this.width}x${this.height}`);
  }
}
