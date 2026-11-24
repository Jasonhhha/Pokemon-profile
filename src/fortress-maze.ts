import type { FieldMap } from './field-layout';

export type MazeRoom = 'aqueduct' | 'catacomb';
export const catacombLift = { x: 3, y: 6 } as const;
export type MazeTile = 'wall' | 'channel' | 'stone' | 'bridge' | 'ice' | 'grate' | 'gate';
export type MazePoint = { x: number; y: number };
type Landmark = MazePoint & { name: string; kind: 'turbine' | 'gauge' | 'sarcophagus' | 'prism' };
type MazeFloor = {
  width: number;
  height: number;
  tiles: MazeTile[][];
  up: MazePoint;
  down: MazePoint;
  switch: MazePoint;
  gate: MazePoint;
  landmarks: Landmark[];
  gateName: string;
  switchName: string;
};

const legend: Record<string, MazeTile> = {
  '#': 'wall',
  '~': 'channel',
  '.': 'stone',
  '=': 'bridge',
  '*': 'ice',
  '+': 'grate',
  G: 'gate',
};

function floor(rows: string[], metadata: Omit<MazeFloor, 'tiles' | 'width' | 'height' | 'gate'>): MazeFloor {
  const tiles = rows.map((row) => [...row].map((symbol) => legend[symbol]));
  const y = rows.findIndex((row) => row.includes('G'));
  return { ...metadata, tiles, height: rows.length, width: rows[0].length, gate: { x: rows[y].indexOf('G'), y } };
}

export const mazeFloors: Record<MazeRoom, MazeFloor> = {
  aqueduct: floor(
    [
      '#######################',
      '#######################',
      '##~~~~~##.~~####~.+.~##',
      '##...~~##.~~####~.+.~##',
      '##.....==...####~~..~##',
      '##~.~.~##~~.####.=..~##',
      '##~...~~~~~...~~.~~.~##',
      '##~.~#~~~~~=~.~++...~##',
      '###.....~~~=~.~++.~~~##',
      '######~=~~~...~++.~~~##',
      '######~=~~...##.~~~~~##',
      '##...~~.~~..==..~~.~~##',
      '##...==.~~~~~#+.~~.####',
      '##~=##.~~~~~~.+.~~.####',
      '##~=##.~~~~~~......####',
      '##~....~~~~~~#.~~~~~~##',
      '##~.~~~~~~~~~~.~~~~~~##',
      '##~.....G..==..~~~~~~##',
      '##~...~~~~~#####~~~~~##',
      '##~++.~~~~~#####~~~~~##',
      '##~...~~~~~#####~~~~~##',
      '#######################',
      '#######################',
    ],
    {
      up: { x: 4, y: 19 },
      down: { x: 18, y: 3 },
      switch: { x: 16, y: 8 },
      switchName: '浮桥绞盘',
      gateName: '回流吊桥',
      landmarks: [
        { x: 8, y: 9, kind: 'turbine', name: '分流叶轮' },
        { x: 17, y: 11, kind: 'gauge', name: '东岸水尺' },
        { x: 6, y: 16, kind: 'gauge', name: '南港水尺' },
      ],
    },
  ),
  catacomb: floor(
    [
      '#######################',
      '#######################',
      '###...~~~~~~###~~~~~~##',
      '###...~~~~~~##...***~##',
      '###.~....~~~##.~~***~##',
      '###.~~~~.~~~##...~.~~##',
      '###.####.#...#.#.#...##',
      '###.#....#..**...###.##',
      '###...**.##.#.##.###.##',
      '######.~~##...#.*~~~.##',
      '######.~~##.#~~.*....##',
      '##~~~#......#~~..~~~.##',
      '##~~~#.~~#.##~~~~~~~*##',
      '##~~~#.~~.*.#~~~~###*##',
      '##~~~#.~..*....~~###.##',
      '##~~~....####~G~~##..##',
      '##~~~....#####.####..##',
      '##~~~#########.......##',
      '#####~~~~########....##',
      '#####~~~~########...###',
      '#####~~~~########...###',
      '#######################',
      '#######################',
    ],
    {
      up: { x: 18, y: 19 },
      down: { x: 4, y: 3 },
      switch: { x: 6, y: 8 },
      switchName: '冰纹轮锁',
      gateName: '霜脉铁栅',
      landmarks: [
        { x: 8, y: 10, kind: 'sarcophagus', name: '覆霜石棺' },
        { x: 17, y: 12, kind: 'prism', name: '主冰脉' },
        { x: 7, y: 3, kind: 'prism', name: '北陵冰柱' },
      ],
    },
  ),
};

export function isMazeRoom(value: unknown): value is MazeRoom {
  return value === 'aqueduct' || value === 'catacomb';
}

function collision(room: MazeRoom, open: boolean): FieldMap {
  const { width, height, tiles, up } = mazeFloors[room];
  const walkable = tiles.map((row) =>
    row.map((tile) => tile !== 'wall' && tile !== 'channel' && (tile !== 'gate' || open)),
  );
  return { width, height, walkable, grass: tiles.map((row) => row.map(() => false)), spawn: up, exits: [], npcs: [] };
}

const maps = {
  aqueduct: [collision('aqueduct', false), collision('aqueduct', true)],
  catacomb: [collision('catacomb', false), collision('catacomb', true)],
};

export function mazeFieldMap(room: MazeRoom, shortcutOpen = false): FieldMap {
  return maps[room][Number(shortcutOpen)];
}
