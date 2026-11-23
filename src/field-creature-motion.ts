import type { CreatureId } from './creatures';

export type FieldCreature = CreatureId | 'sylveon';
type Gait = { height: number; pace: number; bounce: number; sway: number; airborne: number; flex: number; leg: number; sourceFacing: number };

export const creatureGaits: Record<FieldCreature, Gait> = {
  piplup: { height: .89, pace: 2.1, bounce: .113, sway: .118, airborne: 0, flex: .70, leg: 0.31, sourceFacing: -1 },
  starly: { height: .86, pace: 1.7, bounce: .186, sway: .068, airborne: .0, flex: .81, leg: 0.37, sourceFacing: -1 },
  shinx: { height: .84, pace: 2.5, bounce: .084, sway: .068, airborne: 0, flex: 1, leg: 0.41, sourceFacing: -1 },
  buizel: { height: .99, pace: 2.45, bounce: .113, sway: .075, airborne: 0, flex: 1.11, leg: 0.46, sourceFacing: -1 },
  drifloon: { height: .98, pace: 1.20, bounce: .083, sway: .122, airborne: .34, flex: 1.31, leg: 0.56, sourceFacing: 1 },
  riolu: { height: 1.03, pace: 2.20, bounce: .130, sway: .063, airborne: 0, flex: .89, leg: 0.44, sourceFacing: -1 },
  gible: { height: 1.02, pace: 1.66, bounce: .111, sway: .111, airborne: 0, flex: .55, leg: 0.29, sourceFacing: -1 },
  snover: { height: 1.11, pace: 1.52, bounce: .067, sway: .075, airborne: 0, flex: .85, leg: 0.35, sourceFacing: -1 },
  sylveon: { height: 1.05, pace: 1.86, bounce: .104, sway: .06, airborne: 0, flex: 1.22, leg: 0.39, sourceFacing: -1 },
};
