import type { MissionDef, MissionId } from './types';
import { STORM_TREE } from './storm-tree';

export const MISSIONS: Record<MissionId, MissionDef> = {
  'storm-tree': STORM_TREE,
  // 'water-basement' folgt im nächsten Schritt; bis dahin zeigt die Szene den Sturmschaden.
  'water-basement': STORM_TREE,
};
