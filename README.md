# Einsatzbereit

Browserbasiertes 2D-Pixel-Spiel: Du führst einen THW-Ortsverband, bringst Fahrzeuge in den Einsatz und arbeitest Einsatzstellen ab. Zwei Ansichten wechseln sich ab: eine Top-down-Fahransicht auf der Stadtkarte und eine Seitenansicht (Fahrzeughalle, Einsatzstelle), in der die eigentliche Arbeit passiert.

## Entwicklung

```
npm install
npm run dev        # Spiel unter http://localhost:5173
npm run build      # Typecheck + Produktions-Build nach dist/
npm run preview    # gebauten Stand ansehen
```

Engine: Phaser 3, TypeScript, Vite. Statische Seite ohne Backend.

## Assets

Alle Grafiken liegen in `assets/` (Vite `publicDir`) und werden über feste Pfade geladen. Die aktuellen Dateien sind generierte Platzhalter. Jede Datei kann durch eine gepixelte Version gleicher Größe ersetzt werden, ohne Code anzufassen.

```
node tools/gen-assets.mjs   # Platzhalter-Sprites, Hintergründe, Tileset, Pixelfont neu erzeugen
node tools/gen-map.mjs      # Stadtkarte assets/maps/city.tmj neu erzeugen (Tiled-Format)
```

Raster und Auflösung:

- Szenen: 320 x 180 px, Integer-Skalierung aufs Fenster
- Tiles: 16 x 16 px, Tileset `assets/tiles/city-tileset.png` (Reihenfolge in `tools/tiles.mjs`)
- Palette: `src/config/palette.json`, 36 Farben
- Schrift: 5 x 7 px, `assets/fonts/pixel-5x7.png` mit Zeichenliste in `pixel-5x7.json`

## Projektstruktur

```
src/
  main.ts               Phaser-Konfiguration, Integer-Zoom
  config/               Fahrzeuge, Ausrüstung, Kampagne, Missionen (datengetrieben)
  scenes/               Boot, Halle, Fahrmodus, Einsatzstelle, Game Over, Zusammenfassung
  systems/              GameState (localStorage), Input, Dialog, TaskMachine, Sound (leer)
assets/                 Grafiken, Karten, Schrift
tools/                  Generatoren für Platzhalter-Assets und Karte
```
