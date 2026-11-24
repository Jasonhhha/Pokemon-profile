import type { GridReading } from './fortress-power';

export function createGridHum(context: AudioContext, output: AudioNode, chamber: boolean) {
  const core = context.createOscillator(), winding = context.createOscillator();
  const fundamental = context.createGain(), overtone = context.createGain(), pan = context.createStereoPanner();
  core.type = 'sine'; winding.type = 'triangle';
  const now = context.currentTime;
  fundamental.gain.setValueAtTime(.0001, now); overtone.gain.setValueAtTime(.0001, now);
  pan.pan.value = chamber ? -.28 : .24;
  core.connect(fundamental).connect(output);
  winding.connect(overtone).connect(pan).connect(output);
  core.start(); winding.start();
  let previous = -1, previousBus = -1;
  return {
    update(power: GridReading) {
      const level = chamber ? power.source : power.city;
      const line = chamber ? power.bus : power.city;
      if (Math.abs(level - previous) < .009 && Math.abs(line - previousBus) < .009) return;
      previous = level; previousBus = line;
      const at = context.currentTime;
      core.frequency.setTargetAtTime(45 + level * 22, at, .14);
      winding.frequency.setTargetAtTime(112 + line * 29, at, .18);
      fundamental.gain.setTargetAtTime(level * (chamber ? .062 : .018), at, .15);
      overtone.gain.setTargetAtTime(level * (chamber ? .024 : .006), at, .21);
    },
    dispose() {
      core.stop(); winding.stop();
      core.disconnect(); winding.disconnect(); fundamental.disconnect(); overtone.disconnect(); pan.disconnect();
    },
  };
}
