import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('.map-loading')).toHaveCount(0);
  await page.waitForFunction(() => Boolean((window as any).__town));
};

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test('legacy and malformed saves recover without a blank page', async ({ page }) => {
  for (const partner of ['pikachu', 'monferno', 'toString', null]) {
    await page.addInitScript(value => {
      localStorage.setItem('yu-world-partner', JSON.stringify(value));
      localStorage.setItem('yu-world-profile', 'null');
      localStorage.setItem('yu-world-badges', '{}');
    }, partner);
    await ready(page);
    await expect(page.getByRole('heading', { name: '嗨，我是王禹浩.' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__town.getState().partner)).toBe('gible');
  }
});

test('all region destinations are reachable and all Pokemon details load', async ({ page }) => {
  await ready(page);
  for (const [name, id] of [['双叶镇', 'twinleaf'], ['心齐湖', 'verity'], ['天冠山', 'coronet']]) {
    await page.getByRole('button', { name: new RegExp(name) }).first().click();
    await expect(page.locator('.world-area')).toHaveAttribute('data-region', id);
    const spots = await page.evaluate(() => {
      const town = (window as any).__town;
      const grid = town.getGrid();
      const { x, y } = town.getState();
      const queue = [[x, y]], seen = new Set([`${x},${y}`]);
      for (let i = 0; i < queue.length; i++) {
        const [cx, cy] = queue[i];
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          const key = `${nx},${ny}`;
          if (grid[ny]?.[nx] === 0 && !seen.has(key)) { seen.add(key); queue.push([nx, ny]); }
        }
      }
      return town.getSpots().map((spot: any) => ({ ...spot, reachable: seen.has(`${spot.x},${spot.y}`) }));
    });
    expect(spots.every((spot: any) => spot.reachable)).toBe(true);
    for (const spot of spots) {
      await page.evaluate(destination => (window as any).__town.travel(destination), spot.id);
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 12_000 });
      const picture = page.locator('.pokemon-detail img');
      if (await picture.count()) {
        await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      await page.getByRole('button', { name: '关闭', exact: true }).click();
    }
  }
});

test('cross-region travel, partner persistence and keyboard focus work', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '查看利欧路' }).click();
  await page.getByRole('button', { name: '选择为同行伙伴' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /天冠山/ }).first().click();
  await page.getByRole('button', { name: '目的地' }).click();
  await page.getByRole('button', { name: '小镇邮箱', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.world-area')).toHaveAttribute('data-region', 'twinleaf');
  await page.keyboard.press('Escape');
  await expect(page.locator('.game-canvas')).toBeFocused();
  const before = await page.evaluate(() => ({ ...((window as any).__town.getState()), scroll: scrollY }));
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => (window as any).__town.getState().y)).toBe(before.y + 1);
  expect(await page.evaluate(() => scrollY)).toBe(before.scroll);
  await page.reload();
  await page.waitForFunction(() => (window as any).__town?.getState().partner === 'riolu');
  await page.getByRole('button', { name: '切换到夜晚' }).click();
  await page.getByRole('button', { name: /心齐湖/ }).first().click();
  expect(await page.evaluate(() => (window as any).__town.getState().night)).toBe(true);
});

test('desktop and mobile canvases stay sharp, visible and responsive', async ({ browser }) => {
  for (const [width, height, density] of [[1440, 960, 1], [390, 844, 3], [320, 740, 2]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: density });
    const page = await context.newPage();
    await ready(page);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const canvas = page.locator('.game-canvas canvas');
    expect(await canvas.evaluate((element: HTMLCanvasElement) => element.width >= element.getBoundingClientRect().width * devicePixelRatio - 1)).toBe(true);
    // WebGL clears its drawing buffer between frames; inspect the compositor screenshot.
    const screenshot = await canvas.screenshot();
    const pixels = await page.evaluate(async dataUrl => {
      const image = new Image(); image.src = dataUrl; await image.decode();
      const copy = document.createElement('canvas'); copy.width = 64; copy.height = 64;
      const ctx = copy.getContext('2d')!; ctx.drawImage(image, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const colors = new Set(); let opaque = 0;
      for (let i = 0; i < data.length; i += 4) { colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); if (data[i + 3] > 0) opaque++; }
      return { colors: colors.size, opaque };
    }, `data:image/png;base64,${screenshot.toString('base64')}`);
    expect(pixels.colors).toBeGreaterThan(20);
    expect(pixels.opaque).toBe(4096);
    if (width < 680) {
      await page.getByRole('button', { name: '向下移动' }).click();
      await expect.poll(() => page.evaluate(() => (window as any).__town.getState().y)).toBe(12);
    }
    await page.screenshot({ path: `artifacts/verified-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /天冠山/ }).first().click();
    await page.waitForTimeout(350);
    const frame = await canvas.screenshot();
    await page.waitForTimeout(250);
    expect((await canvas.screenshot()).equals(frame)).toBe(false);
    await context.close();
  }
});
