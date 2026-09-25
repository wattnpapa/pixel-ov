import { MISSIONS_PER_RUN, SAVE_KEY } from '../config/game';
import { EQUIPMENT, type EquipmentId } from '../config/equipment';
import { VEHICLES, VEHICLE_IDS, type VehicleId } from '../config/vehicles';
import type { MissionId } from '../config/missions/types';
import { CAMPAIGN } from '../config/campaign';

export type Phase = 'hall' | 'driving-out' | 'on-site' | 'driving-back';

export interface EquipmentState {
  /** true = gepflegt und einsatzbereit */
  serviced: boolean;
}

export interface VehicleState {
  id: VehicleId;
  fueled: boolean;
  /** 0..100, sinkt bei Kollisionen */
  condition: number;
  equipment: Partial<Record<EquipmentId, EquipmentState>>;
}

/** Laufender Einsatz. Existiert vom bestätigten Alarm bis zur Rückkehr in die Halle. */
export interface MissionProgress {
  alarmIndex: number;
  missionId: MissionId;
  vehicleId: VehicleId | null;
  doneTasks: string[];
  /** Zeit seit dem Ausrücken, inkl. Strafzeiten */
  elapsedMs: number;
  penaltyMs: number;
  procedureErrors: number;
  gameOvers: number;
  /** Geräte, die in diesem Einsatz benutzt wurden und danach Pflege brauchen */
  usedEquipment: EquipmentId[];
  /** Geräte, die im Einsatz notdürftig gangbar gemacht wurden */
  repairedEquipment: EquipmentId[];
  /** Ausstattungsfehler: zweites Fahrzeug musste nachgeholt werden */
  reinforcement: boolean;
  /** Der Einsatz ist erledigt; es fehlt nur die Rückfahrt */
  completed: boolean;
}

export interface MissionRecord {
  alarmIndex: number;
  missionId: MissionId;
  title: string;
  elapsedMs: number;
  procedureErrors: number;
  optionalDone: number;
  optionalTotal: number;
  reinforcement: boolean;
  gameOvers: number;
  rating: string;
}

export interface SaveData {
  version: 1;
  phase: Phase;
  alarmIndex: number;
  currentVehicle: VehicleId | null;
  vehicles: Record<VehicleId, VehicleState>;
  progress: MissionProgress | null;
  history: MissionRecord[];
}

function freshVehicle(id: VehicleId): VehicleState {
  const equipment: VehicleState['equipment'] = {};
  for (const e of VEHICLES[id].equipment) if (EQUIPMENT[e].service) equipment[e] = { serviced: true };
  return { id, fueled: true, condition: 100, equipment };
}

export function freshSave(): SaveData {
  return {
    version: 1,
    phase: 'hall',
    alarmIndex: 0,
    currentVehicle: null,
    vehicles: Object.fromEntries(VEHICLE_IDS.map((id) => [id, freshVehicle(id)])) as Record<VehicleId, VehicleState>,
    progress: null,
    history: [],
  };
}

let data: SaveData = freshSave();

export function state(): SaveData {
  return data;
}

export function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* Speichern ist Komfort, kein Muss (z. B. privater Modus). */
  }
}

/** Lädt den Spielstand. Liefert true, wenn ein gültiger Stand vorhanden war. */
export function load(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1 || !parsed.vehicles) return false;
    data = parsed;
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function reset(): void {
  data = freshSave();
  save();
}

export function runFinished(): boolean {
  return data.history.length >= MISSIONS_PER_RUN;
}

export function nextAlarm() {
  return data.alarmIndex < CAMPAIGN.length ? CAMPAIGN[data.alarmIndex] : null;
}

/** Alarm bestätigen: legt den laufenden Einsatz an. */
export function acceptAlarm(): MissionProgress {
  const alarm = nextAlarm();
  if (!alarm) throw new Error('Kein Alarm offen');
  data.progress = {
    alarmIndex: data.alarmIndex,
    missionId: alarm.missionId,
    vehicleId: null,
    doneTasks: [],
    elapsedMs: 0,
    penaltyMs: 0,
    procedureErrors: 0,
    gameOvers: 0,
    usedEquipment: [],
    repairedEquipment: [],
    reinforcement: false,
    completed: false,
  };
  save();
  return data.progress;
}

export function chooseVehicle(id: VehicleId): void {
  data.currentVehicle = id;
  if (data.progress) data.progress.vehicleId = id;
  save();
}

export function setPhase(phase: Phase): void {
  data.phase = phase;
  save();
}

export function currentVehicle(): VehicleState | null {
  return data.currentVehicle ? data.vehicles[data.currentVehicle] : null;
}

export function vehicleHasEquipment(id: VehicleId, eq: EquipmentId): boolean {
  return VEHICLES[id].equipment.includes(eq);
}

export function equipmentServiced(id: VehicleId, eq: EquipmentId): boolean {
  const st = data.vehicles[id].equipment[eq];
  return st ? st.serviced : true;
}

/** Zeit im laufenden Einsatz fortschreiben (nur während Anfahrt und vor Ort). */
export function tickMission(deltaMs: number): void {
  if (data.progress && !data.progress.completed) data.progress.elapsedMs += deltaMs;
}

export function addPenalty(ms: number, isProcedureError = true): void {
  if (!data.progress) return;
  data.progress.penaltyMs += ms;
  data.progress.elapsedMs += ms;
  if (isProcedureError) data.progress.procedureErrors += 1;
  save();
}

export function markTaskDone(taskId: string): void {
  if (!data.progress) return;
  if (!data.progress.doneTasks.includes(taskId)) data.progress.doneTasks.push(taskId);
  save();
}

export function markEquipmentUsed(eq: EquipmentId): void {
  if (!data.progress) return;
  if (!data.progress.usedEquipment.includes(eq)) data.progress.usedEquipment.push(eq);
  save();
}

export function markEquipmentRepaired(eq: EquipmentId): void {
  if (!data.progress) return;
  if (!data.progress.repairedEquipment.includes(eq)) data.progress.repairedEquipment.push(eq);
  save();
}

/** Game Over vor Ort: Aufgaben zurücksetzen, Zeit läuft weiter. */
export function restartMissionOnSite(): void {
  if (!data.progress) return;
  data.progress.doneTasks = [];
  data.progress.repairedEquipment = [];
  data.progress.gameOvers += 1;
  save();
}

/** Nachalarmierung: Fahrzeug fährt zurück, der Einsatz bleibt offen. */
export function requestReinforcement(resetTasks: string[]): void {
  if (!data.progress) return;
  data.progress.reinforcement = true;
  data.progress.doneTasks = data.progress.doneTasks.filter((t) => !resetTasks.includes(t));
  save();
}

/** Einsatz abgeschlossen: Bewertung in die Historie schreiben, Fahrzeugverschleiß buchen. */
export function completeMission(record: Omit<MissionRecord, 'alarmIndex' | 'missionId'>): MissionRecord {
  const p = data.progress;
  if (!p) throw new Error('Kein laufender Einsatz');
  const full: MissionRecord = { ...record, alarmIndex: p.alarmIndex, missionId: p.missionId };
  data.history.push(full);
  p.completed = true;
  for (const eq of p.usedEquipment) {
    for (const vid of VEHICLE_IDS) {
      const st = data.vehicles[vid].equipment[eq];
      if (st && VEHICLES[vid].equipment.includes(eq)) st.serviced = false;
    }
  }
  data.alarmIndex += 1;
  save();
  return full;
}

/** Rückkehr in die Halle: Fahrzeug braucht Sprit, Einsatz ist abgehakt. */
export function arriveAtDepot(): void {
  const v = currentVehicle();
  if (v) v.fueled = false;
  if (data.progress?.completed) data.progress = null;
  data.phase = 'hall';
  save();
}

export function damageVehicle(amount: number): void {
  const v = currentVehicle();
  if (!v) return;
  v.condition = Math.max(0, v.condition - amount);
}

export interface ServiceTask {
  vehicleId: VehicleId;
  kind: 'refuel' | 'equipment';
  equipment?: EquipmentId;
  label: string;
  durationMs: number;
}

/** Offene Nachbereitungsaufgaben aller Fahrzeuge in der Halle. */
export function openServiceTasks(): ServiceTask[] {
  const tasks: ServiceTask[] = [];
  for (const vid of VEHICLE_IDS) {
    const v = data.vehicles[vid];
    const def = VEHICLES[vid];
    if (!v.fueled) tasks.push({ vehicleId: vid, kind: 'refuel', label: def.refuel.label, durationMs: def.refuel.durationMs });
    for (const [eqId, st] of Object.entries(v.equipment) as [EquipmentId, EquipmentState][]) {
      const eq = EQUIPMENT[eqId];
      if (!st.serviced && eq.service) {
        tasks.push({ vehicleId: vid, kind: 'equipment', equipment: eqId, label: `${eq.service.label} (${def.name})`, durationMs: eq.service.durationMs });
      }
    }
  }
  return tasks;
}

export function completeServiceTask(task: ServiceTask): void {
  const v = data.vehicles[task.vehicleId];
  if (task.kind === 'refuel') v.fueled = true;
  else if (task.equipment && v.equipment[task.equipment]) v.equipment[task.equipment]!.serviced = true;
  save();
}

export function vehicleReady(id: VehicleId): boolean {
  return openServiceTasks().every((t) => t.vehicleId !== id);
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
