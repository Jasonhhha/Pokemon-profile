import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import type { BattleCommand, BattleState } from '../src/battle-turn';
import type { BattleProgress, TeamMember } from '../src/creatures';

let vite: ViteDevServer;
let rules: typeof import('../src/creatures');
let battle: typeof import('../src/battle-turn');
const lowRoll = () => 0;
const highRoll = () => .99;

function advance(state: BattleState, command: BattleCommand, trial = false, random = lowRoll) {
  return battle.resolveBattleTurn(state, command, trial, random).at(-1)!.state;
}

function start(creature: BattleState['enemy']['id'], level: number, progress = rules.initialBattleProgress(), trial = false) {
  return battle.beginBattle({ creature, level, trial }, progress).state;
}

test.beforeAll(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  rules = await vite.ssrLoadModule('/src/creatures.ts') as typeof rules;
  battle = await vite.ssrLoadModule('/src/battle-turn.ts') as typeof battle;
});

test.afterAll(async () => { await vite?.close(); });

test('capture respects HP, status, stock and ownership, and awards no experience', () => {
  const wild = start('riolu', 4);
  const wounded = { ...wild.enemy, hp: 1 };
  expect(rules.catchChance(wounded)).toBeGreaterThan(rules.catchChance(wild.enemy));
  expect(rules.catchChance({ ...wounded, ailment: 'paralysis' })).toBeGreaterThan(rules.catchChance(wounded));
  expect(rules.catchChance({ ...wounded, ailment: 'freeze' })).toBeGreaterThan(rules.catchChance({ ...wounded, ailment: 'paralysis' }));
  const ball = { kind: 'ball' } as const;
  expect(battle.resolveBattleTurn(wild, ball, true, lowRoll)).toEqual([]);
  expect(battle.resolveBattleTurn({ ...wild, progress: { ...wild.progress, charms: 0 } }, ball, false, lowRoll)).toEqual([]);
  expect(battle.resolveBattleTurn({ ...wild, enemy: { ...wild.enemy, hp: 0 } }, ball, false, lowRoll)).toEqual([]);
  expect(battle.resolveBattleTurn(start('piplup', 4), ball, false, lowRoll)).toEqual([]);

  const miss = battle.resolveBattleTurn(wild, ball, false, highRoll);
  expect(miss[0]).toMatchObject({ capture: 'shake', cue: 'capture' });
  const breakout = miss.find(frame => frame.capture === 'break');
  expect(breakout?.duration).toBeGreaterThanOrEqual(1100);
  expect(breakout?.duration).toBeLessThanOrEqual(1300);
  expect(miss.at(-1)!.state.progress.charms).toBe(wild.progress.charms - 1);
  expect(miss.at(-1)!.state.progress.team).toHaveLength(1);

  const caught = advance({ ...wild, enemy: { ...wounded, ailment: 'paralysis', pp: { feint: 3 } } }, ball);
  expect(caught.outcome).toBe('caught');
  expect(caught.progress.charms).toBe(wild.progress.charms - 1);
  expect(caught.progress.team[0]).toEqual(wild.progress.team[0]);
  expect(caught.progress.team[1]).toMatchObject({ id: 'riolu', hp: 1, ailment: 'paralysis', pp: { feint: 3 }, xp: 0 });
});

test('trainer practice prevents capture and escape, and pays ordinary victory experience', () => {
  const opened = battle.beginBattle({ creature: 'riolu', level: 4, area: 'grove', trainer: '林间见习员' }, rules.initialBattleProgress());
  expect(opened.message).toContain('林间见习员派出了利欧路');
  const state = opened.state;
  expect(battle.resolveBattleTurn(state, { kind: 'ball' }, false, lowRoll)).toEqual([]);
  expect(battle.resolveBattleTurn(state, { kind: 'run' }, false, lowRoll)).toEqual([]);
  const win = advance({ ...state, enemy: { ...state.enemy, hp: 1 } }, { kind: 'move', move: 'pound' });
  expect(win.outcome).toBe('win');
  expect(win.progress).toMatchObject({ wins: 1, trialWon: false, charms: state.progress.charms });
  expect(win.progress.team[0]).toMatchObject({ level: 6, xp: 0 });
});

test('dual type matchups, damage staging, and a blocked action preserve correct PP', () => {
  expect(rules.effectiveness('powder-snow', 'gible')).toBe(4);
  expect(rules.effectiveness('bubble-beam', 'gible')).toBe(1);
  expect(rules.effectiveness('spark', 'gible')).toBe(0);
  expect(rules.effectiveness('bulldoze', 'starly')).toBe(0);
  expect(rules.effectiveness('pound', 'drifloon')).toBe(0);
  const piplup = rules.makeMember('piplup', 5);
  const stages = rules.freshStages();
  const damage = rules.attackDamage(piplup, rules.makeMember('gible', 6), 'bubble-beam', stages, stages, lowRoll);
  expect(damage).toEqual({ damage: 7, modifier: 1, critical: false });

  const shinx = rules.makeMember('shinx', 7);
  const immune = start('gible', 5, { ...rules.initialBattleProgress(), lead: shinx.id, team: [shinx] });
  const frames = battle.resolveBattleTurn(immune, { kind: 'move', move: 'spark' }, false, lowRoll);
  expect(frames.find(frame => frame.message.includes('没有效果'))?.move)
    .toMatchObject({ id: 'spark', source: 'ally', target: 'enemy', result: 'immune' });
  expect(frames.at(-1)!.state.enemy).toMatchObject({ hp: immune.enemy.hp });
  expect(rules.movePP(battle.activeMember(frames.at(-1)!.state), 'spark')).toBe(19);

  const blocked = start('starly', 3, { ...rules.initialBattleProgress(), team: [{ ...piplup, ailment: 'paralysis' }] });
  const stalled = battle.resolveBattleTurn(blocked, { kind: 'move', move: 'pound' }, false, lowRoll);
  expect(stalled.find(frame => frame.move?.result === 'stalled')?.move)
    .toMatchObject({ id: 'pound', source: 'ally', target: 'ally' });
  const after = stalled.at(-1)!.state;
  expect(rules.movePP(battle.activeMember(after), 'pound')).toBe(35);
  expect(after.enemy.hp).toBe(blocked.enemy.hp);
  expect(rules.statValue({ ...piplup, ailment: 'paralysis' }, 'speed', 0)).toBe(Math.floor(rules.statValue(piplup, 'speed', 0) / 4));

  const frozen = start('starly', 3, { ...rules.initialBattleProgress(), team: [{ ...piplup, ailment: 'freeze' }] });
  const frozenTurn = advance(frozen, { kind: 'move', move: 'pound' }, false, highRoll);
  expect(battle.activeMember(frozenTurn)).toMatchObject({ ailment: 'freeze' });
  expect(rules.movePP(battle.activeMember(frozenTurn), 'pound')).toBe(35);
  const thawedTurn = advance(frozen, { kind: 'move', move: 'pound' });
  expect(battle.activeMember(thawedTurn).ailment).toBeUndefined();
  expect(rules.movePP(battle.activeMember(thawedTurn), 'pound')).toBe(34);
});

test('exhaustion forces typeless Struggle, and priority and switching preserve the selected turn order', () => {
  const exhausted: TeamMember = { ...rules.makeMember('piplup', 6), pp: { pound: 0, 'bubble-beam': 0, peck: 0, growl: 0 } };
  const ally = { ...rules.initialBattleProgress(), team: [exhausted] };
  const field = start('drifloon', 3, ally);
  expect(rules.readyMoves(exhausted)).toEqual(['struggle']);
  expect(battle.resolveBattleTurn(field, { kind: 'move', move: 'pound' }, false, lowRoll)).toEqual([]);
  const struggle = battle.resolveBattleTurn(field, { kind: 'move', move: 'struggle' }, false, lowRoll);
  const recoil = struggle.find(frame => frame.message.includes('反作用力'))!;
  expect(recoil.move).toMatchObject({ id: 'struggle', source: 'ally', target: 'ally', result: 'recoil' });
  expect(recoil.state.enemy.hp).toBeLessThan(field.enemy.hp);
  expect(battle.activeMember(recoil.state).hp).toBe(exhausted.hp - 6);
  expect(battle.activeMember(recoil.state).pp).toEqual(exhausted.pp);

  const starly = rules.makeMember('starly', 2);
  const progress: BattleProgress = { ...rules.initialBattleProgress(), team: [exhausted, starly] };
  const trial = start('gible', 6, progress, true);
  const fast = battle.resolveBattleTurn({ ...trial, active: starly.id }, { kind: 'move', move: 'quick-attack' }, true, lowRoll);
  expect(fast[0].message).toContain('姆克儿使出电光一闪');

  const stages = { ...trial.stages, ally: { ...trial.stages.ally, attack: -2 } };
  const swap = battle.resolveBattleTurn({ ...trial, turn: 2, stages }, { kind: 'switch', id: starly.id }, true, lowRoll);
  expect(swap[0].state.active).toBe(starly.id);
  expect(swap[0].state.stages.ally.attack).toBe(0);
  expect(swap[1].message).toContain('重踏');
  expect(swap[1].message).toContain('没有效果');
  expect(battle.activeMember(swap.at(-1)!.state).hp).toBe(starly.hp);
  expect(battle.battleResult({ ...swap.at(-1)!.state, outcome: 'win' })?.progress.lead).toBe(exhausted.id);
});

test('victory rewards healthy participants only, and capped level and healing survive a mixed save', () => {
  const initial = rules.initialBattleProgress();
  const reserve = rules.makeMember('shinx', 5);
  const fainted = { ...rules.makeMember('starly', 3), hp: 0, xp: 3, pp: { tackle: 0 } };
  const progress: BattleProgress = { ...initial, team: [initial.team[0], fainted, reserve] };
  const wild = start('riolu', 3, progress);
  const win = advance({ ...wild, enemy: { ...wild.enemy, hp: 1 }, participants: ['piplup', 'starly'] }, { kind: 'move', move: 'pound' });
  expect(win.outcome).toBe('win');
  expect(win.progress.team[0].xp).toBeGreaterThan(0);
  expect(win.progress.team[1]).toEqual(fainted);
  expect(win.progress.team[2]).toEqual(reserve);

  const injured = { ...initial.team[0], hp: 1, ailment: 'paralysis' as const, pp: { pound: 2 } };
  const injuredParty = { ...progress, team: [injured, fainted, reserve] };
  expect(rules.givePotion(injuredParty, 'starly')).toBe(injuredParty);
  expect(rules.givePotion(injuredParty, 'shinx')).toBe(injuredParty);
  const potion = rules.givePotion(injuredParty, 'piplup');
  expect(potion.medicine).toBe(progress.medicine - 1);
  expect(potion.team[0]).toMatchObject({ hp: 21, ailment: 'paralysis', pp: { pound: 2 } });
  const healed = rules.healTeam(potion);
  expect(healed.team[0].ailment).toBeUndefined();
  expect(rules.movePP(healed.team[0], 'pound')).toBe(35);
  expect(healed.team[1].hp).toBe(rules.maxHp(fainted));

  const nearCap = rules.makeMember('piplup', rules.maxLevel - 1);
  const capped = rules.gainXp(nearCap, rules.xpToNext(nearCap.level) + 5000);
  expect(capped).toMatchObject({ level: 100, xp: 0, hp: rules.maxHp(capped) });
  const migrated = rules.migrateBattleProgress({
    team: [null, { id: 'mosswick', level: 5 }, { ...capped, pp: { pound: 200 } }, { ...fainted, ailment: 'freeze' }, { id: 'toString', level: 99 }],
    lead: 'mosswick', medicine: 0, charms: 1, wins: 2, trialWon: true,
  });
  expect(migrated).toMatchObject({ lead: 'piplup', medicine: 0, charms: 1, wins: 2, trialWon: true });
  expect(migrated!.team).toHaveLength(2);
  expect(migrated!.team[0]).toMatchObject({ id: 'piplup', level: 100, xp: 0, pp: { pound: 35 } });
  expect(migrated!.team[1].ailment).toBeUndefined();
});

test('battle history keeps twelve announcements, restores focus, and leaves a queued turn intact', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .99;
    if (localStorage.getItem('tidebound-save-v1')) return;
    localStorage.setItem('tidebound-save-v1', JSON.stringify({
      location: { area: 'harbor', x: 15, y: 14 }, visited: ['harbor'], seen: ['piplup'],
      battle: { team: [{ id: 'piplup', level: 5, hp: 21, xp: 0 }], lead: 'piplup', medicine: 3, charms: 4, wins: 0, trialWon: false },
    }));
  });
  await page.goto('/');
  const field = page.getByRole('application');
  await field.locator('canvas').waitFor();
  await field.focus();
  for (const x of [16, 17, 18]) {
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(x => (window as any).__field?.getLocation().x === x, x);
  }

  const arena = page.getByRole('region', { name: '野外战斗' });
  const trigger = arena.getByRole('button', { name: '对战记录', exact: true });
  const log = arena.getByRole('complementary', { name: '对战记录' });
  const ball = arena.getByRole('button', { name: '投掷精灵球' });
  await ball.click();
  await expect(arena.getByRole('status')).toContainText('挣脱了');
  await trigger.click();
  await expect(log).toContainText('削弱体力或赋予异常状态可以提高捕捉率');
  await expect(log.getByRole('button', { name: '关闭对战记录' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(log.getByRole('list')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(log).toBeHidden();
  await expect(ball).toBeEnabled();

  await page.evaluate(() => { Math.random = () => .35; });
  const growl = arena.getByRole('button', { name: '叫声', exact: true });
  for (let turn = 0; turn < 6; turn++) await growl.click();
  await expect(growl).toBeEnabled();
  await trigger.click();
  const entries = log.getByRole('listitem');
  await expect(entries).toHaveCount(12);
  await expect(log).toContainText('叫声 · PP 34/40');
  expect(new Set(await entries.allTextContents()).size).toBe(12);

  await page.evaluate(() => { Math.random = () => 0; });
  await ball.click();
  const list = log.getByRole('list');
  await list.focus();
  await expect(log).toContainText('姆克儿加入了队伍');
  await expect(list).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await arena.getByRole('button', { name: '返回原野' }).click();
  await expect(arena).toBeHidden();
  const inventory = await page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1')!).battle);
  expect(inventory.charms).toBe(2);
  expect(inventory.team.map((member: TeamMember) => member.id)).toEqual(['piplup', 'starly']);
});
