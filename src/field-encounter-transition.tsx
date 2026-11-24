import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './field-encounter-transition.css';

type Entrance = 'wild' | 'trainer' | 'trial';
type Phase = 'approach' | 'covered' | 'open';
type Sweep = { ink: string; shade: string; rim: string; leaf: string };

const travelTime = 735;
const coveredTime = 352;
const daylight: Record<Entrance, Sweep> = {
  wild: { ink: '#162b29', shade: '#23483c', rim: '#d0e3a9', leaf: '#668c58' },
  trainer: { ink: '#192930', shade: '#32463b', rim: '#e9ce9a', leaf: '#9d8154' },
  trial: { ink: '#202938', shade: '#3c4c56', rim: '#f1d9a9', leaf: '#a98c6a' },
};
const moonlight: Sweep = { ink: '#11242d', shade: '#203e46', rim: '#bcdeda', leaf: '#567b73' };
const limit = (value: number) => Math.max(0, Math.min(1, value));
const segment = (elapsed: number, a: number, b: number) => limit((elapsed - a) / (b - a));
const smooth = (amount: number) => amount * amount * (3 - 2 * amount);
const showLessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function blade(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number, curvature: number, tint: Sweep, alpha: number) {
  if (alpha <= 0) return;
  const bend = length * curvature;
  const width = length * .10;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = limit(alpha);
  const light = ctx.createLinearGradient(-width, length / 2, width + bend, -length / 2);
  light.addColorStop(0, tint.ink);
  light.addColorStop(.59, tint.leaf);
  light.addColorStop(1, tint.rim);
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(0, length * .48);
  ctx.quadraticCurveTo(-width * 1.25, -length * .06, bend, -length * .58);
  ctx.quadraticCurveTo(bend - width * .08, -length * .13, width * .85, length * .20);
  ctx.quadraticCurveTo(width * .22, length * .36, 0, length * .48);
  ctx.fill();
  ctx.globalAlpha *= .48;
  ctx.strokeStyle = tint.rim;
  ctx.lineWidth = Math.max(.5, length * .008);
  ctx.beginPath();
  ctx.moveTo(width * .12, length * .27);
  ctx.quadraticCurveTo(-width * .14, -length * .02, bend * .92, -length * .52);
  ctx.stroke();
  ctx.restore();
}

function dust(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number, tint: Sweep) {
  const ground = { x: width * .48, y: height * .70 };
  const ripple = segment(elapsed, 16, 208);
  ctx.globalAlpha = Math.sin(ripple * Math.PI) * .46;
  ctx.lineWidth = 1;
  ctx.strokeStyle = tint.rim;
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, 7 + ripple * 37, 2 + ripple * 9, -.11, 0, Math.PI * 2);
  ctx.stroke();
  const drift = Math.min(width, height);
  for (let i = 0; i < 12; i++) {
    const p = segment(elapsed, 10 + i * 8, 255 + i * 12);
    if (p <= 0 || p >= 1) continue;
    const side = i % 2 ? -1 : 1;
    const x = ground.x + Math.max(7, drift * (.08 + i * .008)) * p * side;
    const y = ground.y - Math.sin(p * Math.PI * .75) * drift * (.056 + (i % 4) * .035);
    const age = Math.sin(p * Math.PI);
    if (i < 8) blade(ctx, x, y, Math.max(9, drift * (.033 + (i % 4) * .015)), p * side * 2.1, .26 * side, tint, age * .91);
    else {
      ctx.fillStyle = tint.rim;
      ctx.globalAlpha = age * .76;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

function draw(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number, kind: Entrance, tint: Sweep) {
  ctx.clearRect(0, 0, width, height);
  if (kind === 'wild' && elapsed < 410) dust(ctx, width, height, elapsed, tint);
  const enter = smooth(segment(elapsed, 58, coveredTime));
  const exit = smooth(segment(elapsed, coveredTime + 52, travelTime));
  const lower = 1.42 - exit * 1.9;
  const upper = 1.26 - enter * 1.69;
  const edge = (x: number, level: number) => {
    const sway = Math.sin(x * 8.3 + elapsed * .0045) * .027;
    return height * (level + (x - .5) * .37 + sway);
  };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, edge(0, upper));
  for (let i = 1; i <= 13; i++) ctx.lineTo(width * i / 13, edge(i / 13, upper));
  for (let i = 13; i >= 0; i--) ctx.lineTo(width * i / 13, edge(i / 13, lower));
  ctx.closePath();
  ctx.clip();
  const wash = ctx.createLinearGradient(width * .1, height, width * .85, 0);
  wash.addColorStop(0, tint.ink);
  wash.addColorStop(.58, tint.shade);
  wash.addColorStop(1, tint.ink);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  if (kind === 'wild') {
    for (let i = 0; i < 10; i++) {
      const lane = ((i * .347 + .07) % 1);
      const size = Math.min(height * .46, width * .62) * (.50 + i % 5 * .14);
      const x = width * (lane + enter * .13 + exit * .08 - .06);
      const y = edge(lane, upper) + size * (.24 + i % 3 * .11);
      blade(ctx, x, y, size, -1.1 + i % 4 * .18 + enter * .46, i % 2 ? -.34 : .32, tint, .63 + i % 4 * .092);
    }
  }
  for (let i = 0; i < 5; i++) {
    const line = upper + .04 + i * .055;
    ctx.globalAlpha = .18 - i * .024;
    ctx.strokeStyle = tint.rim;
    ctx.lineWidth = i === 0 ? 1.5 : .75;
    ctx.beginPath();
    ctx.moveTo(0, edge(0, line));
    for (let fragment = 1; fragment <= 10; fragment++) {
      const x = fragment / 10;
      ctx.lineTo(x * width, edge(x, line));
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function FieldEncounterTransition({ children, kind = 'wild', night = false, onCovered }: {
  children: ReactNode; kind?: Entrance; night?: boolean; onCovered?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() => showLessMotion() ? 'open' : 'approach');
  const surface = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const notify = useRef(onCovered);
  const notified = useRef(false);
  const style = useRef({ kind, tint: night ? moonlight : daylight[kind] });
  notify.current = onCovered;

  useLayoutEffect(() => {
    const canvas = surface.current;
    const context = canvas?.getContext('2d');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let timer = 0;
    let finished = false;
    const cover = () => {
      if (notified.current) return;
      notified.current = true;
      setPhase('covered');
      notify.current?.();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      preference.removeEventListener('change', preferenceChanged);
      cover();
      setPhase('open');
    };
    function preferenceChanged() {
      if (preference.matches) finish();
    }
    if (!canvas || !context || preference.matches) {
      finish();
      return;
    }
    const start = performance.now();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.65);
    const render = (now: number) => {
      const elapsed = Math.max(0, now - start);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width && height) {
        const pixelsWide = Math.ceil(width * pixelRatio);
        const pixelsHigh = Math.ceil(height * pixelRatio);
        if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
        if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        draw(context, width, height, elapsed, style.current.kind, style.current.tint);
      }
      if (elapsed >= coveredTime) cover();
      if (elapsed < travelTime) raf = requestAnimationFrame(render);
      else finish();
    };
    preference.addEventListener('change', preferenceChanged);
    timer = window.setTimeout(finish, travelTime + 140);
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      preference.removeEventListener('change', preferenceChanged);
    };
  }, []);

  useLayoutEffect(() => {
    if (phase !== 'open') return;
    const target = stage.current?.querySelector<HTMLElement>('.battle-party-option, .battle-finish button')
      ?? stage.current?.querySelector<HTMLElement>('.battle-overlay');
    target?.focus({ preventScroll: true });
  }, [phase]);

  return <>
    <div ref={stage} className="field-encounter-stage" inert={phase !== 'open'} aria-hidden={phase !== 'open' || undefined}>
      {phase !== 'approach' && children}
    </div>
    {phase !== 'open' && <canvas ref={surface} className="field-encounter-transition" data-phase={phase} aria-hidden="true" />}
  </>;
}
