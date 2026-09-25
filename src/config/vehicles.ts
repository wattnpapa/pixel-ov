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
    drive: { accel: 560, maxSpeed: 600, reverseSpeed: 200, turnRate: 200, brake: 1040, drag: 280, mass: 1, bodyRadius: 20 },
    equipment: ['barrier'],
    refuel: { label: 'MTW betanken', durationMs: 2000 },
  },
  gkw: {
    id: 'gkw',
    name: 'GKW',
    longName: 'Gerätekraftwagen',
    topSprite: 'vehicle-gkw-top',
    sideSprite: 'vehicle-gkw-side',
    drive: { accel: 280, maxSpeed: 460, reverseSpeed: 140, turnRate: 110, brake: 640, drag: 160, mass: 2.5, bodyRadius: 24 },
    equipment: ['barrier', 'ppe', 'chainsaw', 'pump', 'hose', 'wet-vac'],
    refuel: { label: 'GKW betanken', durationMs: 3000 },
  },
};

export const VEHICLE_IDS: VehicleId[] = ['mtw', 'gkw'];
