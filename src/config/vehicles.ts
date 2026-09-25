import type { EquipmentId } from './equipment';

export type VehicleId = 'mtw' | 'gkw';

export interface DriveParams {
  /** Beschleunigung in px/s² */
  accel: number;
  /** Höchstgeschwindigkeit in px/s */
  maxSpeed: number;
  /** Rückwärts in px/s */
  reverseSpeed: number;
  /** Drehrate in Grad/s bei voller Fahrt */
  turnRate: number;
  /** Bremsverzögerung in px/s² */
  brake: number;
  /** Rollwiderstand ohne Gas in px/s² */
  drag: number;
  /** Masse: beeinflusst Schaden bei Kollisionen */
  mass: number;
  /** Radius des Kollisionskörpers in px */
  bodyRadius: number;
}

export interface VehicleDef {
  id: VehicleId;
  /** Kurzbezeichnung, z. B. MTW */
  name: string;
  longName: string;
  /** Texture-Keys (siehe BootScene) */
  topSprite: string;
  sideSprite: string;
  drive: DriveParams;
  equipment: EquipmentId[];
  refuel: { label: string; durationMs: number };
}

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  mtw: {
    id: 'mtw',
    name: 'MTW',
    longName: 'Mannschaftstransportwagen',
    topSprite: 'vehicle-mtw-top',
    sideSprite: 'vehicle-mtw-side',
    drive: { accel: 140, maxSpeed: 150, reverseSpeed: 50, turnRate: 200, brake: 260, drag: 70, mass: 1, bodyRadius: 6 },
    equipment: ['barrier'],
    refuel: { label: 'MTW betanken', durationMs: 2000 },
  },
  gkw: {
    id: 'gkw',
    name: 'GKW',
    longName: 'Gerätekraftwagen',
    topSprite: 'vehicle-gkw-top',
    sideSprite: 'vehicle-gkw-side',
    drive: { accel: 70, maxSpeed: 115, reverseSpeed: 35, turnRate: 110, brake: 160, drag: 40, mass: 2.5, bodyRadius: 8 },
    equipment: ['barrier', 'ppe', 'chainsaw', 'pump', 'hose', 'wet-vac'],
    refuel: { label: 'GKW betanken', durationMs: 3000 },
  },
};

export const VEHICLE_IDS: VehicleId[] = ['mtw', 'gkw'];
