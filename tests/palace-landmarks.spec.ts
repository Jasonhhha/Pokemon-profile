import { expect, test } from '@playwright/test';
import { adventure, view } from './maze-route';

for (const gpu of [true, false]) {
  test(
    (gpu ? '3D' : 'Canvas') + ' scenery takes a touch player through the palace doors and onto the observation bridge',
    async ({ browser }) => {
      const page = await browser.newPage({
        viewport: { width: 390, height: 820 },
        reducedMotion: 'reduce',
        hasTouch: true,
      });
      try {
        await page.addInitScript((webgl) => {
          if (!webgl) {
            const get = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = new Proxy(get, {
              apply(target, canvas, args) {
                return String(args[0]).includes('webgl') ? null : Reflect.apply(target, canvas, args);
              },
            });
          }
          const q = new URLSearchParams(location.search);
          localStorage.setItem(
            'tidebound-save-v1',
            JSON.stringify({
              fortressOpened: true,
              location: { area: 'harbor', fortressRoom: q.get('floor'), x: 8, y: Number(q.get('row')) },
            }),
          );
        }, gpu);
        const canvas = page.locator('.game-canvas canvas');
        async function tapScenery(room: string, row: number, pixel: [number, number], tread = false) {
          await page.goto('/?floor=' + room + '&row=' + row);
          await canvas.scrollIntoViewIfNeeded();
          await expect(page.locator('.loading')).toHaveCount(0);
          await expect(canvas).toHaveAttribute('data-renderer', gpu ? 'webgl' : 'canvas2d');
          const box = (await canvas.boundingBox())!;
          const [px, py] = tread ? await page.evaluate(([x, z]) => {
            const field = (window as Window & { __field: {
              getCamera(): { width: number; height: number }; projectPoint(x: number, y: number): { x: number; y: number };
            } }).__field;
            const point = field.projectPoint(x * 16, z * 16);
            const frame = field.getCamera();
            return [point.x / frame.width, point.y / frame.height];
          }, pixel) : pixel;
          expect(px).toBeGreaterThan(0);
          expect(px).toBeLessThan(1);
          expect(py).toBeGreaterThan(0);
          expect(py).toBeLessThan(1);
          await page.touchscreen.tap(box.x + box.width * px, box.y + box.height * py);
        }
        // Land the finger on modeled treads beyond the walkable grid, and on the body inside the barrier.
        await tapScenery('sluice', 6, [8.5, 2.41], true);
        await expect(view(page)).toHaveAttribute('data-room', 'aqueduct');
        await tapScenery('sluice', 16, [8.5, 18.41], true);
        await expect
          .poll(async () => (await adventure(page)).location)
          .toMatchObject({ area: 'harbor', wallPassage: true, x: 3, y: 2 });
        await tapScenery('seal', 16, gpu ? [0.465, 0.873] : [0.459, 0.974]);
        await expect(view(page)).toHaveAttribute('data-room', 'catacomb');
        await tapScenery('seal', 16, gpu ? [0.518, 0.277] : [0.518, 0.209]);
        await expect(view(page)).toHaveAttribute('data-observing-seal', 'true');
        expect((await adventure(page)).kyuremObserved).toBe(true);
      } finally {
        await page.close();
      }
    },
  );
}

test('the return control walks the outer gallery and the whole observation bridge before climbing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const room = new URLSearchParams(location.search).get('floor');
    const [x, y] = room === 'seal' ? [8, 11] : [1, 5];
    localStorage.setItem(
      'tidebound-save-v1',
      JSON.stringify({ fortressOpened: true, location: { area: 'harbor', fortressRoom: room, x, y } }),
    );
    const visits: { x: number; y: number }[] = [{ x, y }],
      original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      original.call(this, key, value);
      if (key !== 'tidebound-save-v1') return;
      const at = JSON.parse(value).location,
        previous = visits[visits.length - 1];
      if (at.fortressRoom === room && (at.x !== previous.x || at.y !== previous.y)) visits.push({ x: at.x, y: at.y });
    };
    Object.defineProperty(window, 'returnTrail', { get: () => visits });
  });
  for (const floor of ['sluice', 'seal'] as const) {
    await page.goto('/?floor=' + floor);
    await expect(view(page)).toHaveAttribute('data-room', floor);
    await page.getByRole('button', { name: floor === 'sluice' ? '返回下层王门' : '返回陵宫', exact: true }).click();
    const expected = floor === 'sluice' ? { wallPassage: true, x: 3, y: 2 } : { fortressRoom: 'catacomb' };
    await expect.poll(async () => (await adventure(page)).location, { timeout: 14000 }).toMatchObject(expected);
    const legs = await page.evaluate(() => Reflect.get(window, 'returnTrail') as { x: number; y: number }[]);
    expect(legs.length).toBeGreaterThan(floor === 'sluice' ? 15 : 6);
    for (let i = 1; i < legs.length; i++)
      expect(Math.abs(legs[i].x - legs[i - 1].x) + Math.abs(legs[i].y - legs[i - 1].y)).toBe(1);
  }
});
