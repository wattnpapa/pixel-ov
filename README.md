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

Vom Startbildschirm aus gibt es außerdem „Freies Fahren": Stadtkarte ohne Auftrag, Timer und Ziel, V wechselt das Fahrzeug, ESC führt zurück.

Steuerung: Maus oder Touch in den Seitenansichten, Pfeiltasten oder WASD im Fahrmodus, Leertaste für das Sondersignal, M für die große Übersichtskarte, F für Vollbild, Ziffern 1 bis 9 für Dialogoptionen, Enter oder Klick zum Weiterblättern. Auf Touch-Geräten erscheinen im Fahrmodus virtuelle Tasten.

Drei Fehlerklassen: Sicherheitsverstoß (Game Over, Einsatz beginnt vor Ort neu), Ablauffehler (Zeitstrafe), Ausstattungsfehler (Nachalarmierung des anderen Fahrzeugs, Zeit läuft weiter). Wer die Nachbereitung auslässt, hat beim nächsten Einsatz ein Gerät, das nicht anspringt.

## Neue Einsatzstellen

Eine Einsatzstelle ist eine `MissionDef` in `src/config/missions/`: Hintergrund, Hotspots, Props und eine Aufgabenliste mit Voraussetzungen (`requires`), Sicherheitsregeln (`safety`), Reihenfolgeregeln (`softOrder`), benötigter Ausrüstung (`equipment`), Auswahl-Dialogen (`choice`) und Reihenfolge-Minispielen (`minigame`). Der Automat in `src/systems/TaskMachine.ts` wertet das aus, die Szene `SideScene` braucht keine Änderung. Neue Einsatzstellen brauchen zusätzlich eine Zone in `assets/maps/city.json` (Feld `zones`, `kind: mission` mit der Missions-ID; der Generator in `tools/gen-map-osm.mjs` legt sie an) und einen Eintrag in `src/config/campaign.ts`.

## Veröffentlichen (GitHub Pages)

Der Workflow `.github/workflows/deploy-pages.yml` baut bei jedem Push auf `main` und veröffentlicht `dist/` über GitHub Pages. Einmalig im Repository unter Settings > Pages als Source "GitHub Actions" wählen. Vite baut mit relativen Pfaden (`base: './'`), daher läuft die Seite auch unter `/pixel-ov/`.

## Assets

Alle Grafiken liegen in `assets/` (Vite `publicDir`) und werden über feste Pfade geladen. Die aktuellen Dateien sind generierte Platzhalter. Jede Datei kann durch eine gepixelte Version gleicher Größe ersetzt werden, ohne Code anzufassen.

```
node tools/gen-assets.mjs   # Platzhalter-Sprites, Hintergründe, Tileset (Texturen für die Karte), Pixelfont neu erzeugen
```

### Echte Karte aus OpenStreetMap (Oldenburg, Artillerieweg 59)

```
node tools/fetch-osm.mjs                 # holt Straßen, Gebäude, Wasser, Grünflächen im 1-km-Umkreis nach data/osm/
node tools/gen-map-osm.mjs               # schreibt daraus assets/maps/city.json (Vektorkarte) und city-overview.png
```

Der Abruf braucht Netzzugang zu `nominatim.openstreetmap.org` (Adresse) und `overpass-api.de` (Daten). Die heruntergeladene Datei liegt eingecheckt unter `data/osm/oldenburg-artillerieweg.json` (Stand siehe `fetchedAt` darin), damit der Generator ohne Netz läuft.

Die Karte ist keine Tilemap mehr, sondern Vektorgeometrie in Pixeln (16 px pro Meter): Straßen als Polylinien mit Breite nach Klasse, Gebäude und Flächen als Polygone. `src/systems/MapRenderer.ts` zeichnet daraus zur Laufzeit 64-m-Kacheln in Canvas-Texturen rund um die Kamera (mit den Texturen aus dem Tileset als Muster) und hält ein Kollisionsraster in 50-cm-Zellen für Gebäude, Wasser, Wald und die Sperrung. Die Übersichtskarte (M) ist ein 500 x 500-Bild mit 4 m pro Pixel. Unterkunft, beide Einsatzzonen, die Sperrung und die Zivilrouten platziert der Generator automatisch auf dem Straßennetz: Unterkunft am nächsten Wohnstraßenpunkt zur Adresse (das Gebäude an der Adresse wird als THW-Halle gezeichnet), Einsatzadressen kommen aus den Straßennamen an den Zonen, Einsätze 550 bis 850 m entfernt in verschiedenen Richtungen, Sperrung auf dem Weg zum ersten Einsatz. Autobahn und Zufahrten sind befahrbar, bekommen aber weder Zonen noch Gehwege.

Raster und Auflösung:

- Szenen: 1280 x 720 px, füllen das Fenster bei 16:9 (Phaser FIT), F schaltet Vollbild; Fahrmodus zeigt 80 x 45 m
- Texturen: 64 x 64 px im Tileset `assets/tiles/city-tileset.png` (Reihenfolge in `tools/tiles.mjs`), als Muster für Gras, Asphalt, Gehweg, Dächer, Wasser, Kies, Feld; Draufsicht-Fahrzeuge 80 x 40 (MTW), 112 x 48 (GKW), 72 x 36 (Zivil) bei 16 px pro Meter
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
