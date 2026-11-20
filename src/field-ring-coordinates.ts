import { harborHeight } from './field-city-layout';

export const RING_PERIOD = 40;
export const RING_CENTER_X = 12.5;
const angleStep = Math.PI * 2 / RING_PERIOD;
const streetRadius = 9.8;
const ringDepth = .48;

export const wrapRingX = (x: number) => (x % RING_PERIOD + RING_PERIOD) % RING_PERIOD;
export const ringAngle = (x: number) => (x - RING_CENTER_X) * angleStep;
export const ringRadius = (z: number) => streetRadius + (z - 12) * ringDepth;

export function ringStreetRow(row: number) {
  return row + .875 - Math.min(.375, Math.max(0, (row - 15) * .14));
}

export function ringPosition(x: number, z: number) {
  const angle = ringAngle(x);
  const radius = ringRadius(z);
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

export function ringCoordinates(x: number, z: number) {
  return {
    x: wrapRingX(Math.atan2(x, z) / angleStep + RING_CENTER_X),
    z: (Math.hypot(x, z) - streetRadius) / ringDepth + 12,
  };
}

export function ringXDelta(from: number, to: number) {
  return wrapRingX(to - from + RING_PERIOD / 2) - RING_PERIOD / 2;
}

export function ringOverviewCamera(aspect: number, compact: boolean, tilt: number) {
  const pitch = Math.max(.62, Math.min(1.18, (compact ? .94 : .83) + tilt));
  const elevation = .84;
  const coast = ringRadius(harborHeight + 4.6);
  const height = (coast * Math.sin(pitch) + elevation * Math.cos(pitch) + .38) * 2;
  return { pitch, elevation, span: Math.max(25, (coast * 2 + 1.1) / aspect, height) };
}
