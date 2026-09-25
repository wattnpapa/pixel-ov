/**
 * Sound-Manager. Im MVP ohne Ton: alle Aufrufe sind Leerstellen, damit die
 * Spiel-Logik schon jetzt an den richtigen Stellen Sounds anfordert.
 */
export type SoundId =
  | 'alarm'
  | 'click'
  | 'engine-start'
  | 'siren'
  | 'crash'
  | 'chainsaw'
  | 'pump'
  | 'task-done'
  | 'game-over'
  | 'mission-done';

class SoundManager {
  private muted = false;

  play(_id: SoundId, _opts?: { loop?: boolean; volume?: number }): void {
    /* Kein Sound im MVP. */
  }

  stop(_id: SoundId): void {
    /* Kein Sound im MVP. */
  }

  stopAll(): void {
    /* Kein Sound im MVP. */
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

export const Sound = new SoundManager();
