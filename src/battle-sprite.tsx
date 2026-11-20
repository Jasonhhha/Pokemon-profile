import { useEffect, useLayoutEffect, useRef } from 'react';
import { loadCreatureSprite } from './creature-art';
import { battleBeat } from './battle-motion';
import type { BattleFrame, BattleSide } from './battle-turn';
import { creatures, type CreatureId } from './creatures';

type Flex = { lean: number; breath: number; width: number; phase: number; rhythm: number };

// The artwork stays intact on disk. Two or three pixel rows at a time bend around the planted feet.
const flexBySpecies: Record<CreatureId, Flex> = {
  piplup: { lean: 2.2, breath: 1.4, width: .018, phase: .45, rhythm: 2.70 },
  starly: { lean: 2.7, breath: .92, width: .026, phase: .7, rhythm: 2.30 },
  shinx: { lean: 1.8, breath: 1.2, width: .034, phase: .33, rhythm: 3.17 },
  buizel: { lean: 2.4, breath: 1.15, width: .032, phase: .53, rhythm: 3.08 },
  drifloon: { lean: 3.2, breath: 1.05, width: .042, phase: .21, rhythm: 2.52 },
  riolu: { lean: 2.05, breath: 1.2, width: .019, phase: .33, rhythm: 2.9 },
  gible: { lean: 1.15, breath: .88, width: .032, phase: .18, rhythm: 2.22 },
  snover: { lean: 1.7, breath: .84, width: .025, phase: .23, rhythm: 2.17 },
};
const density = 3;
const width = 64 * density;
const height = 58 * density;
const bodyFloor = height - 3 * density;

type Surface = { source: HTMLCanvasElement; context: CanvasRenderingContext2D; width: number; height: number };
type Bend = { lean: number; breath: number; spread: number; twist: number };
const neutral: Bend = { lean: 0, breath: 0, spread: 0, twist: 0 };
const cycle = (value: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, value)));

function flexAt(profile: Flex, side: BattleSide, idleSeconds: number, action: BattleFrame, age: number, timing: ReturnType<typeof battleBeat>): Bend {
  const time = idleSeconds * profile.rhythm + profile.phase + (side === 'enemy' ? 1.13 : 0);
  const { duration, contact } = timing;
  const move = action.move;
  const source = move?.source === side;
  const target = move?.target === side;
  const windup = source && move.result !== 'stalled' && contact ? cycle(age / contact) : 0;
  const struck = target && (move.result === 'hit' || move.result === 'recoil') ? cycle((age - contact) / 185) : 0;
  const entrance = action.cue === 'switch' && side === 'ally' ? cycle((age - contact) / 280) : 0;
  const capture = action.capture === 'shake' && side === 'ally' ? cycle(age / 300) : 0;
  const bounce = action.state.outcome === 'caught' && side === 'ally' ? cycle((age - 170) / 385) : 0;
  const pressed = Math.max(windup, struck);
  const follow = duration ? cycle((age - contact) / Math.max(190, duration - contact)) : 0;
  const snap = source ? follow : 0;
  return {
    lean: profile.lean * Math.sin(time) + -1.75 * windup + 2.4 * snap - 2.3 * struck + capture * 1.8,
    breath: profile.breath * Math.cos(time * 1.5) - pressed * 1.75 + (entrance + bounce) * 1.35,
    spread: profile.width * Math.sin(time * 1.45) + .055 * pressed - .028 * entrance,
    twist: Math.sin(time * 1.7) * profile.lean * .29 + (snap - struck) * 1.1,
  };
}

function draw(surface: Surface, bend: Bend, mirror: boolean, buoyant: boolean) {
  const { source, context, width: drawnWidth, height: drawnHeight } = surface;
  const bottom = bodyFloor - (buoyant ? 4 * density : 0);
  const edge = (y: number) => {
    const up = 1 - y / source.height;
    return Math.round(bottom - up * drawnHeight - up * bend.breath * density);
  };
  context.clearRect(0, 0, width, height);
  context.save();
  if (mirror) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  for (let y = 0; y < source.height; y += 2) {
    const end = Math.min(source.height, y + 2);
    const up = 1 - (y + end) / (2 * source.height);
    const belly = Math.sin(up * Math.PI);
    const sag = buoyant ? Math.sin(up * 3.7) * bend.twist : belly * bend.twist;
    const shift = (bend.lean * up * up * (buoyant ? 1 : -1) + sag) * density;
    const bandWidth = Math.min(width - 4, Math.round(drawnWidth * (1 + bend.spread * belly)));
    const left = Math.max(2, Math.min(width - bandWidth - 2, Math.round((width - bandWidth) / 2 + shift)));
    const top = edge(y);
    const thickness = edge(end) - top;
    if (thickness > 0) context.drawImage(source, 0, y, source.width, end - y, left, top, bandWidth, thickness);
  }
  context.restore();
}

export function BattleSprite({ id, side, frame, frozen, reduced }: {
  id: CreatureId; side: BattleSide; frame: BattleFrame; frozen: boolean; reduced: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { outcome } = frame.state;
  const withdrawn = side === 'enemy' ? outcome === 'caught' || outcome === 'win' : outcome === 'lost' || outcome === 'fled';
  const animate = !withdrawn && !frozen && !reduced;
  const motion = useRef({ frame, beat: battleBeat(frame), start: 0 });
  useLayoutEffect(() => {
    motion.current = { frame, beat: battleBeat(frame), start: performance.now() };
  }, [frame]);
  const mirror = id === 'drifloon' ? side === 'enemy' : side === 'ally';
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    let alive = true;
    let raf = 0;
    let lastDraw = -Infinity;
    let visible = true;
    let surface: Surface | undefined;
    const start = performance.now();
    const profile = flexBySpecies[id];
    const tick = (now: number) => {
      if (!surface) return;
      if (now - lastDraw >= 29 || !animate) {
        const action = motion.current;
        const bend = animate ? flexAt(profile, side, (now - start) / 1000, action.frame, now - action.start, action.beat) : neutral;
        draw(surface, bend, mirror, id === 'drifloon');
        lastDraw = now;
      }
      if (visible && animate) raf = requestAnimationFrame(tick);
    };
    const observer = typeof IntersectionObserver === 'function' && animate
      ? new IntersectionObserver(([entry]) => {
        if (visible === entry.isIntersecting) return;
        visible = entry.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) tick(performance.now());
      }) : undefined;
    observer?.observe(element);
    void loadCreatureSprite(id).then(source => {
      if (!alive) return;
      const air = id === 'drifloon' ? 4 : 0;
      const scale = Math.min((width - 7 * density) / source.width, (height - (7 + air) * density) / source.height, 1.34 * density);
      context.imageSmoothingEnabled = false;
      surface = { source, context, width: Math.round(source.width * scale), height: Math.round(source.height * scale) };
      tick(performance.now());
    }).catch(() => {});
    return () => {
      alive = false;
      observer?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [animate, id, mirror, side]);
  return <canvas ref={canvas} data-species={id} className="creature-sprite battle-sprite"
    width={width} height={height} role="img" aria-label={creatures[id].name} />;
}
