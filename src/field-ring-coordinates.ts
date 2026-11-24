import { harborHeight } from './field-city-layout';

export const RING_PERIOD = 40;
export const RING_CENTER_X = 12.5;
const angleStep = Math.PI * 2 / RING_PERIOD;
const streetRadius = 9.8;
const ringDepth = .48;

export const wrapRingX = (x: number) => (x % RING_PERIOD + RING_PERIOD) % RING_PERIOD;
export const ringAngle = (x: number) => (x - RING_CENTER_X) * angleStep;
export const ringRadius = (z: number) => streetRadius + (z - 12) * ringDepth;
export const harborOverviewYaw = ringAngle(15.15);

export function ringStreetRow(row: number) {
  return row + .875 - Math.min(.375, Math.max(0, (row - 15) * .14));
}

export function ringStreetLooksOutward(column: number, row: number) {
  return (column >= 13 && column <= 16 && row >= 32 && row <= 34)
    || (column >= 23 && column <= 25 && row >= 34 && row <= 35)
    || (column >= 33 && column <= 36 && row >= 35 && row <= 36);
}

export function frameStreetSubject(
  across: number, depth: number, elevation: number, yaw: number, pitch: number, aspect: number, distance = Infinity,
) {
  const toward = across * Math.sin(yaw) + depth * Math.cos(yaw);
  const width = across * Math.cos(yaw) - depth * Math.sin(yaw);
  const height = elevation * Math.cos(pitch) - toward * Math.sin(pitch);
  const parallax = Number.isFinite(distance)
    ? distance / Math.max(distance * .28, distance - toward * Math.cos(pitch) - elevation * Math.sin(pitch)) : 1;
  return 2.22 * parallax * Math.max(Math.abs(width) / aspect, Math.abs(height));
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
  const pitch = Math.max(.62, Math.min(1.18, (compact ? .81 : .70) + tilt));
  const elevation = .84;
  const coast = ringRadius(harborHeight + 4.6);
  const height = (coast * Math.sin(pitch) + elevation * Math.cos(pitch) + .38) * 2;
  return { pitch, elevation, span: Math.max(25, (coast * 2 + 1.1) / aspect, height) };
}

export function harborAerialCamera(aspect: number, compact: boolean, tilt: number) {
  const coast = ringRadius(harborHeight + 4.6);
  const pitch = Math.max(.62, Math.min(1.18, (compact ? .80 : .68) + tilt));
  const elevation = 1.05;
  const advance = coast * .14;
  const distance = coast * 3.45;
  const sin = Math.sin(pitch), cos = Math.cos(pitch);

  // The perspective camera enlarges the near quay and compresses the far shore.
  const nearQuay = coast - advance;
  const nearHeight = (nearQuay * sin + elevation * cos) * distance / (distance - nearQuay * cos + elevation * sin);
  const farQuay = coast + advance;
  const farHeight = (farQuay * sin + 2 * cos) * distance / (distance + farQuay * cos - 2 * sin);
  const span = Math.max(Math.max(nearHeight, farHeight) * 2.10, coast * 2.18 / aspect);
  return { pitch, elevation, advance, distance, span };
}
