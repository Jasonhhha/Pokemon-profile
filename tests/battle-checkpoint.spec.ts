import { expect, test, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import type { BattleCheckpoint } from '../src/battle-checkpoint';
import type { BattleProgress, TeamMember } from '../src/creatures';

let vite: ViteDevServer;
let snapshots: typeof import('../src/battle-checkpoint');
let turns: typeof import('../src/battle-turn');
let rules: typeof import('../src/creatures');

test.beforeAll(async () => {
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  [snapshots, turns, rules] = await Promise.all([
    vite.ssrLoadModule('/src/battle-checkpoint.ts'), vite.ssrLoadModule('/src/battle-turn.ts'), vite.ssrLoadModule('/src/creatures.ts'),
  ]) as [typeof snapshots, typeof turns, typeof rules];
});
test.afterAll(async () => { await vite?.close(); });

function saveOnDisk(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1')!) as {
    pendingBattle?: BattleCheckpoint; battle: BattleProgress; sparWon: boolean; location: { area: string; x: number; y: number };
  });
}

test('checkpoints retain costs, stages and opponents, reject incoherent states, and migrate legacy party members', () => {
  const location = { area: 'harbor', x: 18, y: 14 } as const;
  const start = snapshots.beginCheckpoint({ creature: 'starly', area: 'harbor', level: 3 }, rules.initialBattleProgress());
  const frames = turns.resolveBattleTurn(start.state, { kind: 'ball' }, false, () => .99);
  const after = snapshots.checkpointTurn(start, frames);
  const reload = snapshots.restoreBattleCheckpoint(JSON.parse(JSON.stringify(after)), location)!;
  expect(reload.state).toEqual(after.state);
  expect(reload.history).toEqual(after.history);
  expect(reload.state).toMatchObject({ progress: { charms: 3 }, enemy: { pp: { growl: 39 } }, stages: { ally: { attack: -1 } } });
  expect(snapshots.resumeFrame(reload)).toMatchObject({ message: frames.at(-1)?.message, duration: 0 });
  expect(snapshots.restoreBattleCheckpoint(after, { ...location, room: 'home' })).toBeUndefined();
  expect(snapshots.restoreBattleCheckpoint({ ...after, encounter: { ...after.encounter, area: 'unknown' } }, location)).toBeUndefined();
  const party = { ...after.state.progress, team: [{ id: 'mosswick', level: 5, hp: 38 }] };
  const altered = (changes: Record<string, unknown>) => ({ ...after, state: { ...after.state, ...changes } });
  expect(snapshots.restoreBattleCheckpoint(altered({ progress: party }), location)?.state.progress.team[0].id).toBe('piplup');
  for (const invalid of [{ version: 9 }, altered({ progress: {} }), altered({ turn: 0 }), altered({ active: 'gible' }),
    altered({ outcome: 'lost' }), altered({ outcome: 'win' }), altered({ outcome: 'caught' }), altered({ enemy: { ...after.state.enemy, id: 'snover' } })]) {
    expect(snapshots.restoreBattleCheckpoint(invalid, location)).toBeUndefined();
  }
});

test('reloading during a throw resumes the decided turn and settles a later catch exactly once', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .99;
    if (localStorage.getItem('tidebound-save-v1')) return;
    localStorage.setItem('tidebound-save-v1', JSON.stringify({ location: { area: 'harbor', x: 15, y: 14 } }));
  });
  await page.goto('/');
  const field = page.getByRole('application');
  await field.locator('canvas').waitFor();
  await field.focus();
  for (const x of [16, 17, 18]) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await saveOnDisk(page)).location.x).toBe(x);
  }
  const arena = page.getByRole('region', { name: '野外战斗' });
  const ball = arena.getByRole('button', { name: '投掷精灵球' });
  await ball.click();
  expect((await saveOnDisk(page)).pendingBattle?.state).toMatchObject({ turn: 2, progress: { charms: 3 } });
  await page.reload();
  await expect(ball).toBeEnabled();
  await expect(ball).toContainText('×3');
  await expect(arena.locator('.battle-topline')).toContainText('回合 02');
  const history = arena.getByRole('button', { name: '对战记录', exact: true });
  await history.click();
  await expect(arena.getByRole('list')).toContainText('挣脱了');
  await history.click();
  await page.evaluate(() => { Math.random = () => 0; });
  await ball.click();
  expect((await saveOnDisk(page)).pendingBattle?.state.outcome).toBe('caught');
  await page.reload();
  await expect(arena.getByRole('button', { name: '返回环城' })).toBeVisible();
  const saved = await saveOnDisk(page);
  expect(saved.pendingBattle).toBeUndefined();
  expect(saved.battle.charms).toBe(2);
  expect(saved.battle.team.map(member => member.id)).toEqual(['piplup', 'starly']);
  await page.reload();
  await field.locator('canvas').waitFor();
  await expect(arena).toHaveCount(0);
  expect((await saveOnDisk(page)).battle).toEqual(saved.battle);
});

test('a restored practice applies the first-win gift once and a restored defeat returns the party to the harbor', async ({ page }) => {
  const location = { area: 'harbor', x: 21, y: 13 } as const;
  const encounter = { creature: 'riolu', level: 4, trainer: '绿廊陪练', area: location.area } as const;
  const progress = rules.initialBattleProgress();
  const start = snapshots.beginCheckpoint(encounter, progress);
  const wounded = { ...start.state, enemy: { ...start.state.enemy, hp: 1 } };
  const won = snapshots.checkpointTurn(start, turns.resolveBattleTurn(wounded, { kind: 'move', move: 'pound' }, false, () => 0));
  expect(won.state.outcome).toBe('win');
  const hurt: TeamMember = { ...progress.team[0], hp: 1 };
  const losing = snapshots.beginCheckpoint({ ...encounter, level: 30 }, { ...progress, team: [hurt] });
  const lost = snapshots.checkpointTurn(losing, turns.resolveBattleTurn(losing.state, { kind: 'move', move: 'growl' }, false, () => .7));
  expect(lost.state.outcome).toBe('lost');
  await page.addInitScript(() => {
    const staged = sessionStorage.getItem('practice-fixture');
    if (staged) {
      localStorage.setItem('tidebound-save-v1', staged);
      sessionStorage.removeItem('practice-fixture');
    }
  });
  await page.goto('/');
  async function resume(checkpoint: BattleCheckpoint, sparWon: boolean) {
    await page.evaluate(data => sessionStorage.setItem('practice-fixture', JSON.stringify(data)), {
      location, battle: progress, sparWon, pendingBattle: checkpoint,
    });
    await page.reload();
    return page.getByRole('region', { name: '训练家切磋' }).getByRole('button', { name: '返回环城' });
  }
  for (const first of [true, false]) {
    const done = await resume(won, !first);
    await expect(done).toBeVisible();
    const saved = await saveOnDisk(page);
    expect(saved).toMatchObject({ sparWon: true, location, battle: { wins: 1, charms: first ? 6 : 4, trialWon: false } });
    expect(saved.pendingBattle).toBeUndefined();
    await done.click();
    await expect(page.getByRole('group', { name: '与绿廊陪练的对话' })).toContainText(first ? '两颗精灵球' : '切磋');
  }
  const done = await resume(lost, false);
  await expect(done).toBeVisible();
  const saved = await saveOnDisk(page);
  expect(saved).toMatchObject({ location: { area: 'harbor', x: 18, y: 11 }, battle: progress, sparWon: false });
  await done.click();
  await expect(page.getByRole('group', { name: '与补给员的对话' })).toContainText('体力和补给都已恢复');
  await page.reload();
  await expect(page.getByRole('application')).toBeVisible();
  expect((await saveOnDisk(page)).location.area).toBe('harbor');
});
