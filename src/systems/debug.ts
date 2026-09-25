import type Phaser from 'phaser';
import { SCENES } from '../config/game';
import type { VehicleId } from '../config/vehicles';
import { CAMPAIGN } from '../config/campaign';
import { acceptAlarm, chooseVehicle, reset, setPhase, state } from './GameState';

/**
 * Entwickler-Einstieg über URL-Parameter, z. B.
 *   ?scene=side&mission=water-basement&vehicle=mtw
 *   ?scene=drive&vehicle=gkw
 * Setzt einen frischen Spielstand auf und springt direkt in die Szene.
 */
export function applyDebugParams(scene: Phaser.Scene): boolean {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('scene');
  if (!target) return false;
  reset();
  const missionId = params.get('mission');
  const vehicle = (params.get('vehicle') ?? 'gkw') as VehicleId;
  const alarmIndex = Math.max(0, CAMPAIGN.findIndex((a) => a.missionId === missionId));
  state().alarmIndex = alarmIndex;
  acceptAlarm();
  chooseVehicle(vehicle);
  switch (target) {
    case 'side':
      setPhase('on-site');
      scene.scene.start(SCENES.side);
      return true;
    case 'drive':
      setPhase('driving-out');
      scene.scene.start(SCENES.drive, { mode: 'out' });
      return true;
    default:
      return false;
  }
}
