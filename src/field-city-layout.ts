export type CityParcelKind = 'archive' | 'clinic' | 'market' | 'station' | 'apartment' | 'office' | 'hotel' | 'warehouse';

export type CityParcel = {
  id: string;
  kind: CityParcelKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  stories: number;
  finish: number;
};

export const cityParcels: readonly CityParcel[] = [
  { id: 'archive', kind: 'archive', x: 8, z: 6, width: 5, depth: 4, stories: 3, finish: 0 },
  { id: 'clinic', kind: 'clinic', x: 16, z: 6, width: 5, depth: 4, stories: 3, finish: 1 },
  { id: 'market', kind: 'market', x: 22, z: 6, width: 5, depth: 4, stories: 4, finish: 2 },
  { id: 'central-station', kind: 'station', x: 28, z: 6, width: 5, depth: 4, stories: 3, finish: 3 },
  { id: 'dock-house', kind: 'warehouse', x: 8, z: 17, width: 5, depth: 4, stories: 1, finish: 2 },
  { id: 'waterline', kind: 'apartment', x: 8, z: 1, width: 5, depth: 4, stories: 5, finish: 2 },
  { id: 'north-hotel', kind: 'hotel', x: 15, z: 1, width: 5, depth: 4, stories: 6, finish: 0 },
  { id: 'exchange', kind: 'office', x: 22, z: 1, width: 5, depth: 4, stories: 7, finish: 3 },
  { id: 'station-house', kind: 'apartment', x: 28, z: 1, width: 5, depth: 3, stories: 5, finish: 1 },
  { id: 'park-works', kind: 'warehouse', x: 22, z: 19, width: 4, depth: 4, stories: 2, finish: 0 },
];

export type CityTerrace = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  homes: number;
  style: 'wharf' | 'shops' | 'garden';
  facing: 'inner' | 'outer';
};

export const cityTerraces: readonly CityTerrace[] = [
  { id: 'west-lock-houses', x: 5, z: 18, width: 3, depth: 2, homes: 3, style: 'wharf', facing: 'inner' },
  { id: 'dock-crescent', x: 8, z: 21, width: 5, depth: 2, homes: 4, style: 'wharf', facing: 'outer' },
  { id: 'garden-crescent', x: 14, z: 19, width: 7, depth: 3, homes: 5, style: 'garden', facing: 'inner' },
  { id: 'market-crescent', x: 26, z: 19, width: 4, depth: 3, homes: 4, style: 'shops', facing: 'inner' },
  { id: 'east-quay-houses', x: 32, z: 18, width: 4, depth: 2, homes: 4, style: 'wharf', facing: 'inner' },
  { id: 'wharf-granaries', x: 5, z: 24, width: 4, depth: 3, homes: 4, style: 'wharf', facing: 'inner' },
  { id: 'seafarer-place', x: 10, z: 24, width: 4, depth: 3, homes: 4, style: 'shops', facing: 'inner' },
  { id: 'slate-gardens', x: 15, z: 25, width: 4, depth: 2, homes: 3, style: 'garden', facing: 'inner' },
  { id: 'market-row', x: 20, z: 24, width: 4, depth: 3, homes: 3, style: 'shops', facing: 'inner' },
  { id: 'station-road', x: 25, z: 25, width: 4, depth: 2, homes: 3, style: 'garden', facing: 'outer' },
  { id: 'east-end', x: 30, z: 24, width: 4, depth: 3, homes: 3, style: 'wharf', facing: 'inner' },
];

export const harborHeight = 29;
export const reclaimedRingQuays = [[4, 17, 4, 6], [31, 17, 5, 5], [32, 22, 3, 1], [4, 23, 31, 6]] as const;

export function cityTerraceAt(x: number, z: number) {
  return cityTerraces.some(lot => x >= lot.x && x < lot.x + lot.width && z >= lot.z && z < lot.z + lot.depth);
}

export const cityTransit = { railZ: 5.38, railHeight: 4.12, fromX: 6.8, toX: 34.4 } as const;

export const cityViaductPiers = [7.58, 10.65, 14.36, 18.62, 23.39, 29.86, 33.44] as const;

export const cityObstacles: readonly [number, number, number, number][] = [
  ...cityParcels.map(({ x, z, width, depth }): [number, number, number, number] => [x, z, width, depth]),
  ...cityTerraces.map(({ x, z, width, depth }): [number, number, number, number] => [x, z, width, depth]),
  ...cityViaductPiers.map((x): [number, number, number, number] => [Math.floor(x), Math.floor(cityTransit.railZ), 1, 1]),
  [23, 14, 2, 2],
  [8, 5, 2, 1],
  [34, 1, 2, 2],
  [36, 1, 1, 1],
];

export const cityParkBeds = [
  { x: 15, z: 14, width: 6, depth: 4 },
  { x: 26, z: 15, width: 8, depth: 3 },
  { x: 33, z: 3, width: 5, depth: 3 },
] as const;

export const cityStreet = {
  west: 6.95,
  east: 39.98,
  north: 10.95,
  south: 14.02,
  railNorth: 11.78,
  railSouth: 12.28,
  crossings: [8.8, 13.70, 21.60, 27.12, 32.15, 38.5],
} as const;

export function cityDistrict(x: number, z: number) {
  if (z >= 23) return '海堤排屋街';
  if (x < 7) return '西侧渡口';
  if (x === 37 && z >= 14) return '东渡口';
  if (x > 32 && z < 6) return '潮门公园';
  if (z > 13 && x >= 14 && x < 34) return '外环绿廊';
  if (x > 30) return '东站桥区';
  if (z < 6) return '内环街区';
  return '环城大道';
}
