import { EQUIPMENT, type EquipmentDef, type EquipmentId } from '../config/equipment';
import type { MissionDef, TaskDef } from '../config/missions/types';

/** Was die Szene über den aktuellen Spielstand weiß; hält die Maschine frei von Phaser und GameState. */
export interface TaskContext {
  done: ReadonlySet<string>;
  hasEquipment(eq: EquipmentId): boolean;
  isServiced(eq: EquipmentId): boolean;
  repaired: ReadonlySet<EquipmentId>;
}

export type ClickResult =
  | { kind: 'idle'; text: string }
  | { kind: 'blocked'; text: string }
  | { kind: 'menu'; tasks: TaskDef[] }
  | { kind: 'task'; task: TaskDef };

export interface Preflight {
  gameOver?: string;
  missingEquipment?: { equipment: EquipmentId; text: string };
  penalties: { ms: number; text: string }[];
  repair?: EquipmentDef;
}

/**
 * Zustandsautomat für die Aufgaben einer Einsatzstelle. Reine Logik, datengetrieben
 * über MissionDef: welche Aufgaben es gibt, was sie voraussetzen, was bei Verstoß passiert.
 */
export class TaskMachine {
  constructor(readonly def: MissionDef) {}

  task(id: string): TaskDef | undefined {
    return this.def.tasks.find((t) => t.id === id);
  }

  private requiresMet(task: TaskDef, ctx: TaskContext): boolean {
    return (task.requires ?? []).every((r) => ctx.done.has(r));
  }

  /** Aufgaben, die jetzt angeboten werden dürfen. */
  available(ctx: TaskContext): TaskDef[] {
    return this.def.tasks.filter((t) => !ctx.done.has(t.id) && this.requiresMet(t, ctx));
  }

  onHotspot(hotspotId: string, ctx: TaskContext): ClickResult {
    const hotspot = this.def.hotspots.find((h) => h.id === hotspotId);
    const entryDone = ctx.done.has(this.def.entryTask);
    const candidates = this.def.tasks.filter((t) => t.hotspot === hotspotId && !ctx.done.has(t.id));
    if (!entryDone && !candidates.some((t) => t.id === this.def.entryTask)) {
      return { kind: 'blocked', text: 'Du sitzt noch im Fahrzeug. Erst aussteigen.' };
    }
    const open = candidates.filter((t) => this.requiresMet(t, ctx));
    if (open.length === 0) {
      if (candidates.length > 0) {
        const hint = candidates.find((t) => t.requiresHint)?.requiresHint;
        return { kind: 'blocked', text: hint ?? 'Dafür ist es noch zu früh.' };
      }
      return { kind: 'idle', text: hotspot?.idleText ?? 'Hier gibt es gerade nichts zu tun.' };
    }
    if (open.length === 1) return { kind: 'task', task: open[0] };
    return { kind: 'menu', tasks: open };
  }

  /** Prüfung vor dem Ausführen: Sicherheit, Ausstattung, Reihenfolge, Gerätezustand. */
  preflight(task: TaskDef, ctx: TaskContext): Preflight {
    const result: Preflight = { penalties: [] };
    // Erst die Ausstattung: ohne Gerät kann man es auch nicht falsch benutzen.
    for (const eq of task.equipment ?? []) {
      if (!ctx.hasEquipment(eq)) {
        result.missingEquipment = { equipment: eq, text: task.missingEquipmentText ?? `${EQUIPMENT[eq].name} ist nicht an Bord.` };
        return result;
      }
    }
    for (const s of task.safety ?? []) {
      if (!ctx.done.has(s.missing)) {
        result.gameOver = s.gameOver;
        return result;
      }
    }
    for (const so of task.softOrder ?? []) {
      if (!ctx.done.has(so.missing)) result.penalties.push({ ms: so.penaltyMs, text: so.text });
    }
    for (const eq of task.usesEquipment ?? []) {
      if (!ctx.isServiced(eq) && !ctx.repaired.has(eq)) {
        result.repair = EQUIPMENT[eq];
        break;
      }
    }
    return result;
  }

  requiredTasks(): TaskDef[] {
    return this.def.tasks.filter((t) => !t.optional);
  }

  optionalTasks(): TaskDef[] {
    return this.def.tasks.filter((t) => t.optional);
  }

  isComplete(ctx: TaskContext): boolean {
    return this.requiredTasks().every((t) => ctx.done.has(t.id));
  }

  /** Aufgaben, die nach einer Rückkehr mit anderem Fahrzeug erneut anstehen. */
  resetOnReturnIds(): string[] {
    return this.def.tasks.filter((t) => t.resetOnReturn).map((t) => t.id);
  }
}
