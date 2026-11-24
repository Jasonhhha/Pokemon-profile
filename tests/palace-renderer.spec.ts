import { expect, test } from '@playwright/test';
import { adventure, view } from './maze-route';

test('a restored GPU rejoins the same expedition after movement and rotation in Canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      'tidebound-save-v1',
      JSON.stringify({
        fortressOpened: true,
        location: { area: 'harbor', fortressRoom: 'sluice', x: 8, y: 12 },
      }),
    );
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(get, {
      apply(target, canvas, args) {
        const context = Reflect.apply(target, canvas, args);
        if (args[0] === 'webgl2' && context) {
          const extension = (context as WebGL2RenderingContext).getExtension('WEBGL_lose_context')!;
          Reflect.set(window, 'palaceContext', extension);
        }
        return context;
      },
    });
  });
  await page.goto('/');
  const canvas = page.locator('.game-canvas canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  for (const width of [390, 960]) {
    await page.evaluate(() => Reflect.get(window, 'palaceContext').loseContext());
    await expect(canvas).toHaveAttribute('data-renderer', 'canvas2d');
    await page.setViewportSize({ width, height: width === 390 ? 760 : 520 });
    const start = (await adventure(page)).location.y;
    await page.getByRole('application').press('ArrowUp');
    await expect.poll(async () => (await adventure(page)).location.y).toBe(start - 1);
    await page.evaluate(() => Reflect.get(window, 'palaceContext').restoreContext());
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
    await expect(view(page)).toHaveAttribute('data-room', 'sluice');
    expect((await adventure(page)).location).toMatchObject({ x: 8, y: start - 1 });
  }
  expect(errors).toEqual([]);
});
