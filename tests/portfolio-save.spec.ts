import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const store = 'tidebound-save-v1';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), store);
async function ready(page: Page) {
  await page.goto('./');
  await expect(page.locator('.game-canvas canvas').first()).toBeVisible();
}
async function storage(page: Page) {
  await page.locator('button.save-status').click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('冒险存档');
}
async function download(page: Page) {
  const started = page.waitForEvent('download');
  await button(page, '下载存档').click();
  const file = await started;
  return JSON.parse(await readFile((await file.path())!, 'utf8'));
}
async function pick(page: Page, value: unknown) {
  await page.getByLabel('选择冒险存档').setInputFiles({ name: 'expedition.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
}

test('portfolio navigation returns to its opener and retains the unsent message', async ({ page }) => {
  await ready(page);
  const contact = page.locator('.place-card[data-place=contact]');
  await contact.click();
  await page.getByLabel('留言').fill('研究交流 & #约时间?');
  await expect(page.getByRole('link', { name: '打开邮件草稿' })).toHaveAttribute('href', /%26%20%23/);
  await page.keyboard.press('Escape');
  await expect(contact).toBeFocused();
  await contact.click();
  await expect(page.getByLabel('留言')).toHaveValue('研究交流 & #约时间?');
  await button(page, '关闭').click();
  const about = page.getByRole('navigation').getByRole('button', { name: '关于我' });
  await about.click();
  await button(page, '编辑个人资料').click();
  await page.getByLabel('邮箱').fill('trainer@localhost');
  await button(page, '保存资料').click();
  await expect(page.getByRole('alert')).toContainText('完整域名');
  await expect(page.getByLabel('邮箱')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button(page, '编辑个人资料')).toBeFocused();
  await button(page, '关闭').click();
  await expect(about).toBeFocused();
});

test('a storage failure keeps the profile draft editable and succeeds on retry', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'yu-world-profile' && fail) { fail = false; throw new DOMException('full', 'QuotaExceededError'); }
      original.call(this, key, value);
    };
  });
  await ready(page);
  await page.getByRole('navigation').getByRole('button', { name: '关于我' }).click();
  await button(page, '编辑个人资料').click();
  await page.getByLabel('昵称').fill('旅行记录员');
  await button(page, '保存资料').click();
  await expect(page.getByRole('alert')).toContainText('未能保存资料');
  await expect(page.getByLabel('昵称')).toHaveValue('旅行记录员');
  await button(page, '保存资料').click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('旅行记录员');
  await page.reload();
  await expect(page.locator('.footer')).toContainText('旅行记录员');
});

test('backup previews support cancel, restore, undo, and reload', async ({ page }) => {
  await ready(page);
  await storage(page);
  const file = await download(page);
  expect(file.game).toBe('tidebound');
  expect(file.adventure.battle.team[0].id).toBe('piplup');
  expect(JSON.stringify(file)).not.toContain('@');
  file.adventure.battle.wins = 27;
  file.adventure.battle.charms = 38;
  await pick(page, file);
  await expect(page.getByRole('region', { name: '存档预览' })).toContainText('27 胜');
  await button(page, '取消').click();
  expect((await read(page)).battle.wins).toBe(0);
  await pick(page, file);
  await button(page, '确认载入').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await read(page)).battle.charms).toBe(38);
  await storage(page);
  await button(page, '找回载入前的进度').click();
  await expect(page.getByRole('region', { name: '存档预览' })).toContainText('0 胜');
  await button(page, '确认载入').click();
  await page.reload();
  expect((await read(page)).battle.charms).toBe(4);
});

test('an invalid file never replaces the current adventure', async ({ page }) => {
  await ready(page);
  await storage(page);
  const file = await download(page);
  const before = await read(page);
  for (const [input, message] of [
    [{ other: 'file' }, '请选择潮汐群岛'],
    [{ ...file, version: 99 }, '版本'],
    [{ ...file, adventure: { ...file.adventure, battle: {} } }, '有效的位置或队伍'],
  ] as const) {
    await pick(page, input);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(button(page, '确认载入')).toHaveCount(0);
  }
  await page.getByLabel('选择冒险存档').setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('文件内容无法读取');
  expect(await read(page)).toEqual(before);
});

test('a second tab cannot overwrite a newer position and can resume it', async ({ page, context }) => {
  await ready(page);
  const other = await context.newPage();
  await ready(other);
  await button(other, '前往西栈桥').click();
  await expect(button(other, '升起堡垒')).toBeVisible({ timeout: 18000 });
  const newer = await read(other);
  await page.locator('.game-canvas').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.save-status')).toContainText('另一页已有新进度');
  expect((await read(page)).location).toEqual(newer.location);
  await storage(page);
  const own = await download(page);
  expect(own.adventure.location).not.toEqual(newer.location);
  await button(page, '载入最新进度').click();
  await expect(button(page, '升起堡垒')).toBeVisible();
});

test('a damaged browser record stays intact until the player confirms an import', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{torn'), store);
  await ready(page);
  await storage(page);
  await expect(page.getByRole('dialog')).toContainText('原始文件');
  expect(await page.evaluate(key => localStorage.getItem(key), store)).toBe('{torn');
  const file = await download(page);
  await pick(page, file);
  await button(page, '确认载入').click();
  await expect(page.locator('.save-status')).toContainText('进度保存在当前浏览器');
  expect((await read(page)).battle.team[0].id).toBe('piplup');
});

test('players can export and restore while browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  });
  await ready(page);
  await storage(page);
  const file = await download(page);
  file.adventure.battle.wins = 12;
  await pick(page, file);
  await button(page, '确认载入').click();
  await expect(page.locator('.save-status')).toContainText('无法保存进度');
  await storage(page);
  expect((await download(page)).adventure.battle.wins).toBe(12);
});
