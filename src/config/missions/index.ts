import type { MissionDef, MissionId } from './types';
import { STORM_TREE } from './storm-tree';
import { WATER_BASEMENT } from './water-basement';

export const MISSIONS: Record<MissionId, MissionDef> = {
  'storm-tree': STORM_TREE,
  'water-basement': WATER_BASEMENT,
};
