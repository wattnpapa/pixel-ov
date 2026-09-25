import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../config/game';

/** Abstrakter Zustand der Fahrsteuerung, unabhängig von Tastatur oder Touch. */
export interface DriveControls {
  left: boolean;
  right: boolean;
  throttle: boolean;
  brake: boolean;
  siren: boolean;
  /** Sondersignal wurde in diesem Frame umgeschaltet */
  sirenToggled: boolean;
}

interface TouchButton {
  key: keyof Omit<DriveControls, 'sirenToggled'>;
  zone: Phaser.GameObjects.Rectangle;
  held: boolean;
}

/**
 * Liest Tastatur (Pfeile / WASD / Leertaste) und bei Touch-Geräten virtuelle
 * Tasten. Die Szene ruft pro Frame `read()` auf.
 */
export class DriveInput {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private buttons: TouchButton[] = [];
  private sirenOn = false;
  private sirenToggled = false;
  private touchSirenPending = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const map: Record<string, number> = {
        left: K.LEFT, right: K.RIGHT, up: K.UP, down: K.DOWN,
        a: K.A, d: K.D, w: K.W, s: K.S, space: K.SPACE,
      };
      for (const [name, code] of Object.entries(map)) this.keys[name] = kb.addKey(code);
      this.keys.space.on('down', () => this.toggleSiren());
    }
  }

  private toggleSiren(): void {
    this.sirenOn = !this.sirenOn;
    this.sirenToggled = true;
  }

  /** Virtuelle Tasten für Touch-Geräte, gezeichnet in der übergebenen (Overlay-)Szene. */
  attachTouchButtons(scene: Phaser.Scene): void {
    if (!scene.sys.game.device.input.touch) return;
    const mk = (key: TouchButton['key'], x: number, y: number, w: number, h: number, label: string) => {
      const zone = scene.add
        .rectangle(x, y, w, h, PALETTE.dark, 0.5)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(1000)
        .setStrokeStyle(4, PALETTE.grayLight)
        .setInteractive();
      scene.add.bitmapText(x + w / 2, y + h / 2, 'pixel', label).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
      const btn: TouchButton = { key, zone, held: false };
      zone.on('pointerdown', () => {
        if (key === 'siren') this.touchSirenPending = true;
        else btn.held = true;
      });
      const release = () => (btn.held = false);
      zone.on('pointerup', release);
      zone.on('pointerout', release);
      this.buttons.push(btn);
    };
    mk('left', 24, GAME_HEIGHT - 120, 104, 96, '<');
    mk('right', 144, GAME_HEIGHT - 120, 104, 96, '>');
    mk('brake', GAME_WIDTH - 248, GAME_HEIGHT - 120, 104, 96, '-');
    mk('throttle', GAME_WIDTH - 128, GAME_HEIGHT - 120, 104, 96, '+');
    mk('siren', GAME_WIDTH - 248, GAME_HEIGHT - 232, 224, 88, 'SOSI');
  }

  read(): DriveControls {
    if (this.touchSirenPending) {
      this.touchSirenPending = false;
      this.toggleSiren();
    }
    const k = this.keys;
    const held = (key: TouchButton['key']) => this.buttons.some((b) => b.key === key && b.held);
    const c: DriveControls = {
      left: (k.left?.isDown ?? false) || (k.a?.isDown ?? false) || held('left'),
      right: (k.right?.isDown ?? false) || (k.d?.isDown ?? false) || held('right'),
      throttle: (k.up?.isDown ?? false) || (k.w?.isDown ?? false) || held('throttle'),
      brake: (k.down?.isDown ?? false) || (k.s?.isDown ?? false) || held('brake'),
      siren: this.sirenOn,
      sirenToggled: this.sirenToggled,
    };
    this.sirenToggled = false;
    return c;
  }

  destroy(): void {
    this.keys.space?.removeAllListeners();
    this.buttons = [];
  }
}

/** Ein Klick oder Tipp irgendwo. Maus und Touch werden gleich behandelt. */
export function onceAnyPointer(scene: Phaser.Scene, cb: () => void): void {
  scene.input.once('pointerdown', cb);
}
