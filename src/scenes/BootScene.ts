import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, SCENES } from '../config/game';
import { FONT } from '../systems/Dialog';
import { hasSave, load, reset } from '../systems/GameState';
import { applyDebugParams } from '../systems/debug';

interface FontMeta {
  image: string;
  width: number;
  height: number;
  chars: string;
  charsPerRow: number;
  spacingX: number;
  spacingY: number;
  lineSpacing: number;
}

/**
 * Lädt alle Assets aus assets/ und zeigt den Startbildschirm.
 * Jedes Asset hat einen sprechenden Key; die Dateien darunter lassen sich
 * ohne Codeänderung durch gepixelte Versionen gleicher Größe ersetzen.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.load.json('font-meta', 'fonts/pixel-font.json');
    this.load.image('font-image', 'fonts/pixel-font.png');
    this.load.image('city-tileset', 'tiles/city-tileset.png');
    this.load.json('city', 'maps/city.json');
    this.load.image('city-overview', 'maps/city-overview.png');
    for (const key of ['vehicle-mtw-top', 'vehicle-gkw-top', 'civil-car-a-top', 'civil-car-b-top', 'civil-car-c-top', 'vehicle-mtw-side', 'vehicle-gkw-side']) {
      this.load.image(key, `sprites/${key}.png`);
    }
    this.load.spritesheet('helper', 'sprites/helper.png', { frameWidth: 48, frameHeight: 96 });
    for (const key of ['hall-bg', 'storm-tree-bg', 'water-basement-bg']) this.load.image(key, `scenes/${key}.png`);

    const bar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0, 24, PALETTE.yellow);
    this.load.on('progress', (p: number) => (bar.width = p * 480));
  }

  create(): void {
    const meta = this.cache.json.get('font-meta') as FontMeta;
    const config: Phaser.Types.GameObjects.BitmapText.RetroFontConfig = {
      image: 'font-image',
      width: meta.width,
      height: meta.height,
      chars: meta.chars,
      charsPerRow: meta.charsPerRow,
      'spacing.x': meta.spacingX,
      'spacing.y': meta.spacingY,
      'offset.x': 0,
      'offset.y': 0,
      lineSpacing: meta.lineSpacing,
    };
    this.cache.bitmapFont.add(FONT, Phaser.GameObjects.RetroFont.Parse(this, config));

    this.anims.create({ key: 'helper-walk', frames: this.anims.generateFrameNumbers('helper', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'helper-idle', frames: [{ key: 'helper', frame: 0 }], frameRate: 1 });

    if (import.meta.env.DEV && applyDebugParams(this)) return;
    this.showTitle();
  }

  private showTitle(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, PALETTE.thwBlueDark).setOrigin(0);
    this.add.rectangle(0, 240, GAME_WIDTH, 16, PALETTE.yellow).setOrigin(0);
    this.add.bitmapText(GAME_WIDTH / 2, 112, FONT, 'EINSATZBEREIT').setOrigin(0.5, 0).setScale(2).setTint(PALETTE.white);
    this.add.bitmapText(GAME_WIDTH / 2, 280, FONT, 'Du führst einen THW-Ortsverband.\nDrei Einsätze. Keine Toten. Los.').setOrigin(0.5, 0).setCenterAlign().setTint(PALETTE.grayLight);

    const canContinue = hasSave() && load();
    const options = canContinue ? ['Weiter', 'Neu starten'] : ['Neues Spiel'];
    options.forEach((label, i) => {
      const y = 440 + i * 64;
      const row = this.add.rectangle(GAME_WIDTH / 2, y, 480, 52, PALETTE.thwBlue).setStrokeStyle(4, PALETTE.yellow).setInteractive({ useHandCursor: true });
      this.add.bitmapText(GAME_WIDTH / 2, y, FONT, label).setOrigin(0.5).setTint(PALETTE.white);
      row.on('pointerover', () => row.setFillStyle(PALETTE.thwBlueLight));
      row.on('pointerout', () => row.setFillStyle(PALETTE.thwBlue));
      row.on('pointerdown', () => {
        if (label !== 'Weiter') reset();
        this.scene.start(SCENES.hall);
      });
    });
    this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 88, FONT, 'Maus / Touch: klicken. Fahren: Pfeile oder WASD, Leertaste = Sondersignal, M = Karte, F = Vollbild').setOrigin(0.5, 0).setTint(PALETTE.gray).setMaxWidth(GAME_WIDTH - 40).setCenterAlign();
  }
}
