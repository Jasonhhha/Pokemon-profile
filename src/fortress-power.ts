// The seal, the rising mains and the city draw from the same generator.
export type GridReading = { source: number; bus: number; city: number; phase: number; surge: number; limited: boolean };
export const powerTint = '#89e6db';
const normal = [.82, .78, .73] as const;
const standby = [.23, .17, .13] as const;
const delays = [0, 340, 850] as const;
const rampDuration = 760;
export const nominalPower: GridReading = {
  source: normal[0], bus: normal[1], city: normal[2], phase: .45, surge: 0, limited: false,
};
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

// The inspection glass around the viaduct carries the arriving surface phase clockwise.
export function railFeed(phase: number, fraction: number, supply: number, steady: boolean) {
  const wave = steady ? .55 : ((1 + Math.cos(2 * Math.PI * (phase - delays[2] / 2600 - fraction))) * .5) ** 4;
  return Math.min(1, supply * (.58 + .74 * wave));
}

export function createFortressGrid(initiallyLimited = false) {
  let limited = initiallyLimited;
  const initial = limited ? 0 : 1;
  const switches: { at: number; from: number; to: number }[] = [];
  const roars: number[] = [];

  function output(at: number) {
    for (let index = switches.length - 1; index >= 0; index--) {
      const change = switches[index];
      if (at >= change.at) {
        const progress = smooth(clamp((at - change.at) / rampDuration));
        return change.from + (change.to - change.from) * progress;
      }
    }
    return initial;
  }

  function sample(now: number, stage: number, phase: number, reduced: boolean) {
    const at = now - delays[stage];
    const regulation = output(at);
    const base = standby[stage] + (normal[stage] - standby[stage]) * regulation;
    let surge = 0;
    for (const onset of roars) {
      const age = (at - onset - 460) / 1000;
      if (age >= 0) surge = Math.max(surge, (1 - Math.exp(-age * 9)) * Math.exp(-age * .87));
    }
    const ripple = reduced ? 0 : .06 * Math.cos(2 * Math.PI * (phase - delays[stage] / 2600));
    return { value: clamp(base * (1 + ripple) + surge * (.075 + .265 * regulation)), surge };
  }

  return {
    read(now: number, reduced = false): GridReading {
      const phase = reduced ? .45 : (Math.max(0, now) / 2600) % 1;
      const source = sample(now, 0, phase, reduced);
      return { source: source.value, bus: sample(now, 1, phase, reduced).value, city: sample(now, 2, phase, reduced).value,
        phase, surge: source.surge, limited };
    },
    toggle(now: number) {
      const from = output(now);
      limited = !limited;
      // A short interruption still travels to the city after the operator has restored the source.
      while (switches.length > 1 && switches[1].at <= now - delays[2]) switches.shift();
      switches.push({ at: now, from, to: limited ? 0 : 1 });
      return limited;
    },
    roar(now: number) {
      while (roars.length && roars[0] < now - 12000) roars.shift();
      roars.push(now);
    },
  };
}
