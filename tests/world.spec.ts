import { expect, test, type Page } from '@playwright/test';

type Location = { area: 'harbor' | 'grove' | 'summit'; x: number; y: number; room?: 'home' | 'lab' | 'tower' };
type Frame = { x: number; y: number; scale: number; depth: number; width: number; height: number };
type FieldWindow = Window & {
  __field?: { getLocation: () => Location; getCamera: () => Frame; projectPoint: (x: number, y: number) => { x: number; y: number }; getRustle: () => { x: number; y: number } | null };
  getBrowserErrors?: () => Promise<string[]>;
};
const position = (page: Page) => page.evaluate(() => (window as FieldWindow).__field?.getLocation() ?? null);
const field = (page: Page) => page.locator('.game-canvas');

async function ready(page: Page) {
  await page.goto('/');
  await expect(field(page).locator('canvas')).toBeVisible();
  await expect(page.locator('.game-viewport .loading')).toHaveCount(0);
  await page.waitForFunction(() => Boolean((window as FieldWindow).__field));
}

async function step(page: Page, direction: 'Left' | 'Right' | 'Up' | 'Down', number = 1) {
  for (let i = 0; i < number; i++) {
    const start = await position(page);
    await page.keyboard.press(`Arrow${direction}`);
    await expect.poll(() => position(page), { intervals: [25, 45, 70], timeout: 2200 }).not.toEqual(start);
  }
}

async function meetFirstWild(page: Page) {
  await field(page).focus();
  await step(page, 'Down', 2);
  await step(page, 'Right', 5);
  return page.getByRole('region', { name: '野外战斗' });
}

async function tapSteps(page: Page, name: string, count = 1) {
  for (let i = 0; i < count; i++) {
    const start = await position(page);
    await page.getByRole('button', { name }).tap();
    await expect.poll(() => position(page), { intervals: [25, 45, 70] }).not.toEqual(start);
  }
}

async function clickTile(page: Page, x: number, y: number) {
  await field(page).locator('canvas').scrollIntoViewIfNeeded();
  const point = await page.evaluate(({ tileX, tileY }) => {
    const field = (window as FieldWindow).__field!;
    const { width, height } = field.getCamera();
    const screen = field.projectPoint(tileX * 16 + 8, tileY * 16 + 8);
    const rect = document.querySelector('.game-canvas canvas')!.getBoundingClientRect();
    return { x: rect.left + rect.width * screen.x / width, y: rect.top + rect.height * screen.y / height };
  }, { tileX: x, tileY: y });
  await page.mouse.click(point.x, point.y);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/Shader Error|INVALID_OPERATION: useProgram|WebGL field render switched to Canvas2D|WebGL field initialization could not finish/.test(message.text())) errors.push(message.text());
  });
  await page.exposeFunction('getBrowserErrors', () => errors);
});

test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => (window as FieldWindow).getBrowserErrors?.())).toEqual([]);
});

test('a pre-city save inside a new building moves to the nearest sidewalk', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('tidebound-save-v1')) {
      localStorage.setItem('tidebound-save-v1', JSON.stringify({ location: { area: 'harbor', x: 23, y: 2 }, greeted: true }));
    }
  });
  await ready(page);
  await expect(page.locator('.area-name')).toContainText('潮汐环城');
  const relocated = await position(page);
  expect(relocated?.area).toBe('harbor');
  expect(relocated).not.toEqual({ area: 'harbor', x: 23, y: 2 });
  expect(Math.abs(relocated!.x - 23) + Math.abs(relocated!.y - 2)).toBeLessThanOrEqual(4);
  await expect(page.locator('.journey-count')).toHaveText('1/3');
  await page.reload();
  await expect.poll(() => position(page)).toEqual(relocated);
});

test('tapping the city guide hits the 3D actor and routes to a conversation', async ({ page }) => {
  await ready(page);
  const canvas = field(page).locator('canvas');
  const available = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
  test.skip(!available, 'This browser has no available WebGL context');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  const target = await canvas.evaluate(element => {
    const world = (window as FieldWindow).__field!;
    const position = world.projectPoint(14 * 16 + 8, 12 * 16 + 14);
    const { width, height, scale } = world.getCamera();
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x + bounds.width * position.x / width, y: bounds.y + bounds.height * (position.y - 13 * scale) / height };
  });
  await page.mouse.click(target.x, target.y);
  await expect(page.getByRole('group', { name: '与韩怡萱的对话' })).toBeVisible();
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 13, y: 12 });
});

test('a roof tap does not route through the city to invisible pavement', async ({ page }) => {
  await ready(page);
  const available = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
  test.skip(!available, 'This browser has no available WebGL context');
  await expect(field(page).locator('canvas')).toHaveAttribute('data-renderer', 'webgl');
  await clickTile(page, 11, 5);
  await expect(page.locator('.game-hint')).toContainText('这里无法通行');
  expect(await position(page)).toEqual({ area: 'harbor', x: 12, y: 12 });
});

test('the ring city opens in an overview and turns into a walkable circular street', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tidebound-save-v1', JSON.stringify({ location: { area: 'harbor', x: 39, y: 12 } }));
  });
  await ready(page);
  const viewport = page.locator('.game-viewport');
  await expect(viewport).toHaveAttribute('data-overview', 'true');
  await expect(page.getByRole('button', { name: '返回街道' })).toHaveAttribute('aria-pressed', 'true');
  await field(page).focus();
  await step(page, 'Right');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 0, y: 12 });
  await expect(viewport).not.toHaveAttribute('data-overview', 'true');
  await step(page, 'Right');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 1, y: 12 });
  await step(page, 'Left', 2);
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 39, y: 12 });
  await page.getByRole('button', { name: '俯瞰环城' }).click();
  await expect(viewport).toHaveAttribute('data-overview', 'true');
});

test('dragging the ring overview rotates the city without walking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const start = await position(page);
  const project = () => page.evaluate(() => (window as FieldWindow).__field!.projectPoint(12 * 16 + 8, 12 * 16 + 8));
  const before = await project();
  const bounds = (await field(page).locator('canvas').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .74, bounds.y + bounds.height * .45);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .28, bounds.y + bounds.height * .45, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const after = await project();
    return Math.hypot(after.x - before.x, after.y - before.y);
  }).toBeGreaterThan(bounds.height * .20);
  await expect(page.locator('.game-viewport')).toHaveAttribute('data-overview', 'true');
  expect(await position(page)).toEqual(start);
});

test('the city has a connected network of sidewalks and all three tall-grass areas', async ({ page }) => {
  await ready(page);
  const outside = await page.evaluate(() => {
    const field = (window as Window & { __field?: { getMap: () => {
      walkable: boolean[][]; wrapX: boolean; npcs: { x: number; y: number; solid: boolean }[];
    } } }).__field!;
    const map = field.getMap();
    const blocked = new Set(map.npcs.filter(person => person.solid).map(({ x, y }) => `${x},${y}`));
    const frontier = [[12, 12]];
    const seen = new Set(['12,12']);
    for (let index = 0; index < frontier.length; index++) {
      const [x, y] = frontier[index];
      for (const [nextX, row] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const width = map.walkable[0].length;
        const column = map.wrapX ? (nextX + width) % width : nextX;
        const key = `${column},${row}`;
        if (!map.walkable[row]?.[column] || seen.has(key) || blocked.has(key)) continue;
        seen.add(key);
        frontier.push([column, row]);
      }
    }
    const unreachable = map.walkable.flatMap((row, y) => row.flatMap((passable, x) => {
      const key = `${x},${y}`;
      return passable && !seen.has(key) && !blocked.has(key) ? [key] : [];
    }));
    return { unreachable, lighthouse: seen.has('3,7'), stationPark: seen.has('34,5') };
  });
  expect(outside).toEqual({ unreachable: [], lighthouse: true, stationPark: true });
});

test('the ring has fifty individually modeled street buildings', async ({ page }) => {
  await ready(page);
  const counts = await page.evaluate(async ([layoutPath, landmarksPath, terracesPath, fieldPath]) => {
    const { cityParcels, cityTerraces } = await import(layoutPath);
    const { buildRingArchitecture } = await import(landmarksPath);
    const { buildRingTerraces } = await import(terracesPath);
    const { maps } = await import(fieldPath);
    const parcelIds = new Set(cityParcels.map((parcel: { id: string }) => parcel.id));
    const landmarks = buildRingArchitecture().children.filter((child: { userData: { parcel: string } }) => parcelIds.has(child.userData.parcel));
    const homes = buildRingTerraces().group.children.flatMap((row: { userData: { buildingIds: string[] } }) => row.userData.buildingIds);
    const frontage = cityTerraces.flatMap((lot: { x: number; z: number; width: number; depth: number; homes: number; facing: string }) => {
      const row = lot.facing === 'inner' ? lot.z - 1 : lot.z + lot.depth;
      return Array.from({ length: lot.homes }, (_, index) => maps.harbor.walkable[row][Math.floor(lot.x + (index + .5) * lot.width / lot.homes)]);
    }).filter(Boolean).length;
    return { landmarks: landmarks.length, homes: homes.length, unique: new Set([...homes, ...parcelIds]).size, frontage };
  }, ['/src/field-city-layout.ts', '/src/field-ring-architecture.ts', '/src/field-ring-terraces.ts', '/src/field-layout.ts']);
  expect(counts).toEqual({ landmarks: 10, homes: 40, unique: 50, frontage: 40 });
});

test('guide, collision, and map shortcuts work with an older visited save', async ({ page }) => {
  await ready(page);
  await field(page).focus();
  expect(await position(page)).toEqual({ area: 'harbor', x: 12, y: 12 });
  await step(page, 'Right');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 13, y: 12 });
  await page.keyboard.press('e');
  const dialogue = page.getByRole('group', { name: '与韩怡萱的对话' });
  await expect(dialogue).toContainText('姆克儿和小猫怪');
  await page.getByRole('button', { name: '继续' }).click();
  await expect(dialogue).toContainText('投出精灵球');
  await page.getByRole('button', { name: '结束' }).click();
  await expect(field(page)).toBeFocused();
  await expect(page.locator('.journey-count')).toHaveText('1/3');
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: '群岛航线' })).toContainText('当前位置');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.journey-count')).toHaveText('1/3');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 13, y: 12 });
});

test('dialogue can reveal a line immediately before advancing', async ({ page }) => {
  await ready(page);
  await field(page).focus();
  await step(page, 'Right');
  await page.keyboard.press('e');
  const dialogue = page.getByRole('group', { name: '与韩怡萱的对话' });
  const reveal = dialogue.getByRole('button', { name: '显示全文' });
  await reveal.click();
  await expect(dialogue.locator('.dialogue-text-reveal')).toContainText('仙子伊布');
  await dialogue.getByRole('button', { name: '继续' }).click();
  await expect(dialogue).toContainText('投出精灵球');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dialogue.getByRole('button', { name: '结束' }).click();
  await expect(field(page)).toBeFocused();
});

test('real species, move PP, a catch, working Pokédex, and a selected lead persist', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await ready(page);
  await expect(page.locator('.lead-status')).toContainText('波加曼');
  const battle = await meetFirstWild(page);
  await expect(battle).toContainText('野生姆克儿');
  const pound = battle.getByRole('button', { name: '拍击' });
  await expect(pound).toContainText('PP 35/35');
  await pound.click();
  await expect(battle.getByRole('meter', { name: '姆克儿体力' })).toHaveAttribute('aria-valuenow', '10');
  await expect(pound).toContainText('PP 34/35');
  await battle.getByRole('button', { name: '投掷精灵球' }).click();
  await expect(battle.getByRole('status')).toContainText('姆克儿');
  await expect(battle.getByRole('button', { name: '返回原野' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.field-supplies')).toContainText('精灵球 3');
  await page.getByRole('button', { name: '图鉴', exact: true }).click();
  const dex = page.getByRole('dialog', { name: '群岛图鉴' });
  await expect(dex.locator('.dex-tally')).toContainText('已入队 2/8');
  await dex.getByRole('button', { name: /姆克儿/ }).click();
  await expect(dex.locator('.dex-species')).toContainText('姆克儿');
  await expect(dex.locator('.type-badges')).toContainText('飞行');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '打开背包' }).click();
  const pack = page.getByRole('dialog', { name: '伙伴与补给' });
  await expect(pack).toContainText('PP 34/35');
  await pack.getByRole('button', { name: /姆克儿/ }).click();
  await pack.getByRole('button', { name: '设为首发' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lead-status')).toContainText('姆克儿');
  await page.reload();
  await expect(page.locator('.lead-status')).toContainText('姆克儿');
});

test('the route connects all islands and unlocks return fast travel', async ({ page }) => {
  await ready(page);
  await field(page).focus();
  await step(page, 'Right');
  await step(page, 'Up');
  await step(page, 'Right', 6);
  await step(page, 'Down');
  await step(page, 'Right', 18);
  await step(page, 'Down', 4);
  await expect(page.locator('.game-viewport')).toHaveAttribute('data-area', 'grove');
  await step(page, 'Right', 38);
  await expect(page.locator('.game-viewport')).toHaveAttribute('data-area', 'summit');
  await page.getByRole('button', { name: '群岛航线' }).click();
  const route = page.getByRole('dialog', { name: '群岛航线' });
  await expect(route.getByRole('button', { name: '前往' })).toHaveCount(2);
  await route.getByRole('button', { name: '前往' }).first().click();
  await expect(page.locator('.game-viewport')).toHaveAttribute('data-area', 'harbor');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 12, y: 12 });
});

test('the dock perspective preserves click-to-move coordinates', async ({ page }) => {
  await ready(page);
  await field(page).focus();
  await step(page, 'Left', 7);
  await expect.poll(() => page.evaluate(() => (window as FieldWindow).__field!.getCamera().depth)).toBeGreaterThan(.82);
  await clickTile(page, 6, 12);
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 6, y: 12 });
});

test('WebGL renders at the viewport resolution and falls back after context loss', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    let webgl: WebGL2RenderingContext | null = null;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, kind: string, options?: unknown) {
        const context = Reflect.apply(getContext, this, [kind, options]);
        if (kind === 'webgl2' && context && options) webgl = context as WebGL2RenderingContext;
        return context;
      },
    });
    Object.assign(window, { loseFieldGraphics: () => webgl?.getExtension('WEBGL_lose_context')?.loseContext() });
  });
  await ready(page);
  const available = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
  test.skip(!available, 'This browser has no available WebGL context');
  const canvas = field(page).locator('canvas');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl');
  const dimensions = await canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    return { pixels: surface.width, layout: surface.getBoundingClientRect().width };
  });
  expect(dimensions.pixels).toBeGreaterThanOrEqual(Math.floor(dimensions.layout));
  await page.evaluate(() => (window as Window & { loseFieldGraphics: () => void }).loseFieldGraphics());
  await expect(canvas).toHaveAttribute('data-renderer', 'canvas2d');
  await clickTile(page, 11, 5);
  await expect(page.locator('.game-hint')).toContainText('这里无法通行');
  expect(await position(page)).toEqual({ area: 'harbor', x: 12, y: 12 });
  const overviewScale = await page.evaluate(() => (window as FieldWindow).__field!.getCamera().scale);
  await page.getByRole('button', { name: '返回街道' }).click();
  await expect.poll(() => page.evaluate(() => (window as FieldWindow).__field!.getCamera().scale)).toBeGreaterThan(overviewScale * 1.5);
  await clickTile(page, 11, 12);
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 11, y: 12 });
});

test('expanded play contains keyboard focus and returns to the map on Escape', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '放大画面' }).click();
  const expanded = page.getByRole('dialog', { name: '潮汐群岛游戏' });
  await expect(expanded).toHaveAttribute('aria-modal', 'true');
  await expect(field(page)).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await expanded.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(expanded).toHaveCount(0);
  await expect(field(page)).toBeFocused();
});

test('a reachable patch of rustling grass produces a real rare encounter', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .9; });
  await ready(page);
  await field(page).focus();
  await step(page, 'Left', 7);
  await step(page, 'Right', 5);
  const patch = await page.evaluate(() => (window as FieldWindow).__field!.getRustle());
  expect(patch).not.toBeNull();
  await expect(page.locator('.game-hint')).toContainText('草在晃动');
  await clickTile(page, patch!.x, patch!.y);
  const battle = page.getByRole('region', { name: '野外战斗' });
  await expect(battle.getByRole('meter', { name: '小猫怪体力' })).toBeVisible();
  await expect(battle.locator('.battle-status--enemy')).toContainText('LV.5');
});

test('the optional practice grants its first reward without completing the final trial', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .35;
    if (localStorage.getItem('tidebound-save-v1')) return;
    localStorage.setItem('tidebound-save-v1', JSON.stringify({ location: { area: 'grove', x: 14, y: 11 } }));
  });
  await ready(page);
  await field(page).focus();
  await page.keyboard.press('e');
  const invitation = page.getByRole('group', { name: '与林间陪练的对话' });
  await invitation.getByRole('button', { name: '稍后' }).click();
  await expect(field(page)).toBeFocused();
  await page.keyboard.press('e');
  await invitation.getByRole('button', { name: '开始切磋' }).click();
  const battle = page.getByRole('region', { name: '训练家切磋' });
  await expect(battle.getByRole('meter', { name: '利欧路体力' })).toBeVisible();
  await expect(battle.getByRole('button', { name: '投掷精灵球' })).toBeDisabled();
  await expect(battle.getByRole('button', { name: '撤退' })).toBeDisabled();
  await battle.getByRole('button', { name: '泡沫光线' }).click();
  await battle.getByRole('button', { name: '泡沫光线' }).click();
  await battle.getByRole('button', { name: '返回原野' }).click();
  await expect(invitation).toContainText('两颗精灵球');
  await expect(page.locator('.field-supplies')).toContainText('精灵球 6');
  await expect(page.locator('.journey-count')).toHaveText('0/3');
  await page.reload();
  await expect(page.locator('.field-supplies')).toContainText('精灵球 6');
});

test('the real-species summit trial resolves and preserves the victory on direct reload', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.35;
    if (localStorage.getItem('tidebound-save-v1')) return;
    localStorage.setItem('tidebound-save-v1', JSON.stringify({
      location: { area: 'summit', x: 30, y: 9 },
      visited: ['harbor', 'grove', 'summit'],
      greeted: true,
      battle: {
        team: [{ id: 'piplup', level: 5, hp: 21, xp: 0 }, { id: 'starly', level: 3, hp: 15, xp: 0 }],
        lead: 'piplup', medicine: 3, charms: 3, wins: 0, trialWon: false,
      },
    }));
  });
  await ready(page);
  await field(page).focus();
  await page.keyboard.press('e');
  const challenge = page.getByRole('group', { name: '与高地守望员的对话' });
  await expect(challenge).toContainText('特别怕冰');
  await challenge.getByRole('button', { name: '开始试炼' }).click();
  const battle = page.getByRole('region', { name: '高地试炼' });
  await expect(battle.getByRole('meter', { name: '圆陆鲨体力' })).toBeVisible();
  await expect(battle.getByRole('button', { name: '投掷精灵球' })).toBeDisabled();
  await expect(battle.getByRole('button', { name: '撤退' })).toBeDisabled();
  for (const move of ['叫声', '叫声', '使用伤药', '泡沫光线', '使用伤药', '泡沫光线', '泡沫光线']) {
    await battle.getByRole('button', { name: move, exact: true }).click();
  }
  await expect(battle.getByRole('status')).toContainText('试炼');
  await expect(battle.getByRole('button', { name: '返回原野' })).toBeVisible();
  await expect(page.locator('.journey-count')).toHaveText('3/3');
  await page.reload();
  await expect(page.locator('.journey-count')).toHaveText('3/3');
  await field(page).focus();
  await page.keyboard.press('e');
  await expect(page.getByRole('group', { name: '与高地守望员的对话' })).toContainText('风塔已经点亮');
});

test('the personal profile, research, and mail entry points still work', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('yu-world-profile') === null) localStorage.setItem('yu-world-profile', 'null');
    localStorage.setItem('tidebound-save-v1', '{"battle":{"team":[{"id":"toString"}]},"location":{"area":"invalid"}}');
  });
  await ready(page);
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('button', { name: '研究档案' }).click();
  await expect(page.getByRole('dialog')).toContainText('集成 EWRLS');
  await page.keyboard.press('Escape');
  await nav.getByRole('button', { name: '关于我' }).click();
  await expect(page.getByRole('dialog')).toContainText('王禹浩');
  await page.getByRole('button', { name: '编辑个人资料' }).click();
  await page.getByLabel('昵称').fill('群岛旅行者');
  await page.getByRole('button', { name: '保存资料' }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('群岛旅行者');
  await page.keyboard.press('Escape');
  await page.locator('.place-card[data-place=contact]').click();
  await page.getByLabel('留言').fill('你好群岛');
  await expect(page.getByRole('link', { name: '打开邮件草稿' })).toHaveAttribute('href', /mailto:2239429402@qq\.com.*&body=%E4%BD%A0/);
  await page.reload();
  await expect(page.locator('.footer')).toContainText('群岛旅行者');
  await expect(page.locator('.lead-status')).toContainText('波加曼');
});

test('an early adventure save keeps discovery, supplies, and a migrated real-species team', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('tidebound-save-v1')) return;
    localStorage.setItem('tidebound-save-v1', JSON.stringify({
      location: { area: 'grove', x: 3, y: 12 }, visited: ['harbor', 'grove'], greeted: true,
      battle: {
        team: [{ id: 'mosswick', level: 5, hp: 38, xp: 0 }, { id: 'brineling', level: 3, hp: 27, xp: 0 }],
        lead: 'brineling', medicine: 2, charms: 1, wins: 1, trialWon: false,
      },
    }));
  });
  await ready(page);
  await expect(page.locator('.lead-status')).toContainText('泳圈鼬');
  await expect(page.locator('.field-supplies')).toContainText('精灵球 1');
  await expect(page.locator('.journey-count')).toHaveText('2/3');
  expect(await position(page)).toEqual({ area: 'grove', x: 3, y: 12 });
  await page.reload();
  await expect(page.locator('.lead-status')).toContainText('泳圈鼬');
});

test('the original profile partner carries forward into a new game', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('yu-world-partner', JSON.stringify('gible')));
  await ready(page);
  await expect(page.locator('.lead-status')).toContainText('圆陆鲨');
  await page.getByRole('button', { name: '查看圆陆鲨的图鉴' }).click();
  await expect(page.getByRole('dialog', { name: '群岛图鉴' }).locator('.type-badges')).toContainText('龙');
});

test('a migrated Starly can catch a different species in the first ordinary encounter', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('yu-world-partner', JSON.stringify('starly')));
  await ready(page);
  const battle = await meetFirstWild(page);
  await expect(battle.getByRole('meter', { name: '小猫怪体力' })).toBeVisible();
  await expect(battle.getByRole('button', { name: '投掷精灵球' })).toBeEnabled();
});

test('ambience, movement, battle, and menus stay usable on a 320px touch screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { Math.random = () => 0; });
  await ready(page);
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await fits()).toBe(true);
  await page.getByRole('button', { name: '开启声音' }).tap();
  await expect(page.getByRole('button', { name: '关闭声音' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '切换到夜晚' }).tap();
  await expect(field(page)).toHaveAttribute('data-night', 'true');
  await tapSteps(page, '向右移动');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 13, y: 12 });
  await page.getByRole('button', { name: '与附近目标互动' }).tap();
  await expect(page.getByRole('group', { name: '与韩怡萱的对话' })).toBeVisible();
  await page.getByRole('button', { name: '继续' }).tap();
  await page.getByRole('button', { name: '结束' }).tap();
  await tapSteps(page, '向左移动');
  await tapSteps(page, '向下移动', 2);
  await tapSteps(page, '向右移动', 5);
  const battle = page.getByRole('region', { name: '野外战斗' });
  await expect(battle).toBeVisible();
  expect(await fits()).toBe(true);
  await battle.getByRole('button', { name: '撤退' }).tap();
  await battle.getByRole('button', { name: '返回原野' }).tap();
  await expect(field(page)).toBeFocused();
  await page.getByRole('button', { name: '图鉴', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: '群岛图鉴' })).toBeVisible();
  expect(await fits()).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

const rooms = [
  { id: 'home', area: 'harbor', near: [11, 10], doorway: [10, 11], title: '潮汐档案屋', horizontal: null, panel: '王禹浩', text: '金融风险管理' },
  { id: 'lab', area: 'grove', near: [9, 10], doorway: [10, 11], title: '雾杉观测室', horizontal: 'Right', panel: '研究档案', text: '集成 EWRLS' },
  { id: 'tower', area: 'summit', near: [11, 10], doorway: [12, 11], title: '风语天文台', horizontal: 'Left', panel: '联系我', text: '打开邮件草稿' },
] as const;

for (const room of rooms) {
  test(`${room.id} is a walkable indoor landmark, with reload-safe entry and a usable exit`, async ({ page }) => {
    await page.addInitScript(initial => {
      if (localStorage.getItem('tidebound-save-v1')) return;
      localStorage.setItem('tidebound-save-v1', JSON.stringify({ location: initial }));
    }, { area: room.area, x: room.near[0], y: room.near[1] });
    await ready(page);
    await field(page).focus();
    await page.keyboard.press('e');
    await expect(page.locator('.game-viewport')).toHaveAttribute('data-room', room.id);
    await expect(page.locator('.area-name')).toContainText(room.title);
    await expect.poll(() => position(page)).toEqual({ area: room.area, room: room.id, x: 12, y: 13 });
    if (room.horizontal) await step(page, room.horizontal, 2);
    await step(page, 'Up', 5);
    await page.keyboard.press('e');
    const content = page.getByRole('dialog', { name: room.panel, exact: true });
    await expect(content).toContainText(room.text);
    await page.keyboard.press('Escape');
    const before = await position(page);
    await page.reload();
    await expect.poll(() => position(page)).toEqual(before);
    if (room.id === 'home') {
      await field(page).focus();
      await step(page, 'Down', 6);
    } else {
      await page.getByRole('button', { name: '离开室内' }).click();
    }
    await expect(page.locator('.game-viewport')).not.toHaveAttribute('data-room', room.id);
    await expect.poll(() => position(page)).toEqual({ area: room.area, x: room.doorway[0], y: room.doorway[1] });
  });
}

test('expanded landscape touch play keeps direction, action and menu controls reachable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  await page.getByRole('button', { name: '放大画面' }).tap();
  const expanded = page.locator('.game-expanded');
  await expect(expanded).toBeVisible();
  const box = await expanded.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: '跑步', exact: true }).tap();
  await expect(page.getByRole('button', { name: '跑步', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tapSteps(page, '向右移动');
  await expect.poll(() => position(page)).toEqual({ area: 'harbor', x: 13, y: 12 });
  await page.getByRole('button', { name: '与附近目标互动' }).tap();
  await expect(page.getByRole('group', { name: '与韩怡萱的对话' })).toBeVisible();
  await page.getByRole('button', { name: '继续' }).tap();
  await page.getByRole('button', { name: '结束' }).tap();
  await page.getByRole('button', { name: '还原画面' }).tap();
  await expect(expanded).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
