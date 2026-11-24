import { expect, test, type Page } from '@playwright/test';

const viewport = (page: Page) => page.locator('.game-viewport');
const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1') ?? '{}'));
const field = (page: Page) => page.getByRole('application');

test('raise and drain the city, walk through both underground levels and revisit the seal', async ({ page }, testInfo) => {
  test.setTimeout(75_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await action(page, '前往西栈桥').click();
  await action(page, '升起堡垒').click();
  await expect(viewport(page)).toHaveAttribute('data-fortress-phase', 'rising');
  await field(page).press('e');
  await expect(action(page, '进入堡垒')).toHaveCount(0);
  await page.reload();
  await expect(viewport(page)).toHaveAttribute('data-fortress-phase', 'draining', { timeout: 9000 });
  await expect(action(page, '群岛航线')).toBeDisabled();
  await field(page).press('e');
  await expect(viewport(page)).not.toHaveAttribute('data-room', 'sluice');
  await viewport(page).screenshot({ path: testInfo.outputPath('draining.png') });
  await action(page, '进入堡垒').click({ timeout: 12000 });
  await expect(viewport(page)).toHaveAttribute('data-room', 'sluice');
  await field(page).press('ArrowLeft');
  await expect.poll(async () => (await saved(page)).location.x).toBe(7);
  await field(page).press('ArrowLeft');
  await field(page).press('ArrowUp');
  await expect.poll(async () => (await saved(page)).location).toMatchObject({ x: 7, y: 15 });
  await viewport(page).screenshot({ path: testInfo.outputPath('gallery.png') });
  await action(page, '前往下层').click();
  await expect(viewport(page)).toHaveAttribute('data-room', 'seal');
  await action(page, '靠近封印').click();
  await expect(viewport(page)).toHaveAttribute('data-observing-seal', 'true');
  await expect(page.getByText('盖欧卡', { exact: true })).toBeVisible();
  await expect(field(page).locator('canvas')).toHaveAttribute('data-renderer', 'webgl');
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('/kyogre.glb')))).toBe(true);
  await viewport(page).screenshot({ path: testInfo.outputPath('kyogre.png') });
  await action(page, '返回观测桥').click();
  await page.reload();
  await expect(viewport(page)).toHaveAttribute('data-room', 'seal');
  await action(page, '返回闸廊').click();
  await action(page, '返回栈桥').click();
  await expect(action(page, '进入堡垒')).toBeVisible();
  await action(page, '重看浮升').click();
  await expect(viewport(page)).toHaveAttribute('data-fortress-phase', 'rising');
  await page.reload();
  await expect(action(page, '进入堡垒')).toBeVisible();
  expect((await saved(page)).fortressOpened).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile fallback supports reduced motion, touch walking and seal inspection', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 700 }, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = new Proxy(original, { apply(target, self, args) {
        return String(args[0]).includes('webgl') ? null : Reflect.apply(target, self, args);
      } });
    });
    await page.goto('/');
    await action(page, '前往西栈桥').tap();
    await action(page, '升起堡垒').tap();
    await action(page, '进入堡垒').tap();
    await action(page, '向上移动').tap();
    await expect.poll(async () => (await saved(page)).location.y).toBe(15);
    await action(page, '前往下层').tap();
    await action(page, '靠近封印').tap();
    await expect(viewport(page)).toHaveAttribute('data-observing-seal', 'true');
    await expect(field(page).locator('canvas')).toHaveAttribute('data-renderer', 'canvas2d');
    await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('/kyogre.png')))).toBe(true);
    await viewport(page).screenshot({ path: test.info().outputPath('kyogre-mobile.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await page.close(); }
});
