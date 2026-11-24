import { useLayoutEffect, useRef } from 'react';
import type { BattleFrame, BattleSide } from './battle-turn';
import { moves, type Ailment, type CreatureId, type MoveId } from './creatures';

type Point = { x: number; y: number };
type Stance = 'waddle' | 'perch' | 'spry' | 'braced' | 'hover';
type Anchor = { center: Point; feet: Point; size: number; pose: HTMLElement; shadow: HTMLElement | null; stance: Stance; ailment?: Ailment };
type ArenaCast = Record<BattleSide, Anchor>;
type Style = 'impact' | 'dash' | 'slash' | 'wind' | 'bubbles' | 'stream' | 'lightning' | 'earth' | 'spirit' | 'ice' | 'leaves' | 'echo' | 'focus';
type Palette = { core: string; glow: string; edge: string };

export const stances: Record<CreatureId, Stance> = {
  piplup: 'waddle', starly: 'perch', shinx: 'spry', buizel: 'spry', riolu: 'spry', gible: 'braced', snover: 'braced', drifloon: 'hover',
};

const movement: Record<Stance, { reach: number; lift: number; spring: number; tilt: number }> = {
  waddle: { reach: .74, lift: .07, spring: .91, tilt: 9 },
  perch: { reach: .91, lift: .23, spring: .99, tilt: 14 },
  spry: { reach: .85, lift: .13, spring: .89, tilt: 11 },
  braced: { reach: .56, lift: .034, spring: .86, tilt: 5 },
  hover: { reach: .68, lift: .16, spring: 1.035, tilt: 10 },
};

const styles: Record<MoveId, Style> = {
  pound: 'impact', 'bubble-beam': 'bubbles', peck: 'slash', growl: 'echo', tackle: 'impact', 'quick-attack': 'dash',
  'wing-attack': 'slash', leer: 'echo', bite: 'spirit', spark: 'lightning', 'water-gun': 'stream', 'aqua-jet': 'stream',
  astonish: 'spirit', gust: 'wind', 'focus-energy': 'focus', 'ominous-wind': 'spirit', 'force-palm': 'impact',
  feint: 'dash', screech: 'echo', 'sand-attack': 'earth', bulldoze: 'earth', 'dragon-claw': 'slash',
  'powder-snow': 'ice', 'razor-leaf': 'leaves', 'ice-shard': 'ice', struggle: 'impact',
};

const neutral: Palette = { core: '#fff3dd', glow: '#e5bd94', edge: '#b17f66' };
const pal: Partial<Record<typeof moves[MoveId]['type'], Palette>> = {
  water: { core: '#d8fdff', glow: '#69e5ed', edge: '#2189b4' },
  flying: { core: '#f7fcff', glow: '#a8daca', edge: '#76a8ce' },
  electric: { core: '#fff9cf', glow: '#ffda62', edge: '#e39a34' },
  fighting: { core: '#fff0c8', glow: '#f3b47a', edge: '#e17c69' },
  ground: { core: '#ffeac9', glow: '#e4b778', edge: '#a47a6d' },
  ghost: { core: '#f6dcff', glow: '#cba0ef', edge: '#745ab6' },
  dark: { core: '#e3d9f5', glow: '#a994bc', edge: '#654b83' },
  dragon: { core: '#fff0ff', glow: '#ef9cf1', edge: '#ae61cf' },
  ice: { core: '#f6fcff', glow: '#b9ecfc', edge: '#75abcc' },
  grass: { core: '#f3ffbe', glow: '#b1e080', edge: '#58a374' },
};
const recovery: Palette = { core: '#f0ffce', glow: '#aef0b0', edge: '#55b893' };
const capsulePalette: Palette = { core: '#fff4cd', glow: '#92f0d4', edge: '#439a8d' };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const ease = (p: number) => 1 - Math.pow(1 - clamp(p), 3);
const fraction = (time: number, start: number, end: number) => clamp((time - start) / (end - start));
const wave = (n: number) => Math.sin(clamp(n) * Math.PI);

type Beat = { duration: number; contact: number };
type Approach = { close: boolean; x: number; floor: number; lift: number; tilt: number; scale: number };

export function battleBeat(frame: BattleFrame): Beat {
  if (frame.capture === 'shake') return { duration: frame.duration, contact: Math.round(frame.duration * .25) };
  if (frame.capture === 'break') return { duration: 430, contact: 30 };
  if (frame.state.outcome === 'caught') return { duration: 530, contact: 0 };
  if (frame.effect === 'heal') return { duration: Math.min(frame.duration, 440), contact: 75 };
  if (frame.cue === 'switch') return { duration: Math.min(frame.duration, 465), contact: 145 };
  if (!frame.move) return { duration: 0, contact: 0 };
  if (frame.move.result === 'recoil' || frame.move.result === 'stalled') return { duration: 285, contact: 45 };
  const duration = Math.min(540, frame.duration);
  const style = styles[frame.move.id];
  const quick = style === 'impact' || style === 'dash' || style === 'slash' || style === 'lightning';
  return { duration, contact: Math.round(duration * (quick ? .38 : .49)) };
}

function ring(ctx: CanvasRenderingContext2D, point: Point, rx: number, ry: number, tilt: number, color: string, alpha: number, width: number) {
  if (alpha <= 0 || rx <= 0 || ry <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, rx, ry, tilt, 0, Math.PI * 2);
  ctx.stroke();
}

function glow(ctx: CanvasRenderingContext2D, point: Point, radius: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  const light = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
  light.addColorStop(0, color);
  light.addColorStop(1, `${color}00`);
  ctx.fillStyle = light;
  ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
}

function streak(ctx: CanvasRenderingContext2D, points: Point[], color: string, alpha: number, width: number) {
  if (alpha <= 0 || points.length < 2) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function trailPoint(a: Point, b: Point, p: number, arc: number): Point {
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) - wave(p) * arc };
}

function shard(ctx: CanvasRenderingContext2D, p: Point, size: number, angle: number, color: string, alpha: number, stretch = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.scale(stretch, 1);
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(-size * .12, -size * .45);
  ctx.lineTo(size, 0);
  ctx.lineTo(size * .13, size * .56);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function burst(ctx: CanvasRenderingContext2D, center: Point, size: number, phase: number, palette: Palette, style: Style, intensity: number) {
  const fade = 1 - phase;
  if (fade <= 0) return;
  const spread = ease(phase);
  const vapor = style === 'bubbles' || style === 'stream' || style === 'wind' || style === 'spirit';
  glow(ctx, center, size * (1.1 + spread * .65), palette.glow, fade * .58 * intensity);
  ring(ctx, center, size * (.25 + spread * 1.1), size * (.19 + spread * .78), -.23, palette.core, fade * .73, Math.max(1, size * .035));
  if (vapor || intensity > 1) ring(ctx, center, size * (.17 + spread * 1.35), size * (.11 + spread * .78), .33, palette.glow, fade * .42, Math.max(1, size * .025));
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6 + (i % 3) * .14;
    const radius = size * (.23 + (i % 4 + 2) * .21 * spread);
    const tip = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius * .8 };
    const length = Math.max(1.7, size * (.045 + (i % 3) * .012)) * fade;
    shard(ctx, tip, length, angle, i % 3 ? palette.glow : palette.core, fade * .86, vapor ? 1 : 2.1);
  }
}

function shoot(ctx: CanvasRenderingContext2D, style: Style, source: Point, target: Point, scale: number, time: number, contact: number, palette: Palette) {
  const progress = fraction(time, 36, contact + 36);
  if (progress <= 0 || time > contact + 84) return;
  const heading = Math.atan2(target.y - source.y, target.x - source.x);
  const waveHeight = scale * .42;
  const light = wave(fraction(time, 20, contact + 84));
  if (style === 'lightning') {
    const tip = trailPoint(source, target, ease(progress), waveHeight / 4);
    const points = [source];
    for (let i = 1; i < 8; i++) {
      const point = trailPoint(source, tip, i / 8, 0);
      point.y += (i % 2 ? 1 : -1) * scale * (.13 + (i % 3) * .055);
      points.push(point);
    }
    points.push(tip);
    streak(ctx, points, palette.edge, light * .34, 10);
    streak(ctx, points, palette.glow, light * .9, 3.3);
    streak(ctx, points, palette.core, light, 1.25);
    const joint = points[4];
    streak(ctx, [joint, { x: joint.x + scale * .36, y: joint.y - scale * .65 }, { x: joint.x + scale * .72, y: joint.y - scale * .55 }], palette.glow, light * .56, 1.3);
    return;
  }
  if (style === 'earth') {
    for (let i = 0; i < 5; i++) {
      const offset = progress * 1.25 - i * .13;
      if (offset <= 0 || offset > 1) continue;
      const p = trailPoint(source, target, offset, 0);
      ring(ctx, p, scale * .32, scale * .11, .04, palette.glow, light * .7, 2);
      shard(ctx, { x: p.x, y: p.y - (i % 2 + 1) * scale * .19 }, scale * (.1 + i % 3 * .035), i, palette.core, light * .66);
    }
    return;
  }
  if (style === 'stream' || style === 'dash') {
    for (let layer = 0; layer < 3; layer++) {
      const start = Math.max(0, progress - .42 - layer * .08);
      const points: Point[] = [];
      for (let i = 0; i < 13; i++) {
        const part = lerp(start, progress, i / 12);
        points.push(trailPoint(source, target, part, waveHeight * (.46 + layer * .27)));
      }
      streak(ctx, points, layer === 0 ? palette.core : layer === 1 ? palette.glow : palette.edge, light * (1 - layer * .25), scale * (.04 + layer * .043));
    }
    return;
  }
  if (style === 'impact' || style === 'slash' || style === 'focus') return;
  const count = style === 'bubbles' ? 12 : style === 'echo' ? 5 : 9;
  for (let i = 0; i < count; i++) {
    const progressOffset = progress * 1.48 - i * .047;
    if (progressOffset <= 0 || progressOffset > 1) continue;
    const p = trailPoint(source, target, progressOffset, waveHeight * ((i % 3) - .2));
    p.y += Math.sin(progressOffset * 10 + i) * scale * .09;
    const size = scale * (.072 + (i % 4) * .025);
    if (style === 'bubbles') {
      glow(ctx, p, size * 2.2, palette.edge, .34 * light);
      ring(ctx, p, size, size, 0, palette.glow, .95 * light, 1.3);
      ring(ctx, { x: p.x - size * .32, y: p.y - size * .37 }, size * .23, size * .19, -.35, palette.core, .94 * light, 1.1);
    } else if (style === 'spirit' || style === 'wind' || style === 'echo') {
      ring(ctx, p, size * 1.5, size * (2.3 + progressOffset), heading, i % 2 ? palette.core : palette.glow, light * .64, size * .24);
      if (style === 'spirit') glow(ctx, p, size * 2.6, palette.edge, light * .28);
    } else {
      shard(ctx, p, size * 1.25, heading + progressOffset * 4, i % 2 ? palette.core : palette.glow, light * .9, style === 'leaves' ? 1.7 : 1.15);
    }
  }
}

function cut(ctx: CanvasRenderingContext2D, p: Point, size: number, heading: number, phase: number, palette: Palette, count: number) {
  const active = wave(fraction(phase, 0, .69));
  if (active <= 0) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(heading - .73);
  for (let i = 0; i < count; i++) {
    const row = (i - (count - 1) / 2) * size * .32;
    ctx.globalAlpha = active * .94;
    const color = ctx.createLinearGradient(-size, row, size, row);
    color.addColorStop(0, `${palette.edge}00`);
    color.addColorStop(.43, palette.glow);
    color.addColorStop(.64, palette.core);
    color.addColorStop(1, `${palette.glow}00`);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-size, row + size * .28);
    ctx.quadraticCurveTo(-size * .15, row - size * .56, size, row - size * .28);
    ctx.quadraticCurveTo(size * .16, row - size * .05, -size, row + size * .28);
    ctx.fill();
  }
  ctx.restore();
}

function approach(source: Anchor, target: Anchor, id: MoveId, miss: boolean): Approach {
  const weight = movement[source.stance];
  const style = styles[id];
  const close = style === 'impact' || style === 'dash' || style === 'slash' || id === 'aqua-jet' || id === 'bite' || id === 'astonish';
  const distance = target.feet.x - source.feet.x;
  const direction = Math.sign(distance);
  const gap = (source.size * .26 + target.size * .26) * (miss ? 1.75 : 1);
  const x = close ? direction * Math.max(0, Math.abs(distance) - gap) : distance * .066;
  const depth = close && distance ? x / distance : .04;
  return {
    close, x, floor: (target.feet.y - source.feet.y) * depth,
    lift: source.size * weight.lift * (close ? 1.35 : .25),
    tilt: direction * (close ? weight.tilt : weight.tilt * .42),
    scale: lerp(1, target.size / source.size, depth * .65),
  };
}

function kickDust(ctx: CanvasRenderingContext2D, feet: Point, size: number, phase: number, direction: number) {
  const light = Math.sin(fraction(phase, 0, .95) * Math.PI) * .56;
  const spread = ease(phase);
  for (let i = 0; i < 7; i++) {
    const offset = size * ((i % 4 + 1) * .052 + spread * (i + 1) * .031);
    const p = { x: feet.x - offset * direction, y: feet.y + (i % 3 - 1) * 2 - Math.sin(spread * 2.3) * (2.5 + i % 4 * 2.5) };
    glow(ctx, p, Math.max(3, size * (.045 + i % 3 * .014)), i % 3 ? '#dcb991' : '#f5e0bc', light * (i % 2 ? .73 : 1));
  }
}

function arcTrace(ctx: CanvasRenderingContext2D, source: Anchor, path: Approach, elapsed: number, contact: number, palette: Palette) {
  const progress = fraction(elapsed, contact * .37, contact);
  const fade = wave(fraction(elapsed, contact * .33, contact + 49));
  if (progress <= 0 || fade <= 0) return;
  const direction = Math.sign(path.x);
  const at = { x: source.center.x + path.x, y: source.center.y + path.floor };
  for (let i = 0; i < 4; i++) {
    const tail = Math.max(0, progress - (.38 + i * .085));
    const band = source.size * (i - 1.4) * .037;
    const points: Point[] = [];
    for (let vertex = 0; vertex <= 8; vertex++) {
      const step = lerp(tail, progress, vertex / 8);
      const point = trailPoint(source.center, at, step, path.lift + i * 6);
      points.push({ x: point.x, y: point.y + band });
    }
    streak(ctx, points, i === 1 ? palette.core : palette.glow, fade * (i === 1 ? .58 : .3), i === 1 ? 1.8 : 1.05);
  }
  if (source.stance !== 'hover') kickDust(ctx, source.feet, source.size * .56, fraction(elapsed, contact * .37, contact + 185), direction);
}

function captureCharm(ctx: CanvasRenderingContext2D, p: Point, radius: number, angle: number, alpha: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.globalAlpha = clamp(alpha);
  const metal = ctx.createLinearGradient(-radius, -radius, radius, radius);
  metal.addColorStop(0, '#fdf5cf'); metal.addColorStop(.38, '#b3e2c7'); metal.addColorStop(1, '#2d766e');
  ctx.fillStyle = metal;
  ctx.strokeStyle = '#233f38';
  ctx.lineWidth = Math.max(1, radius * .17);
  ctx.beginPath();
  for (let j = 0; j < 8; j++) {
    const direction = Math.PI / 8 + j * Math.PI / 4;
    const x = Math.cos(direction) * radius, y = Math.sin(direction) * radius;
    if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#346768';
  ctx.fillRect(-radius * .47, -radius * .47, radius * .94, radius * .94);
  ctx.fillStyle = '#eeffd6';
  ctx.fillRect(-radius * .18, -radius * .18, radius * .36, radius * .36);
  ctx.restore();
}

function runCapture(ctx: CanvasRenderingContext2D, frame: BattleFrame, actors: ArenaCast, elapsed: number, beat: Beat) {
  const { ally, enemy } = actors;
  const size = Math.max(7, Math.min(13, enemy.size * .086));
  const floor = { x: enemy.feet.x, y: enemy.feet.y - 4 };
  const time = clamp(elapsed / beat.duration);
  if (frame.capture === 'shake') {
    const catchPoint = { x: enemy.center.x, y: enemy.center.y + size * .2 };
    if (elapsed < beat.contact) {
      const release = { x: Math.max(12, ally.feet.x - ally.size * .71), y: ally.center.y + ally.size * .14 };
      const arc = Math.max(29, enemy.size * .46);
      const path = trailPoint(release, catchPoint, fraction(elapsed, 38, beat.contact), arc);
      const tail = trailPoint(release, catchPoint, fraction(elapsed - 55, 38, beat.contact), arc);
      if (elapsed < 39) return;
      glow(ctx, path, size * 2.1, capsulePalette.edge, .47);
      streak(ctx, [tail, path], capsulePalette.glow, .67, Math.max(1.6, size * .3));
      captureCharm(ctx, path, size, time * 17, .98);
    } else if (time < .46) {
      const draw = fraction(time, .25, .46);
      const pocket = trailPoint(catchPoint, floor, draw * draw, 0);
      burst(ctx, catchPoint, enemy.size * .40, draw, capsulePalette, 'bubbles', 1.05);
      for (let strand = 0; strand < 4; strand++) {
        const angle = strand * Math.PI / 2 + draw * 2.7;
        const radius = enemy.size * .30 * (1 - draw);
        const point = { x: pocket.x + Math.cos(angle) * radius, y: pocket.y + Math.sin(angle) * radius * .65 };
        const rim = { x: point.x + Math.cos(angle + 1.2) * radius * .38, y: point.y + Math.sin(angle + 1.2) * radius * .36 };
        streak(ctx, [rim, point, pocket], capsulePalette.core, .72 * wave(draw), Math.max(1.2, size * .18));
      }
      captureCharm(ctx, pocket, size, .21 * Math.sin(draw * 12), 1);
    } else {
      const elapsedShakes = (time - .51) / .143;
      const shake = Math.max(0, Math.floor(elapsedShakes));
      const beatPhase = clamp(elapsedShakes - shake);
      const lean = shake < 3 ? Math.sin(beatPhase * Math.PI * 2) * wave(beatPhase) * .84 * (shake % 2 ? -1 : 1) : 0;
      const landing = fraction(time, .46, .525);
      const rise = Math.abs(lean * size * .73) + Math.sin(landing * Math.PI) * 4;
      glow(ctx, floor, size * 2.8, capsulePalette.glow, .18 + Math.abs(lean) * .45);
      if (shake < 3) ring(ctx, floor, size * (1.25 + beatPhase * 1.4), size * (.45 + beatPhase * .53), .03,
        capsulePalette.glow, wave(beatPhase) * .55, Math.max(1, size * .15));
      captureCharm(ctx, { x: floor.x + lean * size * .39, y: floor.y - rise }, size, lean, 1);
    }
  } else if (frame.capture === 'break') {
    burst(ctx, floor, enemy.size * .37, time, capsulePalette, 'impact', 1.08);
    const reveal = wave(fraction(time, 0, .8));
    const tip = trailPoint(floor, enemy.center, ease(time), 0);
    glow(ctx, tip, enemy.size * .33, capsulePalette.core, reveal * .55);
    streak(ctx, [floor, tip], capsulePalette.glow, reveal * .60, size * .37);
  } else {
    ring(ctx, floor, size * (1.2 + ease(time) * 2.1), size * (.42 + ease(time) * .8), 0, capsulePalette.glow, (1 - time) * .88, 2);
    glow(ctx, floor, size * 4.6, capsulePalette.glow, .36 * (1 - time));
    captureCharm(ctx, floor, size, 0, 1);
  }
}

function paint(ctx: CanvasRenderingContext2D, frame: BattleFrame, actors: ArenaCast, elapsed: number, beat: Beat) {
  if (frame.effect === 'capture') {
    runCapture(ctx, frame, actors, elapsed, beat);
    return;
  }
  const motion = frame.move;
  const source = actors[motion?.source ?? 'ally'];
  const target = actors[motion?.target ?? 'ally'];
  if (frame.cue === 'switch') {
    const time = clamp(elapsed / beat.duration);
    const reveal = fraction(elapsed, 65, 295);
    const light = wave(reveal);
    glow(ctx, target.center, target.size * .66, capsulePalette.glow, light * .52);
    ring(ctx, target.feet, target.size * (.17 + ease(time) * .42), target.size * (.05 + time * .08), .04, capsulePalette.core, (1 - time) * .78, 2);
    if (elapsed > beat.contact) burst(ctx, target.center, target.size * .27, fraction(elapsed, beat.contact, beat.duration), capsulePalette, 'wind', .76);
    return;
  }
  if (frame.effect === 'heal') {
    const time = clamp(elapsed / beat.duration);
    const light = wave(time);
    glow(ctx, target.center, target.size * .54, recovery.glow, light * .43);
    ring(ctx, { x: target.feet.x, y: target.feet.y - time * target.size * .35 }, target.size * .43, target.size * .11, -.03, recovery.core, light * .85, 2);
    for (let i = 0; i < 6; i++) {
      const p = { x: target.center.x + Math.sin(i * 2) * target.size * .34, y: target.center.y + (i % 3 - 1) * 8 - time * target.size * .33 };
      const size = Math.max(2, target.size * .034);
      ctx.globalAlpha = light;
      ctx.fillStyle = recovery.core;
      ctx.fillRect(p.x - size, p.y - .8, size * 2, 1.6);
      ctx.fillRect(p.x - .8, p.y - size, 1.6, size * 2);
    }
    return;
  }
  if (!motion) return;
  const style = styles[motion.id];
  const colorType = motion.result === 'stalled' && target.ailment
    ? target.ailment === 'freeze' ? 'ice' : 'electric'
    : moves[motion.id].type;
  const palette = pal[colorType] ?? neutral;
  const size = Math.max(21, Math.min(64, target.size * .42));
  const tail = fraction(elapsed, beat.contact, beat.duration);
  const kickoff = wave(fraction(elapsed, 0, beat.contact + 15));
  if (motion.result !== 'stalled' && motion.result !== 'recoil') {
    const from = style === 'earth' ? source.feet : source.center;
    const destination = style === 'earth' ? target.feet : target.center;
    const aim = motion.result === 'miss' ? { x: destination.x, y: destination.y - size * .96 } : destination;
    shoot(ctx, style, from, aim, size, elapsed, beat.contact, palette);
    glow(ctx, from, size * .67, palette.glow, kickoff * .36);
    if (motion.source !== motion.target) {
      const path = approach(source, target, motion.id, motion.result === 'miss');
      if (path.close) arcTrace(ctx, source, path, elapsed, beat.contact, palette);
    }
  }
  if (elapsed < beat.contact) return;
  if (motion.result === 'hit' || motion.result === 'recoil') {
    let force = motion.critical ? 1.32 : (motion.effectiveness ?? 1) > 1 ? 1.17 : 1;
    if ((motion.effectiveness ?? 1) < 1) force *= .75;
    const impact = style === 'earth' ? { ...target.feet, y: target.feet.y - size * .18 } : target.center;
    burst(ctx, impact, size * force, tail, palette, style, force);
    if (style === 'slash' || style === 'dash') {
      const direction = Math.atan2(target.center.y - source.center.y, target.center.x - source.center.x);
      cut(ctx, impact, size, direction, tail, palette, motion.id === 'dragon-claw' ? 3 : motion.id === 'wing-attack' ? 2 : 1);
    }
  } else if (motion.result === 'status' || motion.result === 'immune' || motion.result === 'stalled') {
    const radius = size * (.55 + ease(tail) * .61);
    ring(ctx, target.center, radius * .91, radius, .29, palette.glow, (1 - tail) * .68, 2);
    ring(ctx, { ...target.feet, y: target.feet.y - size * .08 }, radius, radius * .25, -.09, palette.core, (1 - tail) * .74, 1.5);
    glow(ctx, target.center, radius, palette.glow, (1 - tail) * .24);
  }
}

function readCast(arena: HTMLElement): ArenaCast | undefined {
  const get = (side: BattleSide): Anchor | undefined => {
    const actor = arena.querySelector<HTMLElement>(`.battle-combatant--${side}`);
    const pose = actor?.querySelector<HTMLElement>('.battle-pose');
    if (!actor || !pose) return;
    const width = actor.offsetWidth;
    const height = pose.offsetHeight;
    const size = Math.max(width * .55, Math.min(width, height * 1.06));
    const feet = { x: actor.offsetLeft + width / 2, y: actor.offsetTop };
    const stance = actor.dataset.stance as Stance;
    const ailment = actor.dataset.ailment as Ailment | undefined;
    return { feet, center: { x: feet.x, y: feet.y - height * (stance === 'hover' ? .65 : .5) }, size,
      pose, shadow: actor.querySelector('.battle-pedestal'), stance, ailment };
  };
  const ally = get('ally'), enemy = get('enemy');
  if (ally && enemy) return { ally, enemy };
}

function animateCast(actors: ArenaCast, frame: BattleFrame, beat: Beat) {
  const move = frame.move;
  if (!move) {
    const { ally } = actors;
    const bodyWeight = movement[ally.stance];
    if (frame.capture === 'shake') return [ally.pose.animate([
      { transform: 'none' },
      { transform: `translate(-4%,1%) rotate(-5deg) scale(1.035,${bodyWeight.spring})`, offset: .22 },
      { transform: `translate(9%,-${Math.max(2, bodyWeight.lift * 45)}%) rotate(9deg) scale(.98,1.04)`, offset: .46 },
      { transform: 'translate(3%,1%) rotate(2deg) scale(1.035,.975)', offset: .74 },
      { transform: 'none' },
    ], { duration: beat.contact + 240, easing: 'ease-in-out' })];
    if (frame.state.outcome === 'caught') return [ally.pose.animate([
      { transform: 'none' },
      { transform: `translateY(2%) scale(1.08,${bodyWeight.spring})`, offset: .34 },
      { transform: `translateY(-${Math.max(9, bodyWeight.lift * 96)}%) rotate(-6deg) scale(.97,1.06)`, offset: .58 },
      { transform: 'scale(1.07,.94)', offset: .81 },
      { transform: 'none' },
    ], { duration: beat.duration, easing: 'ease-in-out' })];
    return [];
  }
  const source = actors[move.source], target = actors[move.target];
  const weight = movement[source.stance];
  const running: Animation[] = [];
  if (move.result === 'stalled' && source.ailment !== 'freeze') {
    const shake = source.ailment === 'paralysis' ? 5 : 2.5;
    return [source.pose.animate([
      { transform: 'none' },
      { transform: `translateX(${-shake}px) rotate(-3deg) scale(1.035,.96)`, offset: .19 },
      { transform: `translateX(${shake}px)`, offset: .38 },
      { transform: `translateX(${-shake * .53}px) scale(1.025,.975)`, offset: .62 },
      { transform: 'none' },
    ], { duration: beat.duration, easing: 'ease-out' })];
  }
  if (move.source !== move.target && move.result !== 'stalled') {
    const path = approach(source, target, move.id, move.result === 'miss');
    const { close, x, floor, lift, tilt, scale } = path;
    const pull = Math.sign(x) * Math.min(Math.abs(x) * .31, source.size * (close ? .14 : .071)) * weight.reach;
    const duration = Math.min(beat.duration, beat.contact + (source.stance === 'braced' ? 235 : 205));
    const contact = beat.contact / duration;
    running.push(source.pose.animate([
      { transform: 'none' },
      { transform: `translate(${-pull}px,${source.size * .022}px) rotate(${-tilt * .56}deg) scale(1.06,${weight.spring})`, offset: contact * .39, easing: 'cubic-bezier(.3,.08,.43,.56)' },
      { transform: `translate(${x * .41}px,${floor * .41 - lift}px) rotate(${tilt * .58}deg) scale(${lerp(1, scale, .4)})`, offset: contact * .72, easing: 'ease-out' },
      { transform: `translate(${x}px,${floor - lift * .28}px) rotate(${tilt}deg) scale(${scale * 1.04},${scale * 1.05})`, offset: contact, easing: 'cubic-bezier(.18,.6,.29,1)' },
      { transform: `translate(${x * .66}px,${floor * .66 - lift * .59}px) rotate(${-tilt * .22}deg) scale(${lerp(1, scale, .65)})`, offset: Math.min(.84, contact + .21), easing: 'ease-out' },
      { transform: `translate(${x * .13}px,${floor * .12 + source.size * .013}px) scale(1.055,${weight.spring + .036})`, offset: .89, easing: 'ease-out' },
      { transform: 'none' },
    ], { duration }));
    if (source.shadow) running.push(source.shadow.animate([
      { translate: '0px' }, { translate: `${-pull * .8}px`, offset: contact * .39 },
      { translate: `${x * .41}px ${floor * .41}px`, opacity: close ? .48 + (1 - weight.lift) * .19 : .85, offset: contact * .72 },
      { translate: `${x}px ${floor}px`, opacity: .91, offset: contact },
      { translate: `${x * .66}px ${floor * .66}px`, opacity: close ? .61 : .89, offset: Math.min(.84, contact + .21) },
      { translate: '0px' },
    ], { duration }));
  } else if (move.result === 'status') {
    running.push(source.pose.animate([
      { transform: 'none' },
      { transform: `translateY(${source.size * .019}px) scale(1.08,${weight.spring})`, offset: .26 },
      { transform: `translateY(${-source.size * .045}px) scale(.99,1.07)`, offset: .54 },
      { transform: 'none' },
    ], { duration: beat.duration, easing: 'ease-in-out' }));
  }
  if (move.result === 'hit' || move.result === 'recoil' || move.result === 'miss') {
    const reverse = Math.sign(target.center.x - source.center.x) || (move.target === 'enemy' ? 1 : -1);
    const airy = target.stance === 'hover' || target.stance === 'perch';
    const distance = target.size * (move.critical ? .22 : target.stance === 'braced' ? .085 : .14) * reverse;
    const buckle = airy ? 'scale(.98,1.04)' : 'scale(1.07,.91)';
    const rise = -Math.abs(distance) * (airy ? .83 : .21);
    const delay = move.result === 'miss' ? beat.contact * .7 : beat.contact;
    running.push(target.pose.animate([
      { transform: 'none', filter: 'none' },
      { transform: `translate(${distance}px,${rise}px) rotate(${reverse * (airy ? 13 : 7)}deg) ${buckle}`, filter: move.result === 'miss' ? 'none' : 'brightness(1.18)', offset: .20 },
      { transform: `translate(${distance * .29}px,${Math.abs(rise) * .16}px) rotate(${-reverse * 2.6}deg) scale(1.04,.97)`, filter: 'none', offset: .59 },
      { transform: 'none' },
    ], { duration: Math.max(130, Math.min(242, beat.duration - delay)), delay, easing: 'ease-out' }));
  }
  return running;
}

export function BattleMotion({ frame, reduced }: { frame: BattleFrame; reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const surface = canvas.current;
    const arena = surface?.parentElement;
    const ctx = surface?.getContext('2d');
    if (!surface || !arena || !ctx) return;
    const beat = battleBeat(frame);
    ctx.clearRect(0, 0, surface.width, surface.height);
    if (reduced || !beat.duration) return;
    let raf = 0;
    let actors = readCast(arena);
    if (!actors) return;
    const animations = animateCast(actors, frame, beat);
    const start = performance.now();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    function resize() {
      surface!.width = Math.max(1, Math.round(arena!.clientWidth * pixelRatio));
      surface!.height = Math.max(1, Math.round(arena!.clientHeight * pixelRatio));
      ctx!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      actors = readCast(arena!);
    }
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(arena);
    function draw(now: number) {
      if (!surface || !ctx || !actors) return;
      const elapsed = Math.min(beat.duration, Math.max(0, now - start));
      ctx.clearRect(0, 0, surface.width / pixelRatio, surface.height / pixelRatio);
      paint(ctx, frame, actors, elapsed, beat);
      ctx.globalAlpha = 1;
      if (elapsed < beat.duration) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      animations.forEach(animation => animation.cancel());
    };
  }, [frame, reduced]);
  return <canvas ref={canvas} className="battle-motion" aria-hidden="true" />;
}
