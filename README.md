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

Im Dev-Modus lässt sich direkt in eine Szene springen, mit frischem Spielstand:

```
http://localhost:5173/?scene=side&mission=storm-tree&vehicle=gkw
http://localhost:5173/?scene=side&mission=water-basement&vehicle=mtw
http://localhost:5173/?scene=drive&vehicle=gkw
```

## Spielablauf

Alarm am Monitor bestätigen, Fahrzeug wählen (MTW: wendig, nur Absperrmaterial; GKW: träge, volle Ausrüstung), durchs Tor, auf der Stadtkarte zur Einsatzstelle fahren und dort anhalten, Aufgaben abarbeiten, Rückfahrt, Nachbereitung an der Werkbank. Nach drei Einsätzen kommt der Endbildschirm.

Steuerung: Maus oder Touch in den Seitenansichten, Pfeiltasten oder WASD im Fahrmodus, Leertaste für das Sondersignal, Ziffern 1 bis 9 für Dialogoptionen, Enter oder Klick zum Weiterblättern. Auf Touch-Geräten erscheinen im Fahrmodus virtuelle Tasten.

Drei Fehlerklassen: Sicherheitsverstoß (Game Over, Einsatz beginnt vor Ort neu), Ablauffehler (Zeitstrafe), Ausstattungsfehler (Nachalarmierung des anderen Fahrzeugs, Zeit läuft weiter). Wer die Nachbereitung auslässt, hat beim nächsten Einsatz ein Gerät, das nicht anspringt.

## Neue Einsatzstellen

Eine Einsatzstelle ist eine `MissionDef` in `src/config/missions/`: Hintergrund, Hotspots, Props und eine Aufgabenliste mit Voraussetzungen (`requires`), Sicherheitsregeln (`safety`), Reihenfolgeregeln (`softOrder`), benötigter Ausrüstung (`equipment`), Auswahl-Dialogen (`choice`) und Reihenfolge-Minispielen (`minigame`). Der Automat in `src/systems/TaskMachine.ts` wertet das aus, die Szene `SideScene` braucht keine Änderung. Neue Einsatzstellen brauchen zusätzlich eine Zone in `assets/maps/city.tmj` (Objektlayer `Zonen`, Eigenschaft `mission`) und einen Eintrag in `src/config/campaign.ts`.

## Veröffentlichen (GitHub Pages)

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` und veröffentlicht `dist/` über GitHub Pages. Einmalig im Repository unter Settings > Pages als Source "GitHub Actions" wählen. Vite baut mit relativen Pfaden (`base: './'`), daher läuft die Seite auch unter `/pixel-ov/`.

## Assets

Alle Grafiken liegen in `assets/` (Vite `publicDir`) und werden über feste Pfade geladen. Die aktuellen Dateien sind generierte Platzhalter. Jede Datei kann durch eine gepixelte Version gleicher Größe ersetzt werden, ohne Code anzufassen.

```
node tools/gen-assets.mjs   # Platzhalter-Sprites, Hintergründe, Tileset, Pixelfont neu erzeugen
node tools/gen-map.mjs      # Schachbrett-Stadtkarte assets/maps/city.tmj neu erzeugen (Tiled-Format)
```

### Echte Karte aus OpenStreetMap (Oldenburg, Artillerieweg 59)

```
node tools/fetch-osm.mjs                 # holt Straßen, Gebäude, Wasser, Grünflächen im 1-km-Umkreis nach data/osm/
node tools/gen-map-osm.mjs               # rastert daraus assets/maps/city.tmj (4 m pro Tile = 64 px, 500 x 500 Tiles)
```

Der Abruf braucht Netzzugang zu `nominatim.openstreetmap.org` (Adresse) und `overpass-api.de` (Daten). Die heruntergeladene Datei wird eingecheckt, damit der Generator ohne Netz läuft. Unterkunft, beide Einsatzzonen, die Sperrung und die Zivilrouten platziert der Generator automatisch auf dem Straßennetz: Unterkunft am nächsten Straßen-Tile zur Adresse, Einsätze 550 bis 850 m entfernt in verschiedenen Richtungen, Sperrung auf dem Weg zum ersten Einsatz.

Raster und Auflösung:

- Szenen: 1280 x 720 px, Integer-Skalierung aufs Fenster (auf kleineren Bildschirmen passend verkleinert); Fahrmodus zeigt 20 x 11 Tiles bei Zoom 1
- Tiles: 64 x 64 px, Tileset `assets/tiles/city-tileset.png` (Reihenfolge in `tools/tiles.mjs`); Draufsicht-Fahrzeuge 80 x 40 (MTW), 112 x 48 (GKW), 72 x 36 (Zivil)
- Palette: `src/config/palette.json`, 36 Farben
- Schrift: 5 x 7 Glyphen, gerendert als 20 x 28 px in `assets/fonts/pixel-font.png` mit Zeichenliste in `pixel-font.json`
- Seitenansicht-Grafiken (Hintergründe 1280 x 720, GKW 448 x 192, MTW 256 x 144, Helfer 48 x 96) sind im Generator im 640 x 360-Raster notiert und werden verdoppelt gerendert

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
