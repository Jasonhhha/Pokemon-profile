import { mazeFloors, palaceElevation, type MazeRoom } from './fortress-maze';

export function processionalSign(room: MazeRoom, down: boolean) {
  const cold = room === 'catacomb',
    at = mazeFloors[room][down ? 'down' : 'up'];
  const x = at.x + 0.5,
    z = at.y + 0.5;
  return {
    x,
    y: palaceElevation(room, x, z) + (cold ? (down ? 3.63 : 3.04) : down ? 4.05 : 3.47),
    z: z + (cold ? 0.83 : 0.31),
    w: 1.31,
    h: 0.54,
    text: down ? (cold ? '↓ B4' : '↓ B3') : cold ? '↑ B2' : '↑ B1',
  };
}

const faces = new Map<string, HTMLCanvasElement>();
export function stairFace(text: string, down: boolean) {
  const cached = faces.get(text);
  if (cached) return cached;
  const sheet = document.createElement('canvas');
  sheet.width = 256;
  sheet.height = 100;
  const c = sheet.getContext('2d')!;
  c.fillStyle = '#182d32';
  c.fillRect(0, 0, 256, 100);
  c.strokeStyle = down ? '#8acfc4' : '#d6b97e';
  c.lineWidth = 5;
  c.strokeRect(5, 5, 246, 90);
  c.fillStyle = down ? '#c4eee1' : '#edd4a2';
  c.font = 'bold 42px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 127, 51);
  faces.set(text, sheet);
  return sheet;
}
