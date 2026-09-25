import type { AlarmDef } from './missions/types';

/** Die drei Alarme eines Durchgangs, in dieser Reihenfolge. */
export const CAMPAIGN: AlarmDef[] = [
  {
    missionId: 'storm-tree',
    kind: 'Sturmschaden',
    address: 'Am Feldrand, Landstraße Süd',
    brief: 'Baum liegt quer auf der Fahrbahn. Ein PKW wartet davor. Straße ist noch nicht gesperrt.',
  },
  {
    missionId: 'water-basement',
    kind: 'Wasserschaden',
    address: 'Ringstraße 7, Mehrfamilienhaus',
    brief: 'Keller vollgelaufen, Wasser steht kniehoch. Hausbewohner melden Brummen aus dem Keller.',
  },
  {
    missionId: 'storm-tree',
    kind: 'Sturmschaden',
    address: 'Am Feldrand, Landstraße Süd',
    brief: 'Nächste Böe, nächster Baum. Gleiche Stelle wie vorhin, diesmal dicker.',
  },
];
