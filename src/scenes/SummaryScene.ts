import Phaser from 'phaser';
import { SCENES } from '../config/game';
import { fullscreenText } from '../systems/ui';
import { onceAnyPointer } from '../systems/Input';
import { formatTime, reset, state } from '../systems/GameState';

/** Endbildschirm nach drei Einsätzen mit Gesamtbewertung. */
export class SummaryScene extends Phaser.Scene {
  constructor() {
    super(SCENES.summary);
  }

  create(): void {
    const h = state().history;
    const lines = h.map((r, i) => `${i + 1}. ${r.title}: ${formatTime(r.elapsedMs)}, ${r.procedureErrors} Fehler, ${r.rating}`);
    const total = h.reduce((a, r) => a + r.elapsedMs, 0);
    const errors = h.reduce((a, r) => a + r.procedureErrors, 0);
    const deaths = h.reduce((a, r) => a + r.gameOvers, 0);
    const verdict = deaths === 0 && errors <= 2 ? 'Der Ortsverband ist einsatzbereit.' : deaths === 0 ? 'Alle heil zurück. Die Abläufe üben wir nochmal.' : `${deaths} Mal gestorben. Das Gespräch mit dem Ortsbeauftragten wird länger.`;
    const body = `${lines.join('\n')}\n\nGesamt: ${formatTime(total)}, ${errors} Ablauffehler\n\n${verdict}`;
    fullscreenText(this, 'DIENSTENDE', body, 'Drücke für einen neuen Durchgang');
    this.time.delayedCall(800, () => {
      onceAnyPointer(this, () => {
        reset();
        this.scene.start(SCENES.hall);
      });
    });
  }
}
