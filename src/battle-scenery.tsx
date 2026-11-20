import { useEffect, useRef } from 'react';
import harbor from './assets/battle-harbor.webp';
import harborNight from './assets/battle-harbor-night.webp';
import grove from './assets/battle-grove.webp';
import summit from './assets/battle-summit.webp';
import type { BattleEncounter } from './creatures';

const backdrops = { harbor, grove, summit };
const width = 576;
const height = 252;
type Area = NonNullable<BattleEncounter['area']>;

const ambience = {
  harbor: { color: '222, 255, 243', mist: '138, 227, 232', y: .38, band: .26, drift: 8, count: 21 },
  grove: { color: '246, 244, 177', mist: '183, 221, 189', y: .29, band: .49, drift: 14, count: 26 },
  summit: { color: '255, 222, 198', mist: '231, 177, 229', y: .23, band: .39, drift: 23, count: 16 },
};

function drawAmbience(context: CanvasRenderingContext2D, area: Area, seconds: number) {
  const weather = ambience[area];
  context.clearRect(0, 0, width, height);
  // A thin, slowly drifting haze adds a living midground to the static landscape.
  for (let i = 0; i < 3; i++) {
    const x = ((i * 263 + seconds * (4 + i * 1.4)) % (width + 390)) - 150;
    const y = height * (.46 + .038 * i);
    context.save();
    context.translate(x, y);
    context.scale(3.7, .55);
    const radius = i === 0 ? 51 : 64;
    const light = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    light.addColorStop(0, `rgba(${weather.mist}, ${area === 'summit' ? .13 : .075})`);
    light.addColorStop(1, `rgba(${weather.mist}, 0)`);
    context.fillStyle = light;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    context.restore();
  }
  for (let i = 0; i < weather.count; i++) {
    const x = (i * 113 + seconds * (weather.drift + (i % 4))) % (width + 16) - 8;
    const y = height * (weather.y + ((i * 31) % 100) * .01 * weather.band)
      + Math.sin(i * 2 + seconds * .65) * (i % 4 + 1);
    const light = Math.pow(.5 + Math.sin(i * 1.83 + seconds * (1.4 + i % 4 * .28)) * .5, 2);
    const size = .48 + (i % 5) * .19;
    context.fillStyle = `rgba(${weather.color}, ${.07 + light * .45})`;
    context.beginPath();
    context.ellipse(x, y, size * (area === 'harbor' ? 2.3 : 1.15), size, 0, 0, Math.PI * 2);
    context.fill();
    if (i % 5 === 0) {
      context.fillStyle = `rgba(${weather.color}, ${light * .12})`;
      context.beginPath();
      context.arc(x, y, size * 3, 0, Math.PI * 2);
      context.fill();
    }
  }
}

export function BattleScenery({ area = 'harbor', night = false }: { area?: Area; night?: boolean }) {
  const weather = useRef<HTMLCanvasElement>(null);
  const bakedNight = area === 'harbor' && night ? harborNight : undefined;
  useEffect(() => {
    const canvas = weather.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now();
    let onscreen = typeof IntersectionObserver !== 'function';
    let frame = 0;
    let lastDraw = -Infinity;
    const draw = (now: number) => {
      if (now - lastDraw >= 55 || motion.matches) {
        drawAmbience(context, area, motion.matches ? 0 : (now - start) / 1000);
        lastDraw = now;
      }
      if (onscreen && !motion.matches) frame = requestAnimationFrame(draw);
    };
    const resetMotion = () => {
      cancelAnimationFrame(frame);
      draw(performance.now());
    };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      if (onscreen === entry.isIntersecting) return;
      onscreen = entry.isIntersecting;
      resetMotion();
    }) : undefined;
    resetMotion();
    observer?.observe(canvas);
    motion.addEventListener('change', resetMotion);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', resetMotion);
    };
  }, [area]);
  return <div className="battle-scenery" aria-hidden="true" data-baked-night={Boolean(bakedNight) || undefined}>
    <img className="battle-background" src={bakedNight ?? backdrops[area]} alt="" width={1728} height={691} decoding="async" fetchPriority="high" />
    <canvas ref={weather} width={width} height={height} className="battle-atmosphere" />
  </div>;
}
