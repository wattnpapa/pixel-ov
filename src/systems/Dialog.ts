import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../config/game';
import { Sound } from './Sound';

export const FONT = 'pixel';
export const LINE_H = 18;

/**
 * Dialogbox am unteren Bildrand: schwarz, weißer Text. Blockiert Hotspot-Klicks,
 * solange sie offen ist. Maus und Touch werden gleich behandelt.
 */
export class Dialog {
  private container: Phaser.GameObjects.Container;
  private open = false;
  private onDismiss: (() => void) | null = null;
  private onClose: (() => void) | null = null;
  private enterKey?: Phaser.Input.Keyboard.Key;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(900).setScrollFactor(0).setVisible(false);
    const kb = scene.input.keyboard;
    if (kb) {
      this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.enterKey.on('down', () => this.onDismiss?.());
    }
    scene.input.on('pointerdown', () => {
      // Erst im nächsten Tick, damit ein Klick, der die Box öffnet, sie nicht sofort schließt.
      const cb = this.onDismiss;
      if (cb) scene.time.delayedCall(0, () => cb());
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.enterKey?.removeAllListeners());
  }

  isOpen(): boolean {
    return this.open;
  }

  private clear(): void {
    this.container.removeAll(true);
    this.onDismiss = null;
  }

  private buildBox(height: number): void {
    const y = GAME_HEIGHT - height;
    const bg = this.scene.add.rectangle(0, y, GAME_WIDTH, height, PALETTE.black).setOrigin(0).setInteractive();
    const line = this.scene.add.rectangle(0, y, GAME_WIDTH, 2, PALETTE.white).setOrigin(0);
    this.container.add([bg, line]);
    this.container.setVisible(true);
    this.open = true;
  }

  private textHeight(text: string, maxWidth: number): { obj: Phaser.GameObjects.BitmapText; h: number } {
    const obj = this.scene.add.bitmapText(0, 0, FONT, text).setMaxWidth(maxWidth);
    const h = obj.getTextBounds().local.height;
    return { obj, h };
  }

  /** Zeigt Text und wartet auf Klick, Tipp oder Enter. */
  say(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.clear();
      const { obj, h } = this.textHeight(text, GAME_WIDTH - 32);
      const height = Math.max(80, h + 44);
      this.buildBox(height);
      obj.setPosition(16, GAME_HEIGHT - height + 14);
      const hint = this.scene.add.bitmapText(GAME_WIDTH - 16, GAME_HEIGHT - 20, FONT, '[weiter]').setOrigin(1, 0).setTint(PALETTE.grayLight);
      this.container.add([obj, hint]);
      this.scene.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
      this.onDismiss = () => {
        Sound.play('click');
        this.close();
        resolve();
      };
    });
  }

  /** Zeigt eine Frage mit Optionen und liefert den Index der gewählten Option. */
  choose(prompt: string, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.clear();
      const { obj, h } = this.textHeight(prompt, GAME_WIDTH - 32);
      const optH = 22;
      const height = Math.min(GAME_HEIGHT, h + 32 + options.length * optH);
      this.buildBox(height);
      const top = GAME_HEIGHT - height + 12;
      obj.setPosition(16, top);
      this.container.add(obj);
      const pick = (i: number) => {
        Sound.play('click');
        this.close();
        resolve(i);
      };
      // Tastatur: Ziffern 1-9 wählen die Option direkt.
      const kb = this.scene.input.keyboard;
      if (kb) {
        const handler = (ev: KeyboardEvent) => {
          const n = parseInt(ev.key, 10);
          if (n >= 1 && n <= options.length) pick(n - 1);
        };
        kb.on('keydown', handler);
        this.onClose = () => kb.off('keydown', handler);
      }
      options.forEach((label, i) => {
        const y = top + h + 8 + i * optH;
        const row = this.scene.add
          .rectangle(8, y - 2, GAME_WIDTH - 16, optH, PALETTE.dark)
          .setOrigin(0)
          .setInteractive({ useHandCursor: true });
        const txt = this.scene.add.bitmapText(28, y + 2, FONT, `${i + 1}. ${label}`).setTint(PALETTE.yellow);
        row.on('pointerover', () => row.setFillStyle(PALETTE.grayDark));
        row.on('pointerout', () => row.setFillStyle(PALETTE.dark));
        row.on('pointerdown', () => pick(i));
        this.container.add([row, txt]);
      });
    });
  }

  /** Kurzer Hinweis oben, ohne Blockade. */
  toast(text: string, ms = 1800): void {
    const box = this.scene.add.container(0, 0).setDepth(890).setScrollFactor(0);
    const t = this.scene.add.bitmapText(GAME_WIDTH / 2, 60, FONT, text).setOrigin(0.5, 0).setMaxWidth(GAME_WIDTH - 40).setCenterAlign();
    const b = t.getTextBounds().local;
    const bg = this.scene.add.rectangle(GAME_WIDTH / 2, 60 + b.height / 2, b.width + 20, b.height + 12, PALETTE.black, 0.85);
    box.add([bg, t]);
    this.scene.time.delayedCall(ms, () => box.destroy());
  }

  close(): void {
    this.onClose?.();
    this.onClose = null;
    this.clear();
    this.container.setVisible(false);
    this.open = false;
  }
}
