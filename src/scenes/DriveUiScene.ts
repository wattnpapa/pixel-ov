import Phaser from 'phaser';
import { SCENES } from '../config/game';
import type { DriveInput } from '../systems/Input';
import { Dialog } from '../systems/Dialog';
import { Hud } from '../systems/ui';

export interface DriveUiData {
  input: DriveInput;
}

/**
 * Overlay über dem Fahrmodus. Läuft parallel zur DriveScene mit Kamera-Zoom 1,
 * damit HUD, Hinweise und Touch-Tasten scharf bleiben, während die Welt 2x gezoomt ist.
 */
export class DriveUiScene extends Phaser.Scene {
  hud!: Hud;
  private dialog!: Dialog;

  constructor() {
    super(SCENES.driveUi);
  }

  create(data: DriveUiData): void {
    this.hud = new Hud(this);
    this.dialog = new Dialog(this);
    data.input.attachTouchButtons(this);
  }

  toast(text: string, ms?: number): void {
    this.dialog?.toast(text, ms);
  }
}
