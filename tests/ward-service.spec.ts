import { expect, test, type Page } from '@playwright/test';
import { wardPosts } from '../src/fortress-ward-service';
import { adventure, button, view } from './maze-route';

type Tile = { x: number; y: number };
const bridge = { x: 8, y: 11 };

async function openSanctum(page: Page, location: Tile, ward?: unknown) {
  await page.addInitScript(({ location, ward }) => {
    if (!localStorage.getItem('tidebound-save-v1')) {
      localStorage.setItem('tidebound-save-v1', JSON.stringify({
        fortressOpened: true,
        location: { area: 'harbor', fortressRoom: 'seal', ...location },
        ward,
      }));
    }
  }, { location, ward });
  await page.goto('./');
  await expect(view(page)).toHaveAttribute('data-room', 'seal');
}

// Follow the actual service gallery, first along the crosswalk and then along its outer wall.
// Waiting on every footprint catches a missing tile as well as a nonresponsive touch control.
async function followWalkway(page: Page, stops: Tile[], touch = false) {
  let { x, y } = (await adventure(page)).location;
  await page.getByRole('application').focus();
  for (const stop of stops) {
    expect(x === stop.x || y === stop.y).toBe(true);
    while (x !== stop.x || y !== stop.y) {
      const dx = Math.sign(stop.x - x), dy = Math.sign(stop.y - y);
      const key = dx < 0 ? 'Left' : dx > 0 ? 'Right' : dy < 0 ? 'Up' : 'Down';
      const label = { Left:'向左移动', Right:'向右移动', Up:'向上移动', Down:'向下移动' }[key];
      if (touch) await button(page, label).tap();
      else await page.keyboard.press('Arrow' + key);
      x += dx;
      y += dy;
      await page.waitForFunction(({ x, y }) => {
        const save = JSON.parse(localStorage.getItem('tidebound-save-v1') ?? '{}');
        return save.location?.x === x && save.location?.y === y;
      }, { x, y }, { timeout: 4000 });
    }
  }
}

function bridgeToPost(tile: Tile) {
  const side = tile.x < bridge.x ? 2 : 14;
  return [{ x: bridge.x, y: 12 }, { x: side, y: 12 }, { x: side, y: tile.y }, tile];
}

async function returnToBridge(page: Page, tile: Tile, touch = false) {
  await followWalkway(page, [...bridgeToPost(tile)].reverse().concat(bridge), touch);
}

test('walk to the loose chain, keep the repair on reload, and certify it only after a fresh pressure wave', async ({ page }, info) => {
  test.setTimeout(100_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let quietTones = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      const stage = document.querySelector<HTMLElement>('.game-viewport');
      if (stage?.dataset.wardPhase === 'seeking' && stage.dataset.roarPhase === 'quiet') ++quietTones;
      return start.apply(this, args);
    };
    Object.defineProperty(window, 'quietServiceTones', { get: () => quietTones });
  });
  await openSanctum(page, bridge); // A seal save written before the service galleries existed.
  await expect(page.locator('.game-canvas canvas')).toHaveAttribute('data-renderer', 'webgl');
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'idle');
  await button(page, '靠近封印').click();
  await button(page, '巡查锁链').click();
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'seeking');
  await expect(view(page)).not.toHaveAttribute('data-observing-seal', 'true');

  const hint = page.locator('.ward-readout').getByRole('status');
  await expect(hint).toContainText(/(东侧|西侧)传来两声回震/);
  const west = (await hint.innerText()).includes('西侧');
  const candidates = wardPosts.filter(post => (post.tile.x < bridge.x) === west);
  const healthy = wardPosts.find(post => (post.tile.x < bridge.x) !== west)!;
  await followWalkway(page, bridgeToPost(healthy.tile));
  expect(await page.evaluate(() => Reflect.get(window, 'quietServiceTones'))).toBe(0);
  await button(page, '检查锚柱').click();
  await expect(hint).toContainText('锁链正常');
  await expect(button(page, '收紧锁链')).toHaveCount(0);
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'seeking');
  await returnToBridge(page, healthy.tile);

  // Identify the faulty winch from its inspection rather than reading the hidden save value.
  let target: typeof wardPosts[number] | undefined;
  for (const post of candidates) {
    await followWalkway(page, bridgeToPost(post.tile));
    await button(page, '检查锚柱').click();
    await expect(hint).toContainText(/锁链正常|可以收紧锁链/);
    if (await button(page, '收紧锁链').isVisible()) { target = post; break; }
    await returnToBridge(page, post.tile);
  }
  if (!target) throw Error('Neither winch on the signalled side registered the loose chain');
  const fault = target.id;
  await expect(button(page, '收紧锁链')).toBeEnabled();
  await view(page).screenshot({ path: info.outputPath('loose-anchor.png') });
  await button(page, '收紧锁链').click();
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'braced');
  await page.reload();
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'braced');
  expect((await adventure(page)).location).toMatchObject(target.tile);
  await returnToBridge(page, target.tile);
  await button(page, '靠近封印').click();
  await button(page, '复测封印').click();
  await expect(view(page)).toHaveAttribute('data-ward-testing', 'true');
  await page.reload();
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'braced');
  await button(page, '靠近封印').click();
  await button(page, '复测封印').click();
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'stable');
  await expect(view(page)).not.toHaveAttribute('data-ward-testing', 'true');
  await expect(button(page, '开启声音')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(view(page)).toHaveAttribute('data-ward-phase', 'stable');
  expect((await adventure(page)).ward).toMatchObject({ phase: 'stable', fault });
  await button(page, '靠近封印').click();
  await button(page, '复测封印').click();
  await expect(view(page)).toHaveAttribute('data-ward-testing', 'true');
  await expect(view(page)).not.toHaveAttribute('data-ward-testing', 'true');
  expect((await adventure(page)).ward).toMatchObject({ phase: 'stable', fault });
  await page.getByRole('application').press('j');
  const note = page.getByRole('dialog', { name:'群岛图鉴' }).locator('.ward-field-note');
  await expect(note).toContainText('封印殿巡检手记');
  await expect(note).toContainText(target.name + '的止退爪已经归位');
  expect(errors).toEqual([]);
});

test('a narrow Canvas-only player can follow another pulse and operate the winch from the gallery', async ({ browser }, info) => {
  test.setTimeout(65_000);
  const page = await browser.newPage({ viewport:{width:320,height:720}, hasTouch:true, reducedMotion:'reduce' });
  try {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = new Proxy(original, {
        apply(target, self, args) { return String(args[0]).includes('webgl') ? null : Reflect.apply(target, self, args); },
      });
      const pans: number[] = [];
      const wire = AudioNode.prototype.connect;
      AudioNode.prototype.connect = new Proxy(wire, {
        apply(target, self, args) {
          if (self instanceof StereoPannerNode) pans.push(self.pan.value);
          return Reflect.apply(target, self, args);
        },
      });
      Object.defineProperty(window, 'serviceEchoPans', { get: () => pans.slice() });
    });
    const target = wardPosts.find(post => post.id === 'ne')!;
    const healthy = wardPosts.find(post => post.id === 'se')!;
    await openSanctum(page, healthy.tile, { phase:'seeking', fault:target.id });
    await expect(page.locator('.game-canvas canvas')).toHaveAttribute('data-renderer', 'canvas2d');
    await button(page, '向左移动').tap(); // The ice behind this eastern post is inside the sealed basin.
    await button(page, '再听一次回震').tap();
    await expect(view(page)).toHaveAttribute('data-roar-phase', 'impact');
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'serviceEchoPans').some((pan: number) => pan > .5))).toBe(true);
    expect((await adventure(page)).location).toMatchObject(healthy.tile);
    await button(page, '检查锚柱').tap();
    await expect(button(page, '收紧锁链')).toHaveCount(0);
    await followWalkway(page, [{ x:14, y:target.tile.y }, target.tile], true);
    await button(page, '检查锚柱').tap();
    await button(page, '收紧锁链').tap();
    await expect(view(page)).toHaveAttribute('data-ward-phase', 'braced');
    await view(page).screenshot({ path: info.outputPath('repaired-anchor-mobile.png') });
    await returnToBridge(page, target.tile, true);
    await button(page, '靠近封印').tap();
    await button(page, '复测封印').tap();
    await expect(view(page)).toHaveAttribute('data-ward-phase', 'stable');
    await expect(button(page, '开启声音')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await page.close(); }
});

for (const fault of [undefined, 'outside-the-vault']) {
  test(`a braced save with a ${fault ? 'malformed' : 'missing'} anchor can begin a new inspection`, async ({ page }) => {
    await openSanctum(page, bridge, { phase:'braced', fault });
    await expect(view(page)).toHaveAttribute('data-ward-phase', 'idle');
    await button(page, '靠近封印').click();
    await expect(button(page, '巡查锁链')).toBeEnabled();
    await button(page, '巡查锁链').click();
    await expect(view(page)).toHaveAttribute('data-ward-phase', 'seeking');
    const { ward } = await adventure(page);
    expect(wardPosts.some(post => post.id === ward.fault)).toBe(true);
  });
}
