// Holt OpenStreetMap-Daten rund um den Ortsverband und legt sie unter data/osm/ ab.
//   node tools/fetch-osm.mjs ["Adresse"] [Radius in m]
// Braucht Netzzugang zu nominatim.openstreetmap.org und overpass-api.de.
import fs from 'node:fs';

const address = process.argv[2] ?? 'Artillerieweg 59, 26129 Oldenburg';
const radius = Number(process.argv[3] ?? 1000);
const out = 'data/osm/oldenburg-artillerieweg.json';
const UA = 'einsatzbereit-map-generator (github.com/wattnpapa/pixel-ov)';

async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = await res.json();
  if (!json.length) throw new Error(`Adresse nicht gefunden: ${q}`);
  return { lat: Number(json[0].lat), lon: Number(json[0].lon), name: json[0].display_name };
}

async function overpass(center, r) {
  const dLat = r / 111320;
  const dLon = r / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = `${center.lat - dLat},${center.lon - dLon},${center.lat + dLat},${center.lon + dLon}`;
  const query = `[out:json][timeout:60];
(
  way["highway"](${bbox});
  way["building"](${bbox});
  way["natural"="water"](${bbox});
  way["waterway"](${bbox});
  way["landuse"](${bbox});
  way["leisure"~"park|pitch|garden|playground"](${bbox});
  way["natural"~"wood|scrub|grassland"](${bbox});
  way["railway"="rail"](${bbox});
);
out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return res.json();
}

const center = await geocode(address);
console.log('Zentrum:', center);
const osm = await overpass(center, radius);
console.log('Elemente:', osm.elements.length);
fs.mkdirSync('data/osm', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ address, center, radiusM: radius, fetchedAt: new Date().toISOString(), elements: osm.elements }));
console.log('geschrieben:', out);
