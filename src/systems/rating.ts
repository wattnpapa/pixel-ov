import type { MissionProgress } from './GameState';

/** Bewertung als Text: Zeit gegen Richtzeit, Ablauffehler, optionale Aufgaben, Tote. */
export function rateMission(p: MissionProgress, parTimeMs: number, optionalDone: number, optionalTotal: number): string {
  if (p.gameOvers > 0) return 'Das üben wir nochmal';
  const timeFactor = p.elapsedMs / parTimeMs;
  if (timeFactor <= 1 && p.procedureErrors === 0 && optionalDone === optionalTotal && !p.reinforcement) return 'Sehr gut';
  if (timeFactor <= 1.5 && p.procedureErrors <= 1) return 'Gut';
  if (timeFactor <= 2.5 || p.procedureErrors <= 3) return 'Geht so';
  return 'Das üben wir nochmal';
}
