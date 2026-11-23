export type CityParcelKind = 'archive' | 'clinic' | 'market' | 'station' | 'apartment' | 'office' | 'hotel' | 'warehouse';

type CityFootprint = { x: number; z: number; width: number; depth: number };

export type CityParcel = CityFootprint & {
  id: string;
  kind: CityParcelKind;
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

export type CityTerrace = CityFootprint & {
  id: string;
  homes: number;
  style: 'wharf' | 'shops' | 'garden';
  facing: 'inner' | 'outer';
  sideFront?: 'east' | 'west';
  address?: { row: string; first: number };
};

export const cityTerraces: readonly CityTerrace[] = [
  { id: 'west-lock-houses', x: 5, z: 18, width: 3, depth: 2, homes: 3, style: 'wharf', facing: 'inner' },
  { id: 'dock-crescent', x: 8, z: 21, width: 5, depth: 2, homes: 4, style: 'wharf', facing: 'outer' },
  { id: 'garden-crescent', x: 14, z: 19, width: 7, depth: 3, homes: 5, style: 'garden', facing: 'inner' },
  { id: 'market-crescent', x: 26, z: 19, width: 4, depth: 3, homes: 4, style: 'shops', facing: 'inner' },
  { id: 'east-quay-houses', x: 32, z: 18, width: 4, depth: 2, homes: 4, style: 'wharf', facing: 'inner' },
  { id: 'wharf-granaries', x: 5, z: 29, width: 3, depth: 3, homes: 2, style: 'wharf', facing: 'inner' },
  { id: 'granary-gable', x: 8, z: 29, width: 2, depth: 2, homes: 1, style: 'wharf', facing: 'inner', address: { row: 'wharf-granaries', first: 3 } },
  { id: 'capstan-lane', x: 8, z: 31, width: 1, depth: 3, homes: 1, style: 'wharf', facing: 'outer', sideFront: 'east', address: { row: 'wharf-granaries', first: 4 } },
  { id: 'seafarer-place', x: 11, z: 33, width: 3, depth: 3, homes: 2, style: 'shops', facing: 'inner' },
  { id: 'sailmakers-yard', x: 14, z: 35, width: 2, depth: 2, homes: 1, style: 'shops', facing: 'inner', address: { row: 'seafarer-place', first: 3 } },
  { id: 'sailmakers-turn', x: 16, z: 33, width: 1, depth: 3, homes: 1, style: 'shops', facing: 'inner', sideFront: 'west', address: { row: 'seafarer-place', first: 4 } },
  { id: 'slate-gardens', x: 17, z: 29, width: 3, depth: 2, homes: 2, style: 'garden', facing: 'outer' },
  { id: 'fern-lodge', x: 20, z: 29, width: 2, depth: 3, homes: 1, style: 'garden', facing: 'outer', sideFront: 'east', address: { row: 'slate-gardens', first: 3 } },
  { id: 'market-row', x: 22, z: 35, width: 1, depth: 3, homes: 1, style: 'shops', facing: 'inner' },
  { id: 'salt-market-arcade', x: 23, z: 36, width: 2, depth: 2, homes: 1, style: 'shops', facing: 'inner', address: { row: 'market-row', first: 2 } },
  { id: 'salt-market-corner', x: 25, z: 35, width: 2, depth: 3, homes: 1, style: 'shops', facing: 'inner', sideFront: 'east', address: { row: 'market-row', first: 3 } },
  { id: 'station-road', x: 29, z: 30, width: 3, depth: 2, homes: 2, style: 'garden', facing: 'outer' },
  { id: 'signal-house', x: 32, z: 30, width: 2, depth: 3, homes: 1, style: 'garden', facing: 'outer', sideFront: 'east', address: { row: 'station-road', first: 3 } },
  { id: 'east-end', x: 31, z: 37, width: 3, depth: 3, homes: 2, style: 'wharf', facing: 'inner' },
  { id: 'dockgate-house', x: 34, z: 37, width: 2, depth: 3, homes: 1, style: 'wharf', facing: 'inner', sideFront: 'east', address: { row: 'east-end', first: 3 } },
];

export const harborHeight = 44;
export const outerRingStart = 29;
export const cityLighthouseSite = { x: 3.5, z: 9.42, widthScale: .69, lampHeight: 3.15 } as const;
export const ringBreakwaterSpans = [[31.78, 35.75], [37.06, 41.12], [42.43, 46.38]] as const;
export const reclaimedRingQuays = [
  [4, 17, 4, 6], [31, 17, 5, 5], [32, 22, 3, 1], [4, 23, 31, 6],
  [4, 29, 31, 3], [3, 32, 34, 3], [2, 35, 35, 4], [3, 39, 34, 2], [5, 41, 31, 3],
] as const;

export type CityCourtyard = CityFootprint & {
  id: string;
  label: string;
  kind: 'wharf' | 'garden' | 'market' | 'station';
  feature: CityFootprint;
};
export type CityAlleyBarrier = CityFootprint & { kind: 'brick' | 'hedge' | 'iron' | 'stone' };

export const cityForecourts = [
  { id: 'sailmakers-forecourt', label: '帆匠前庭', x: 14, z: 33, width: 2, depth: 2 },
  { id: 'salt-shop-porch', label: '盐铺门廊', x: 23, z: 35, width: 2, depth: 1 },
] as const;

export const cityGateSites = [
  { id: 'west-lock', x: 10, z: 29 },
  { id: 'fern-court', x: 22, z: 31 },
  { id: 'salt-market', x: 27, z: 29 },
] as const;

export const cityCourtyards: readonly CityCourtyard[] = [
  { id: 'lock-yard', label: '西闸仓院', x: 4, z: 36, width: 3, depth: 4, kind: 'wharf', feature: { x: 5, z: 37, width: 1, depth: 2 } },
  { id: 'fern-court', label: '蕨园内院', x: 17, z: 34, width: 5, depth: 4, kind: 'garden', feature: { x: 19, z: 35, width: 1, depth: 2 } },
  { id: 'salt-exchange', label: '盐市中庭', x: 23, z: 38, width: 4, depth: 2, kind: 'market', feature: { x: 25, z: 38, width: 1, depth: 1 } },
  { id: 'signal-yard', label: '信号场', x: 34, z: 35, width: 3, depth: 2, kind: 'station', feature: { x: 35, z: 35, width: 1, depth: 1 } },
];

export const cityAlleyBarriers: readonly CityAlleyBarrier[] = [
  { x: 6, z: 26, width: 3, depth: 1, kind: 'brick' },
  { x: 11, z: 25, width: 1, depth: 2, kind: 'brick' },
  { x: 11, z: 28, width: 1, depth: 2, kind: 'brick' },
  { x: 4, z: 33, width: 4, depth: 1, kind: 'brick' },
  { x: 10, z: 34, width: 1, depth: 2, kind: 'iron' },
  { x: 7, z: 36, width: 6, depth: 1, kind: 'stone' },
  { x: 10, z: 38, width: 1, depth: 3, kind: 'brick' },
  { x: 5, z: 41, width: 4, depth: 1, kind: 'iron' },
  { x: 14, z: 28, width: 1, depth: 3, kind: 'hedge' },
  { x: 12, z: 26, width: 3, depth: 1, kind: 'stone' },
  { x: 15, z: 28, width: 2, depth: 1, kind: 'hedge' },
  { x: 18, z: 25, width: 1, depth: 1, kind: 'hedge' },
  { x: 20, z: 25, width: 4, depth: 1, kind: 'hedge' },
  { x: 16, z: 37, width: 1, depth: 4, kind: 'hedge' },
  { x: 17, z: 39, width: 5, depth: 1, kind: 'hedge' },
  { x: 14, z: 41, width: 5, depth: 1, kind: 'iron' },
  { x: 23, z: 30, width: 1, depth: 3, kind: 'brick' },
  { x: 24, z: 32, width: 3, depth: 1, kind: 'brick' },
  { x: 25, z: 33, width: 2, depth: 1, kind: 'brick' },
  { x: 26, z: 28, width: 1, depth: 3, kind: 'brick' },
  { x: 27, z: 38, width: 1, depth: 3, kind: 'brick' },
  { x: 23, z: 40, width: 4, depth: 1, kind: 'stone' },
  { x: 28, z: 28, width: 1, depth: 5, kind: 'stone' },
  { x: 34, z: 34, width: 3, depth: 1, kind: 'iron' },
  { x: 30, z: 35, width: 1, depth: 4, kind: 'brick' },
  { x: 33, z: 41, width: 1, depth: 2, kind: 'iron' },
];

export const cityAlleys: readonly CityFootprint[] = [
  { x: 4, z: 28, width: 7, depth: 1 }, { x: 10, z: 27, width: 1, depth: 6 },
  { x: 4, z: 32, width: 4, depth: 1 }, { x: 9, z: 31, width: 1, depth: 5 },
  { x: 10, z: 32, width: 1, depth: 1 },
  { x: 3, z: 35, width: 7, depth: 1 }, { x: 3, z: 36, width: 1, depth: 5 },
  { x: 5, z: 40, width: 5, depth: 1 }, { x: 11, z: 40, width: 2, depth: 1 },
  { x: 13, z: 36, width: 1, depth: 7 },
  { x: 13, z: 25, width: 3, depth: 1 }, { x: 15, z: 26, width: 1, depth: 2 },
  { x: 12, z: 27, width: 4, depth: 1 }, { x: 13, z: 27, width: 1, depth: 5 },
  { x: 11, z: 31, width: 6, depth: 1 }, { x: 11, z: 32, width: 12, depth: 1 },
  { x: 22, z: 29, width: 1, depth: 3 },
  { x: 17, z: 33, width: 1, depth: 6 }, { x: 17, z: 38, width: 6, depth: 1 },
  { x: 22, z: 33, width: 1, depth: 2 }, { x: 22, z: 38, width: 1, depth: 5 },
  { x: 22, z: 34, width: 8, depth: 1 },
  { x: 24, z: 33, width: 1, depth: 1 }, { x: 27, z: 33, width: 8, depth: 1 },
  { x: 29, z: 33, width: 1, depth: 8 },
  { x: 27, z: 35, width: 1, depth: 3 }, { x: 34, z: 30, width: 1, depth: 3 },
  { x: 31, z: 35, width: 3, depth: 1 }, { x: 31, z: 36, width: 6, depth: 1 },
  { x: 36, z: 36, width: 1, depth: 5 }, { x: 28, z: 40, width: 9, depth: 1 },
  { x: 5, z: 42, width: 28, depth: 1 }, { x: 34, z: 42, width: 2, depth: 1 },
  ...cityForecourts,
];

function insideCityFootprint({ x, z, width, depth }: CityFootprint, column: number, row: number) {
  return column >= x && column < x + width && row >= z && row < z + depth;
}

export function cityCourtyardAt(x: number, z: number) {
  return cityCourtyards.find(court => insideCityFootprint(court, x, z));
}

export function cityAlleyAt(x: number, z: number) {
  return cityAlleys.some(lane => insideCityFootprint(lane, x, z));
}

export function cityTerraceAt(x: number, z: number) {
  return cityTerraces.some(lot => insideCityFootprint(lot, x, z));
}

export function cityTerraceFrontages(lot: CityTerrace): { x: number; z: number }[] {
  const { x, z, width, depth, homes, facing, sideFront } = lot;
  return Array.from({ length: homes }, (_, index) => {
    const fraction = (index + .5) / homes;
    if (sideFront) return { x: sideFront === 'east' ? x + width : x - 1, z: Math.floor(z + fraction * depth) };
    return { x: Math.floor(x + fraction * width), z: facing === 'inner' ? z - 1 : z + depth };
  });
}

export const cityTransit = { railZ: 5.38, railHeight: 4.12, fromX: 6.8, toX: 34.4 } as const;

export const cityViaductPiers = [7.58, 10.65, 14.36, 18.62, 23.39, 29.86, 33.44] as const;
export const cityFountainSite = { x: 23, z: 14, width: 2, depth: 2 } as const;

export const cityObstacles: readonly [number, number, number, number][] = [
  ...cityParcels.map(({ x, z, width, depth }): [number, number, number, number] => [x, z, width, depth]),
  ...cityTerraces.map(({ x, z, width, depth }): [number, number, number, number] => [x, z, width, depth]),
  ...cityAlleyBarriers.map(({ x, z, width, depth }): [number, number, number, number] => [x, z, width, depth]),
  ...cityCourtyards.map(({ feature: { x, z, width, depth } }): [number, number, number, number] => [x, z, width, depth]),
  ...cityViaductPiers.map((x): [number, number, number, number] => [Math.floor(x), Math.floor(cityTransit.railZ), 1, 1]),
  [cityFountainSite.x, cityFountainSite.z, cityFountainSite.width, cityFountainSite.depth],
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
  if (z >= 27) {
    const forecourt = cityForecourts.find(court => insideCityFootprint(court, x, z));
    if (forecourt) return forecourt.label;
    const court = cityCourtyardAt(x, z);
    if (court) return court.label;
    if (x < 11) return '西闸仓巷';
    if (x < 22) return '板岩花园街';
    if (x < 30) return '盐市窄巷';
    return '东埠信号街';
  }
  if (z >= 23) return '海堤排屋街';
  if (x < 7) return '西侧渡口';
  if (x === 37 && z >= 14) return '东渡口';
  if (x > 32 && z < 6) return '潮门公园';
  if (z > 13 && x >= 14 && x < 34) return '外环绿廊';
  if (x > 30) return '东站桥区';
  if (z < 6) return '内环街区';
  return '环城大道';
}
