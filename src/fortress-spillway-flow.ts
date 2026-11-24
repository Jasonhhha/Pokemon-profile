import { fortressLiftDepth, fortressTiming, type FortressView } from './field-fortress-state';

const riseSeconds = fortressTiming.rise / 1000,
  emptySeconds = fortressTiming.empty / 1000;
const levels = [
  { y: -3.46, lip: 1.41, width: 3.96, reach: 2.22, next: -10.77 },
  { y: -10.76, lip: 3.98, width: 5.02, reach: 2.83, next: -15.01 },
  { y: -15.02, lip: 7.05, width: 6.13, reach: 5.96, next: -23.0 },
];
export const spillwayLevels = levels.map((level, i) => ({
  ...level,
  uncovers: ((-0.58 - level.y) * riseSeconds) / fortressLiftDepth,
  tapers: riseSeconds + (0.35 + 0.052 * i) * emptySeconds,
  empties: riseSeconds + (0.72 + 0.045 * i) * emptySeconds,
}));
export type SpillwayLevel = (typeof spillwayLevels)[number];

// The opposing pressure valves share feed pipes. The longer branches start and finish slightly later.
export const valveDelay = [0, 0.19, 0.38, 0.11, 0.04, 0.23, 0.42, 0.15] as const;
export const fillSeconds = 0.79;
export const wakeDelay = 0.29;
export function drainClock(state: FortressView) {
  return riseSeconds * state.lift + emptySeconds * state.drain;
}
function smooth(t: number) {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}
export function discharge(level: SpillwayLevel, outlet: number, emission: number) {
  const at = emission - valveDelay[outlet];
  return (
    smooth((at - level.uncovers) / fillSeconds) * (1 - smooth((at - level.tapers) / (level.empties - level.tapers)))
  );
}
export function spillwayFall(level: SpillwayLevel, sea: number) {
  const impact = Math.max(sea, level.next),
    drop = Math.max(0, level.y - impact);
  return {
    impact,
    drop,
    flight: Math.sqrt((2 * drop) / 9.81),
    reach: level.reach * Math.sqrt(drop / (level.y - level.next)),
  };
}
