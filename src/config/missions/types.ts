import type { EquipmentId } from '../equipment';
import type { PaletteColor } from '../game';

export type MissionId = 'storm-tree' | 'water-basement';

/** Klickbarer Bereich in der Seitenansicht. */
export interface HotspotDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Wohin der Helfer läuft (x auf der Bodenlinie). Fehlt er, Mitte des Hotspots. */
  walkX?: number;
  /** Text, wenn gerade keine Aufgabe an diesem Hotspot offen ist. */
  idleText?: string;
}

/** Darstellungsobjekt (Platzhalter-Rechteck oder Sprite), das Aufgaben ein-/ausblenden oder verändern. */
export interface PropDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: PaletteColor;
  /** Optionaler Texture-Key; ersetzt das Rechteck, sobald ein Asset existiert. */
  sprite?: string;
  hidden?: boolean;
  label?: string;
}

export interface ChoiceOption {
  label: string;
  outcome: 'ok' | 'gameover' | 'penalty';
  text?: string;
  penaltyMs?: number;
}

export interface ChoiceDef {
  prompt: string;
  options: ChoiceOption[];
}

/** Minispiel: Schritte in der richtigen Reihenfolge anklicken (Schnitte, Kupplungen). */
export interface SequenceMinigameDef {
  prompt: string;
  steps: { id: string; label: string; x: number; y: number }[];
  order: string[];
  wrongText: string;
  wrongPenaltyMs: number;
  stepDurationMs: number;
}

export interface TaskDef {
  id: string;
  label: string;
  hotspot: string;
  /** Harte Voraussetzungen: ohne sie wird die Aufgabe nicht angeboten. */
  requires?: string[];
  /** Hinweis, wenn der Hotspot angeklickt wird, die Voraussetzungen aber fehlen. */
  requiresHint?: string;
  /** Sicherheitsverstoß: Aufgabe ohne diese Vorbedingung ausführen = Game Over. */
  safety?: { missing: string; gameOver: string }[];
  /** Ablauffehler: Aufgabe ohne diese Vorbedingung kostet Zeit, läuft aber weiter. */
  softOrder?: { missing: string; penaltyMs: number; text: string }[];
  /** Muss auf dem Fahrzeug sein. Fehlt es: Ausstattungsfehler, Nachalarmierung. */
  equipment?: EquipmentId[];
  missingEquipmentText?: string;
  /** Gerät wird benutzt: Prüfung der Nachbereitung, danach wartungsbedürftig. */
  usesEquipment?: EquipmentId[];
  choice?: ChoiceDef;
  minigame?: SequenceMinigameDef;
  durationMs?: number;
  progressLabel?: string;
  doneText?: string;
  optional?: boolean;
  show?: string[];
  hide?: string[];
  /** Höhe eines Props während der Aufgabendauer animieren (z. B. Wasserstand). */
  tween?: { prop: string; h: number; y?: number };
  /** Muss nach einer Rückkehr mit anderem Fahrzeug erneut erledigt werden. */
  resetOnReturn?: boolean;
}

export interface MissionDef {
  id: MissionId;
  title: string;
  /** Hintergrund-Texture-Key. */
  background: string;
  /** Bodenlinie, auf der der Helfer läuft (y in px). */
  groundY: number;
  /** Hotspot-ID des Einsatzfahrzeugs. Wird auch für Rückfahrt/Nachalarmierung benutzt. */
  vehicleHotspot: string;
  /** Position des Fahrzeug-Sprites (untere linke Ecke). */
  vehiclePos: { x: number; y: number };
  /** Aufgabe, die als erstes erledigt sein muss (Aussteigen). */
  entryTask: string;
  hotspots: HotspotDef[];
  props: PropDef[];
  tasks: TaskDef[];
  /** Richtzeit für die Bewertung in ms (Anfahrt eingeschlossen). */
  parTimeMs: number;
  reinforcementText: string;
}

/** Ein Alarm in der Kampagne: Welche Einsatzstelle mit welchem Text. */
export interface AlarmDef {
  missionId: MissionId;
  kind: string;
  address: string;
  brief: string;
}
