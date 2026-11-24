import { expect, test, type Page } from '@playwright/test';
import type { BattleCheckpoint } from '../src/battle-checkpoint';
import type { TeamMember } from '../src/creatures';

async function practice(page: Page, team: TeamMember[], withAudio = false) {
  await page.addInitScript(party => {
    Math.random = () => .75;
    if (!localStorage.getItem('tidebound-save-v1')) localStorage.setItem('tidebound-save-v1', JSON.stringify({
      location: { area: 'harbor', x: 21, y: 13 }, visited: ['harbor'],
      battle: { team: party, lead: party[0].id, medicine: 3, charms: 4, wins: 0 },
    }));
  }, team);
  await page.goto('/');
  const field = page.getByRole('application');
  await field.locator('canvas').waitFor();
  if (withAudio) await page.getByRole('button', { name: '开启声音' }).click();
  await field.focus();
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '开始切磋' }).click();
  return page.getByRole('region', { name: '训练家切磋' });
}

function checkpoint(page: Page): Promise<BattleCheckpoint> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1')!).pendingBattle);
}

test('battle items can target the bench and cancelling a party choice keeps the turn and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const arena = await practice(page, [
    { id: 'piplup', level: 5, hp: 21, xp: 0 }, { id: 'starly', level: 5, hp: 1, xp: 0 }, { id: 'shinx', level: 5, hp: 20, xp: 0 },
  ]);
  const potion = arena.getByRole('button', { name: '使用伤药' });
  const change = arena.getByRole('button', { name: '更换出场伙伴' });
  await potion.click();
  const target = arena.getByRole('region', { name: '给谁使用伤药？' }).getByRole('button', { name: /姆克儿/ });
  await expect(target).toBeFocused();
  await expect(target).toHaveAccessibleName(/恢复至 19/);
  await page.keyboard.press('Escape');
  await expect(potion).toBeFocused();
  expect((await checkpoint(page)).state.turn).toBe(1);
  await change.click();
  await page.keyboard.press('Escape');
  await expect(change).toBeFocused();
  await potion.click();
  await target.click();
  const after = (await checkpoint(page)).state;
  expect(after).toMatchObject({ active: 'piplup', turn: 2, progress: { medicine: 2 } });
  expect(after.progress.team.find(member => member.id === 'starly')?.hp).toBe(19);
  expect(after.progress.team[0].hp).toBeLessThan(21);
  await expect(change).toBeEnabled();
  expect(await arena.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await change.click();
  const picker = arena.getByRole('region', { name: '更换出场伙伴', exact: true });
  await picker.getByRole('button', { name: /小猫怪/ }).click();
  const swapped = (await checkpoint(page)).state;
  expect(swapped.active).toBe('shinx');
  expect(swapped.turn).toBe(3);
  expect(swapped.participants).toEqual(['piplup', 'shinx']);
});

test('a fainted lead can be replaced after a reload without an additional enemy turn', async ({ page }) => {
  const arena = await practice(page, [
    { id: 'piplup', level: 5, hp: 1, xp: 0 }, { id: 'starly', level: 5, hp: 19, xp: 0 }, { id: 'shinx', level: 5, hp: 20, xp: 0 },
  ]);
  await arena.getByRole('button', { name: '拍击', exact: true }).click();
  const fallen = (await checkpoint(page)).state;
  expect(fallen.active).toBe('piplup');
  expect(fallen.progress.team[0].hp).toBe(0);
  expect(fallen.turn).toBe(2);
  await page.reload();
  const picker = arena.getByRole('region', { name: '选择接替的伙伴' });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button').first()).toBeFocused();
  await expect(arena.getByRole('button', { name: '拍击', exact: true })).toHaveCount(0);
  await page.keyboard.press('1');
  await page.keyboard.press('Escape');
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /小猫怪/ }).click();
  const after = (await checkpoint(page)).state;
  expect(after).toMatchObject({ turn: fallen.turn, enemy: fallen.enemy, active: 'shinx', progress: fallen.progress });
  await expect(arena.getByRole('button', { name: '电光', exact: true })).toBeEnabled();
  await expect(arena.locator('.battle-combatant--ally img.battle-sprite')).toHaveAttribute('data-species', 'shinx');
});

test('front and back view animations use each species recording and respect reduced motion', async ({ page }) => {
  const arena = await practice(page, [{ id: 'piplup', level: 5, hp: 21, xp: 0 }]);
  const ally = arena.locator('.battle-combatant--ally .battle-pose img');
  const enemy = arena.locator('.battle-combatant--enemy .battle-pose img');
  await expect(ally).toHaveAttribute('src', /piplup-back\.webp$/);
  await expect(enemy).toHaveAttribute('src', /riolu-front\.webp$/);
  expect(await ally.evaluate(async image => { const el = image as HTMLImageElement; await el.decode(); return el.naturalHeight; })).toBe(41);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(ally).toHaveAttribute('src', /piplup-back\.png$/);
  await expect(enemy).toHaveAttribute('src', /riolu-front\.png$/);
});

test('a delayed entrance cry stays silent after the next command and a switch cry stops on mute', async ({ page }) => {
  await page.addInitScript(() => {
    const events: { action: string; duration: number }[] = [];
    Object.assign(window, { battleAudioEvents: events });
    const { start, stop } = AudioBufferSourceNode.prototype;
    AudioBufferSourceNode.prototype.start = function(...args) {
      if (this.buffer) events.push({ action: 'start', duration: this.buffer.duration });
      start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function(...args) {
      if (this.buffer) events.push({ action: 'stop', duration: this.buffer.duration });
      stop.apply(this, args);
    };
  });
  let release!: () => void;
  const loading = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route('**/riolu-cry.wav', async route => { requested = true; await loading; await route.continue(); });
  const arena = await practice(page, [{ id: 'piplup', level: 10, hp: 30, xp: 0 }, { id: 'shinx', level: 10, hp: 30, xp: 0 }], true);
  await expect.poll(() => requested).toBe(true);
  await arena.getByRole('button', { name: '叫声', exact: true }).click();
  release();
  const played = (action: string, length: number) => page.evaluate(({ action, length }) => {
    const events = (window as Window & { battleAudioEvents?: { action: string; duration: number }[] }).battleAudioEvents ?? [];
    return events.some(event => event.action === action && Math.abs(event.duration - length) < .002);
  }, { action, length });
  await arena.getByRole('button', { name: '更换出场伙伴' }).click();
  await arena.getByRole('region', { name: '更换出场伙伴', exact: true }).getByRole('button', { name: /小猫怪/ }).click();
  await expect.poll(() => played('start', .703)).toBe(true);
  await page.getByRole('button', { name: '关闭声音' }).click();
  await expect.poll(() => played('stop', .703)).toBe(true);
  expect(await played('start', .377)).toBe(false);
});

test('the east quay trial explains its ice weakness, awards the signal and cannot be collected again', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Math.random = () => .5;
    if (!localStorage.getItem('tidebound-save-v1')) localStorage.setItem('tidebound-save-v1', JSON.stringify({
      location: { area: 'harbor', x: 36, y: 12 },
      battle: { team: [{ id: 'snover', level: 14, hp: 45, xp: 0 }, { id: 'piplup', level: 5, hp: 21, xp: 0 }],
        lead: 'snover', medicine: 3, charms: 4, wins: 0 },
    }));
  });
  await page.goto('/');
  const field = page.getByRole('application');
  await field.locator('canvas').waitFor();
  await field.focus();
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '开始试炼' }).click();
  const arena = page.getByRole('region', { name: '东渡口试炼', exact: true });
  await expect(arena.getByRole('button', { name: '投掷精灵球' })).toBeDisabled();
  const sheet = arena.getByRole('button', { name: '招式资料', exact: true });
  await sheet.click();
  await expect(arena.getByText('细雪', { exact: true }).last()).toBeVisible();
  await expect(arena.locator('dd').first()).toContainText('4');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeFocused();
  const attack = arena.getByRole('button', { name: '细雪', exact: true });
  await attack.click();
  const done = arena.getByRole('button', { name: '返回环城' });
  await done.click();
  const dialogue = page.getByRole('group', { name: '与东渡口守望员的对话' });
  await expect(dialogue).toContainText('信号灯亮起来了');
  const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1')!).battle);
  const saved = await progress();
  expect(saved).toMatchObject({ trialWon: true, wins: 1, charms: 4 });
  await page.reload();
  await field.locator('canvas').waitFor();
  await field.focus();
  await page.keyboard.press('e');
  await expect(dialogue).toContainText('信号灯已经点亮');
  await expect(page.getByRole('button', { name: '开始试炼' })).toHaveCount(0);
  expect(await progress()).toEqual(saved);
});
