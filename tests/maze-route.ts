import { expect, type Page } from '@playwright/test';
import { mazeFieldMap, type MazePoint, type MazeRoom } from '../src/fortress-maze';

export const adventure = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1') ?? '{}'));
export const view = (page: Page) => page.locator('.game-viewport');
export const button = (page: Page, name: string) => page.getByRole('button', {name, exact:true});
type Heading = 'Up' | 'Down' | 'Left' | 'Right';
const directions: [Heading, number, number][] = [['Up',0,-1],['Down',0,1],['Right',1,0],['Left',-1,0]];

export function route(room: MazeRoom, from: MazePoint, to: MazePoint, open: boolean) {
  const map = mazeFieldMap(room, open), queue = [from];
  const key = (p: MazePoint) => p.y * map.width + p.x;
  const previous = new Map<number, { from: MazePoint; heading: Heading }>();
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]; if (key(at) === key(to)) break;
    for (const [heading,dx,dy] of directions) {
      const x = at.x+dx, y=at.y+dy, point={x,y};
      if (!map.walkable[y]?.[x] || previous.has(key(point)) || key(point) === key(from)) continue;
      previous.set(key(point),{from:at,heading}); queue.push(point);
    }
  }
  const path: { point: MazePoint; heading: Heading }[] = [];
  let at = to;
  while (key(at) !== key(from)) {
    const prior = previous.get(key(at)); if (!prior) throw Error('Unreachable floor destination');
    path.push({point:at,heading:prior.heading}); at=prior.from;
  }
  return path.reverse();
}

export async function walk(page: Page, room: MazeRoom, to: MazePoint, mobile = false) {
  const save = await adventure(page);
  expect(save.location.fortressRoom).toBe(room);
  const path = route(room, save.location, to, save.shortcuts.includes(room));
  const field = page.getByRole('application');
  await field.focus();
  const labels = { Up:'向上移动', Down:'向下移动', Left:'向左移动', Right:'向右移动' };
  for (const {point, heading} of path) {
    if (mobile) await button(page,labels[heading]).tap();
    else await page.keyboard.press('Arrow'+heading);
    await page.waitForFunction(({x,y}) => {
      const location=JSON.parse(localStorage.getItem('tidebound-save-v1') ?? '{}').location;
      return location?.x === x && location?.y === y;
    }, point, {timeout:3500});
  }
}
