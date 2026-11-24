import type { FortressInteriorFrame } from './field-fortress-state';
import { mazeFloors } from './fortress-maze';
import { createSoleContact } from './fortress-wet-ground';
export const frostParticleLimit = 18;

type FrostParticle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; at: number; mist: boolean };
export function createFrostCloud() {
  const particles: FrostParticle[] = [],
    contact = createSoleContact();
  let lastTime = -Infinity,
    next = 0;
  return {
    particles,
    advance(frame: FortressInteriorFrame) {
      const now = frame.now * 0.001,
        cut = now < lastTime || now - lastTime > 0.35 || frame.reduced;
      lastTime = now;
      const before = particles.length;
      if (cut) particles.length = 0;
      else
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (now - p.at > (p.mist ? 0.68 : 0.34)) particles.splice(i, 1);
        }
      const sole = contact(frame, cut);
      if (!sole || mazeFloors.catacomb.tiles[Math.floor(sole.z)]?.[Math.floor(sole.x)] !== 'ice')
        return particles.length !== before;
      for (let j = 0; j < 3; j++) {
        const id = next++;
        const mist = j === 0,
          angle = sole.bearing + (j - 1) * 0.58 + 0.19 * Math.sin(id * 7.9),
          speed = mist ? 0.25 : 0.42 + 0.13 * Math.sin(id);
        if (particles.length === frostParticleLimit) particles.shift();
        particles.push({
          x: sole.x,
          y: mist ? 0.094 : 0.043,
          z: sole.z,
          at: now,
          mist,
          vx: -speed * Math.sin(angle),
          vy: mist ? 0.053 : 0.48 + 0.11 * Math.sin(id * 4.6),
          vz: speed * Math.cos(angle),
        });
      }
      return true;
    },
  };
}
