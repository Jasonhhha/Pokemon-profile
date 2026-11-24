import { expect, test } from '@playwright/test';
import { createFortressGrid, railFeed } from '../src/fortress-power';

test('load changes and surges propagate from Kyurem to the bus and the surface in sequence', () => {
  const grid = createFortressGrid();
  expect(grid.read(0, true)).toMatchObject({ source: .82, bus: .78, city: .73, limited: false });
  grid.toggle(100);
  expect(grid.read(350, true).source).toBeLessThan(.82);
  expect(grid.read(350, true)).toMatchObject({ bus: .78, city: .73 });
  expect(grid.read(800, true).bus).toBeLessThan(.78);
  expect(grid.read(800, true).city).toBe(.73);
  const limited = grid.read(2000, true);
  expect(limited.source).toBeCloseTo(.23);
  expect(limited.bus).toBeCloseTo(.17);
  expect(limited.city).toBeCloseTo(.13);
  grid.toggle(2100);
  grid.roar(10000);
  expect(grid.read(10600, true).source).toBeGreaterThan(.82);
  expect(grid.read(10600, true).bus).toBe(.78);
  expect(grid.read(11000, true).bus).toBeGreaterThan(.78);
  expect(grid.read(11000, true).city).toBe(.73);
  expect(grid.read(11500, true).city).toBeGreaterThan(.73);
  expect(grid.read(11500, true).phase).toBe(grid.read(11600, true).phase);
  expect(grid.read(11500).phase).not.toBe(grid.read(11600).phase);
});

test('a short load interruption and an older roar reach the far end even after the next command', () => {
  const grid = createFortressGrid();
  grid.toggle(0);
  grid.toggle(400);
  expect(grid.read(400, true).city).toBe(.73);
  expect(grid.read(1300, true).source).toBe(.82);
  expect(grid.read(1300, true).city).toBeLessThan(.43);
  expect(grid.read(2200, true).city).toBe(.73);
  grid.roar(3000);
  grid.roar(3850);
  const afterSecond = grid.read(4550, true);
  expect(afterSecond.source).toBeGreaterThan(.82);
  expect(afterSecond.city).toBeGreaterThan(.73);
});

test('the viaduct signal travels around its physical receivers and holds a steady level in reduced motion', () => {
  const sourceArrival = .85 / 2.6;
  expect(railFeed(sourceArrival, 0, .73, false)).toBeGreaterThan(railFeed(sourceArrival, .5, .73, false));
  expect(railFeed(sourceArrival + .5, .5, .73, false)).toBeGreaterThan(railFeed(sourceArrival + .5, 0, .73, false));
  expect(railFeed(sourceArrival, 0, .13, true)).toBe(railFeed(.7, .4, .13, true));
  expect(railFeed(sourceArrival, 0, .13, true)).toBeLessThan(railFeed(sourceArrival, 0, .73, true));
});

for (const fallback of [false, true]) {
  test(`the reactor console can shed surface load, persist it and restore supply in ${fallback ? 'Canvas' : 'WebGL'}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(forceCanvas => {
      if (!localStorage.getItem('tidebound-save-v1')) localStorage.setItem('tidebound-save-v1', JSON.stringify({
        location: { area: 'harbor', fortressRoom: 'seal', x: 8, y: 11 }, fortressOpened: true,
      }));
      if (forceCanvas) {
        HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
          apply(original, canvas, args) { return args[0] === 'webgl2' ? null : Reflect.apply(original, canvas, args); },
        });
      }
    }, fallback);
    await page.goto('/');
    const canvas = page.locator('.game-canvas canvas');
    await page.getByRole('button', { name: '靠近封印' }).click();
    await expect(canvas).toHaveAttribute('data-renderer', fallback ? 'canvas2d' : 'webgl');
    const console = page.getByRole('region', { name: '酋雷姆采能回路' });
    const surface = console.getByRole('meter', { name: '环城照明' });
    await console.getByRole('button', { name: '降低环城负载' }).click();
    await expect.poll(() => surface.evaluate(m => (m as HTMLMeterElement).value)).toBeLessThan(19);
    await expect(page.getByRole('application')).toHaveAttribute('data-grid-load', 'limited');
    await page.reload();
    await page.getByRole('button', { name: '靠近封印' }).click();
    await expect(console.getByRole('button', { name: '恢复环城供能' })).toHaveAttribute('aria-pressed', 'true');
    await console.getByRole('button', { name: '恢复环城供能' }).click();
    await expect.poll(() => surface.evaluate(m => (m as HTMLMeterElement).value)).toBeGreaterThan(70);
    await page.getByRole('button', { name: '返回观测桥' }).click();
    await expect(console).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tidebound-save-v1')!));
    expect(saved.gridLimited).toBeFalsy();
    expect(saved.kyuremObserved).toBe(true);
  });
}

test('the generator hum follows the source and bus while muting cancels all three delayed relays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('tidebound-save-v1', JSON.stringify({ fortressOpened: true,
      location: { area: 'harbor', fortressRoom: 'seal', x: 8, y: 11 } }));
    type Trace = { kind: 'oscillator' | 'target' | 'disconnect'; value: number; at: number };
    const trace: Trace[] = [];
    Object.assign(window, { powerAudioTrace: trace });
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      trace.push({ kind: 'oscillator', value: this.frequency.value, at: when ?? this.context.currentTime });
      return start.call(this, when);
    };
    const retune = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function (value, time, constant) {
      trace.push({ kind: 'target', value, at: time });
      return retune.call(this, value, time, constant);
    };
    AudioNode.prototype.disconnect = new Proxy(AudioNode.prototype.disconnect, {
      apply(original, node, args) {
        if (node instanceof StereoPannerNode) trace.push({ kind: 'disconnect', value: node.pan.value, at: node.context.currentTime });
        return Reflect.apply(original, node, args);
      },
    });
  });
  type Trace = { kind: string; value: number; at: number };
  const events = () => page.evaluate(() => (window as Window & { powerAudioTrace: Trace[] }).powerAudioTrace);
  await page.goto('/');
  await page.getByRole('button', { name: '靠近封印' }).click();
  await page.getByRole('button', { name: '开启声音' }).click();
  await expect.poll(async () => (await events()).some(e => e.kind === 'target' && e.value > 62 && e.value < 67)).toBe(true);
  await page.getByRole('button', { name: '降低环城负载' }).click();
  const notes = (await events()).filter(e => e.kind === 'oscillator').reverse();
  const sequence = [51, 44, 37].map(midi => notes.find(e => Math.abs(e.value - 440 * 2 ** ((midi - 69) / 12)) < .001));
  expect(sequence.every(Boolean)).toBe(true);
  expect(sequence[1]!.at - sequence[0]!.at).toBeCloseTo(.34, 2);
  expect(sequence[2]!.at - sequence[0]!.at).toBeCloseTo(.85, 2);
  await expect.poll(async () => (await events()).some(e => e.kind === 'target' && e.value > 49 && e.value < 51)).toBe(true);
  await expect.poll(async () => (await events()).some(e => e.kind === 'target' && e.value > 115 && e.value < 118)).toBe(true);
  await page.getByRole('button', { name: '恢复环城供能' }).click();
  await page.getByRole('button', { name: '关闭声音' }).click();
  const stopped = (await events()).filter(e => e.kind === 'disconnect').reverse();
  const restored = (await events()).filter(e => e.kind === 'oscillator' && Math.abs(e.value - 440 * 2 ** ((39 - 69) / 12)) < .001).at(-1)!;
  for (const pan of [-.48, -.02, .44]) {
    const relay = stopped.find(e => Math.abs(e.value - pan) < .001);
    expect(relay?.at).toBeGreaterThanOrEqual(restored.at - .01);
    expect(relay!.at - restored.at).toBeLessThan(.85);
  }
});
