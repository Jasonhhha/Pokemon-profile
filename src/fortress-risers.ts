import type { FortressInteriorFrame, FortressRoom } from './field-fortress-state';
import { nominalPower } from './fortress-power';

export type RiserRoom = Exclude<FortressRoom, 'seal'>;

// Floor coordinates use the centre of each hall as the datum. Both shafts stand in water.
export const riserSites = {
  sluice: { center: 8.5, spread: 3.84, z: 9.45, height: 7.8, delay: .22 },
  aqueduct: { center: 24.5, spread: 4.7, z: 18.65, height: 12.5, delay: .15 },
  catacomb: { center: 24.5, spread: 4.7, z: 18.65, height: 13.7, delay: .08 },
} as const;

export function riserOutput(frame: FortressInteriorFrame, room: RiserRoom) {
  const power = frame.power ?? nominalPower;
  return room === 'sluice' ? (power.bus + power.city) / 2 : room === 'catacomb' ? (power.source + power.bus) / 2 : power.bus;
}

export function riserCrest(phase: number, room: RiserRoom, height: number, quiet: boolean) {
  if (quiet) return .52;
  const wave = Math.cos(2 * Math.PI * (phase - riserSites[room].delay - height * .32));
  return ((1 + wave) / 2) ** 5;
}
