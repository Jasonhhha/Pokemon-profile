export const wardPosts = [
  { id: 'nw', name: '西北锚柱', tile: { x: 3, y: 3 }, bearing: -2.32 },
  { id: 'ne', name: '东北锚柱', tile: { x: 13, y: 3 }, bearing: 2.32 },
  { id: 'sw', name: '西南锚柱', tile: { x: 2, y: 9 }, bearing: -1.04 },
  { id: 'se', name: '东南锚柱', tile: { x: 14, y: 9 }, bearing: 1.04 },
] as const;

export type WardPostId = typeof wardPosts[number]['id'];
export type WardPhase = 'idle' | 'seeking' | 'braced' | 'stable';
export type WardSurvey = { phase: WardPhase; fault: WardPostId };
export type WardReading = { inspected?: WardPostId; heard: boolean; testing: boolean; sampling?: boolean };
export const quietReading: WardReading = { heard: false, testing: false };
export const idleWard: WardSurvey = { phase: 'idle', fault: 'nw' };

export function restoreWard(value: unknown): WardSurvey {
  if (!value || typeof value !== 'object') return idleWard;
  const { phase, fault } = value as Partial<WardSurvey>;
  if (phase !== 'seeking' && phase !== 'braced' && phase !== 'stable') return idleWard;
  const post = wardPosts.find(post => post.id === fault);
  return post ? { phase, fault: post.id } : idleWard;
}

export function wardWalkway(x: number, y: number) {
  return (x === 2 || x === 14) && y >= 3 && y <= 12 ||
    y === 12 && x >= 2 && x <= 14 || y === 3 && (x === 3 || x === 13);
}

export function nearbyWardPost(point: { x: number; y: number }) {
  return wardPosts.find(({ tile }) => Math.abs(tile.x - point.x) + Math.abs(tile.y - point.y) <= 1);
}

// The disturbance travels over the dome to the collar, then along the chain to its drum.
export function wardArrival(bearing: number) {
  const impulseLength = Math.hypot(-.59, .67, .48);
  const dot = (-.59 * Math.sin(bearing) + .48 * Math.cos(bearing)) / impulseLength;
  return .78 + Math.acos(Math.max(-1, Math.min(1, dot))) / 3.7 + .102;
}

const firstSignal = Math.min(...wardPosts.map(post => wardArrival(post.bearing)));

// Certification sends one pulse through each enamel collar, which then holds a steady charge.
export function wardServiceLight(bearing: number, settledAge: number, reduced: boolean) {
  const steady = .55;
  if (reduced || !Number.isFinite(settledAge)) return steady;
  const age = settledAge - (wardArrival(bearing) - firstSignal);
  if (age <= 0) return 0;
  if (age >= .50) return steady;
  const raising = age < .10;
  const t = raising ? age / .10 : (age - .10) / .40;
  const eased = t * t * (3 - 2 * t);
  return raising ? eased : 1 - (1 - steady) * eased;
}

export function wardSide(fault: WardPostId) {
  return fault === 'nw' || fault === 'sw' ? '西侧' : '东侧';
}

export const wardTestDuration = Math.max(...wardPosts.map(post => wardArrival(post.bearing))) + .32;
