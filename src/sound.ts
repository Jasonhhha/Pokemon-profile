import { useCallback, useEffect, useRef, useState } from 'react';
import { createKyuremVoice, preloadKyuremCry } from './kyurem-voice';
import { fortressTiming, type FortressRoom } from './field-fortress-state';

export type SoundScene = 'harbor' | 'grove' | 'summit' | 'interior' | 'fortress' | 'sanctum' | 'wild' | 'trial';
export type Footing = 'stone' | 'timber' | 'grass' | 'earth' | 'tile' | 'wet' | 'ice' | 'iron';
export type SoundCue = 'step' | 'interact' | 'area' | 'encounter' | 'win' | 'hit' | 'heal' | 'capture' | 'miss' | 'faint' | 'switch' | 'escape' | 'hoist' | 'discharge' | 'seal' | 'tideDial' | 'kyuremCry' | 'wardImpact' | 'bridge' | 'iceGate' | 'slackWest' | 'slackEast' | 'wardTension' | 'ratchet';

type Score = {
  bpm: number;
  melody: readonly number[];
  bass: readonly number[];
  harmony: readonly (readonly number[])[];
  voice: OscillatorType;
};

const scores: Record<SoundScene, Score> = {
  harbor: {
    bpm: 104, voice: 'triangle',
    melody: [69, 0, 74, 76, 74, 0, 71, 67, 69, 0, 71, 74, 78, 76, 74, 0, 72, 0, 76, 79, 81, 79, 76, 0, 74, 71, 69, 0, 67, 69, 74, 0],
    bass: [43, 45, 48, 43], harmony: [[55, 59, 62], [57, 60, 64], [60, 64, 67], [55, 62, 69]],
  },
  grove: {
    bpm: 86, voice: 'sine',
    melody: [64, 0, 71, 0, 74, 72, 71, 0, 67, 0, 69, 0, 74, 71, 69, 0, 62, 0, 69, 0, 71, 74, 76, 0, 72, 0, 67, 64, 62, 0, 59, 0],
    bass: [40, 43, 38, 48], harmony: [[52, 55, 59], [55, 60, 62], [50, 57, 62], [48, 52, 59]],
  },
  summit: {
    bpm: 94, voice: 'triangle',
    melody: [71, 0, 78, 0, 83, 81, 78, 0, 74, 0, 81, 0, 85, 83, 81, 0, 76, 78, 79, 0, 86, 0, 83, 81, 78, 0, 74, 0, 76, 74, 71, 0],
    bass: [47, 50, 52, 47], harmony: [[59, 62, 66], [57, 62, 66], [55, 59, 64], [54, 59, 66]],
  },
  sanctum: {
    bpm: 49, voice: 'sine', melody: [0, 0, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0],
    bass: [30, 34, 29, 32], harmony: [[42, 49], [46, 53], [41, 48], [44, 51]],
  },
  fortress: {
    bpm: 58, voice: 'sine',
    melody: [0, 0, 62, 0, 0, 0, 0, 57, 0, 0, 0, 0, 65, 0, 0, 0],
    bass: [31, 26, 29, 33], harmony: [[43, 50], [38, 45], [41, 48], [45, 52]],
  },
  interior: {
    bpm: 82, voice: 'sine',
    melody: [60, 0, 64, 67, 69, 0, 67, 0, 62, 0, 65, 69, 74, 0, 69, 0, 64, 0, 67, 71, 76, 74, 71, 0, 67, 0, 72, 76, 74, 0, 72, 0],
    bass: [48, 50, 52, 48], harmony: [[55, 60, 64], [57, 62, 65], [55, 59, 64], [55, 60, 67]],
  },
  wild: {
    bpm: 144, voice: 'triangle',
    melody: [72, 0, 75, 72, 79, 75, 72, 0, 70, 72, 74, 77, 82, 77, 74, 0, 74, 0, 77, 74, 81, 77, 74, 0, 75, 77, 79, 82, 84, 79, 75, 0],
    bass: [48, 46, 50, 43], harmony: [[55, 60, 63], [53, 58, 62], [57, 62, 65], [55, 58, 62]],
  },
  trial: {
    bpm: 128, voice: 'triangle',
    melody: [74, 81, 79, 74, 77, 0, 72, 74, 70, 77, 75, 70, 74, 0, 72, 0, 69, 76, 75, 69, 79, 81, 84, 82, 81, 79, 77, 76, 74, 72, 69, 0],
    bass: [38, 46, 45, 43], harmony: [[50, 53, 57], [46, 53, 58], [45, 52, 57], [43, 50, 58]],
  },
};

const cues: Record<SoundCue, readonly number[]> = {
  slackWest: [], slackEast: [], wardTension: [], ratchet: [],
  hoist: [26, 33], discharge: [], kyuremCry: [], wardImpact: [31, 50, 62], bridge: [34, 29], iceGate: [57, 45], seal: [38, 45, 50], tideDial: [50, 57, 62],
  step: [40], interact: [74, 81], area: [57, 62, 67], encounter: [76, 83, 72, 78], win: [62, 66, 69, 74],
  hit: [86, 52], heal: [69, 76, 81], capture: [72, 76, 79, 84], miss: [60, 56], faint: [67, 62, 54], switch: [65, 74], escape: [76, 69, 64],
};

function voice(context: AudioContext, destination: AudioNode, note: number, time: number, duration: number, volume: number, type: OscillatorType) {
  if (!note || context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
  envelope.gain.setValueAtTime(.0001, time);
  envelope.gain.exponentialRampToValueAtTime(volume, time + .012);
  envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + duration + .012);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

const footsteps = {
  stone: { frequency: 710, high: 94, resonance: 1.15, length: .13, gain: .30, heel: 49 },
  timber: { frequency: 360, high: 70, resonance: 1.21, length: .14, gain: .28, heel: 42 },
  grass: { frequency: 1890, high: 200, resonance: .88, length: .19, gain: .24, heel: 34 },
  earth: { frequency: 1020, high: 103, resonance: .92, length: .18, gain: .29, heel: 38 },
  ice: { frequency: 1840, high: 365, resonance: 1.8, length: .19, gain: .26, heel: 57 },
  iron: { frequency: 1090, high: 170, resonance: 2.5, length: .17, gain: .22, heel: 53 },
  wet: { frequency: 1650, high: 235, resonance: .81, length: .22, gain: .35, heel: 43 },
  tile: { frequency: 960, high: 150, resonance: 1.65, length: .12, gain: .26, heel: 51 },
};

function noiseSample(context: AudioContext, seconds: number) {
  let state = 471049;
  const buffer = context.createBuffer(1, Math.round(context.sampleRate * seconds), context.sampleRate);
  const track = buffer.getChannelData(0);
  for (let index = 0; index < track.length; index++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    track[index] = (state >>> 0) / 0x80000000 - 1;
  }
  return buffer;
}

function footfall(context: AudioContext, output: AudioNode, buffer: AudioBuffer, surface: Footing, time: number, count: number) {
  const footing = footsteps[surface];
  const variation = (Math.sin(count * 8.3) + 1) * .5;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = .94 + variation * .18;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = footing.frequency * (.88 + variation * .30);
  band.Q.value = footing.resonance;
  const dry = context.createBiquadFilter();
  dry.type = 'highpass';
  dry.frequency.value = footing.high;
  const weight = context.createGain();
  weight.gain.setValueAtTime(.0001, time);
  weight.gain.exponentialRampToValueAtTime(footing.gain, time + .013);
  weight.gain.exponentialRampToValueAtTime(.0001, time + footing.length);
  source.connect(band).connect(dry).connect(weight).connect(output);
  source.start(time, variation * 1.50);
  source.stop(time + footing.length + .015);
  source.onended = () => { source.disconnect(); band.disconnect(); dry.disconnect(); weight.disconnect(); };
  voice(context, output, footing.heel + (count & 1), time, .058, .012, 'sine');
}

function harborAir(context: AudioContext, destination: AudioNode, buffer: AudioBuffer) {
  const air = context.createBufferSource();
  air.buffer = buffer;
  air.loop = true;
  const surf = context.createBiquadFilter();
  surf.type = 'bandpass';
  surf.frequency.value = 324;
  surf.Q.value = .52;
  const mix = context.createGain();
  mix.gain.value = .017;
  const tide = context.createOscillator();
  tide.frequency.value = .207;
  const flow = context.createGain();
  flow.gain.value = .011;
  tide.connect(flow).connect(mix.gain);
  air.connect(surf).connect(mix).connect(destination);
  air.start();
  tide.start();
  return () => {
    air.stop(); tide.stop(); air.disconnect(); surf.disconnect(); mix.disconnect(); tide.disconnect(); flow.disconnect();
  };
}

function spillwaySound(context: AudioContext, output: AudioNode, noise: AudioBuffer, discharge: boolean, time: number) {
  const short = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = short ? .48 : (discharge ? fortressTiming.empty : fortressTiming.rise) / 1000;
  const bus = context.createGain();
  bus.connect(output);
  const sources: AudioBufferSourceNode[] = [];
  // Air and spray reach each bank first. The lower band is the delayed impact at sea level.
  const layers = discharge ? [
    { band: 830, pan: -.66, delay: 0, peak: .17 },
    { band: 1260, pan: .62, delay: .064, peak: .15 },
    { band: 185, pan: .04, delay: .16, peak: .38 },
  ] : [
    { band: 112, pan: -.10, delay: 0, peak: .23 },
    { band: 345, pan: .27, delay: .26, peak: .075 },
  ];
  for (const [index, layer] of layers.entries()) {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.playbackRate.value = .78 + index * .17;
    const start = time + duration * layer.delay;
    const end = time + duration;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = .69;
    filter.frequency.setValueAtTime(layer.band * .64, start);
    filter.frequency.exponentialRampToValueAtTime(layer.band * 1.22, start + (end - start) * .28);
    filter.frequency.exponentialRampToValueAtTime(layer.band * .73, end);
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(layer.peak, start + (end - start) * .17);
    gain.gain.exponentialRampToValueAtTime(layer.peak * .8, start + (end - start) * .61);
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    const pan = context.createStereoPanner();
    pan.pan.value = layer.pan;
    source.connect(filter).connect(gain).connect(pan).connect(bus);
    source.start(start, index * .63);
    source.stop(end);
    sources.push(source);
    source.onended = () => {
      source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect();
      sources.splice(sources.indexOf(source), 1);
      if (!sources.length) bus.disconnect();
    };
  }
  return () => {
    for (const source of sources) source.stop();
  };
}

function chamberAcoustics(context: AudioContext, output: AudioNode, room: FortressRoom) {
  const input = context.createGain();
  input.connect(output);
  const lengths = room === 'seal' ? [.11, .235] : room === 'catacomb' ? [.085, .157] : [.057, .122];
  const echoes = lengths.map((length, index) => {
    const delay = context.createDelay(.5);
    delay.delayTime.value = length;
    const damp = context.createBiquadFilter();
    damp.type = 'lowpass'; damp.frequency.value = room === 'aqueduct' ? 1700 : 2700;
    const gain = context.createGain(); gain.gain.value = index === 0 ? .13 : .063;
    const pan = context.createStereoPanner(); pan.pan.value = index === 0 ? -.43 : .37;
    input.connect(delay).connect(damp).connect(gain).connect(pan).connect(output);
    return [delay, damp, gain, pan];
  });
  return { input, dispose() { input.disconnect(); for (const line of echoes) for (const node of line) node.disconnect(); } };
}

export function useSound(scene: SoundScene, room?: FortressRoom) {
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<{ context: AudioContext; output: DynamicsCompressorNode; noise: AudioBuffer; kyurem: ReturnType<typeof createKyuremVoice> } | null>(null);
  const foot = useRef(0);
  const stopFortressSound = useRef<(() => void) | undefined>(undefined);
  const muted = useRef(true);

  const previewTimer = useRef<number | undefined>(undefined);
  const previewKind = useRef<'cry' | 'chains'>('cry');
  const previewRequest = useRef(0);
  const chamber = useRef<ReturnType<typeof chamberAcoustics> | undefined>(undefined);

  const getAudio = useCallback(() => {
    if (!window.AudioContext) return;
    if (!audio.current) {
      const context = new AudioContext();
      const output = context.createDynamicsCompressor();
      output.threshold.value = -18;
      output.ratio.value = 3;
      output.connect(context.destination);
      audio.current = { context, output, noise: noiseSample(context, 2.7), kyurem: createKyuremVoice(context, output) };
    }
    return audio.current;
  }, []);

  const stopCry = useCallback(() => {
    ++previewRequest.current;
    window.clearTimeout(previewTimer.current);
    previewTimer.current = undefined;
    audio.current?.kyurem.stop();
    if (muted.current && audio.current?.context.state === 'running') void audio.current.context.suspend().catch(() => {});
  }, []);

  const prepareCry = useCallback(async () => {
    const request = ++previewRequest.current;
    const engine = getAudio();
    if (!engine) return 'unavailable';
    try {
      await Promise.all([engine.context.resume(), engine.kyurem.warm()]);
    } catch {
      if (request !== previewRequest.current) return 'cancelled';
      stopCry();
      return 'unavailable';
    }
    return request === previewRequest.current ? 'ready' : 'cancelled';
  }, [getAudio, stopCry]);

  const audition = useCallback((kind: 'cry' | 'chains' = 'cry') => {
    const engine = getAudio();
    if (!engine) return;
    void engine.context.resume().catch(() => {});
    if (!muted.current) return;
    previewKind.current = kind;
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(stopCry, 3100);
  }, [getAudio, stopCry]);

  const toggle = useCallback(() => {
    const engine = getAudio();
    if (!engine) return;
    muted.current = !muted.current;
    setEnabled(!muted.current);
    if (!muted.current) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = undefined;
      void engine.context.resume().catch(() => {});
    } else {
      stopFortressSound.current?.();
      stopCry();
    }
  }, [getAudio, stopCry]);

  useEffect(() => {
    if (room === 'seal') void preloadKyuremCry().catch(() => {});
    if (!enabled || !room || !audio.current) return;
    const acoustics = chamberAcoustics(audio.current.context, audio.current.output, room);
    chamber.current = acoustics;
    return () => { acoustics.dispose(); chamber.current = undefined; };
  }, [room, enabled]);

  useEffect(() => {
    if (!enabled || !audio.current) return;
    const { context, output, noise } = audio.current;
    if (scene === 'sanctum') void audio.current.kyurem.warm().catch(() => {});
    const score = scores[scene];
    const bus = context.createGain();
    const pulse = 30 / score.bpm;
    const combat = scene === 'wild' || scene === 'trial';
    let beat = 0;
    let next = context.currentTime + .045;
    bus.gain.setValueAtTime(.0001, context.currentTime);
    bus.gain.linearRampToValueAtTime(.78, context.currentTime + .2);
    bus.connect(output);
    const stopAir = scene === 'harbor' ? harborAir(context, bus, noise) : undefined;

    function schedule() {
      if (context.state !== 'running' || document.hidden) return;
      if (next < context.currentTime) next = context.currentTime + .022;
      while (next < context.currentTime + .14) {
        const measure = Math.floor(beat / 8) % score.bass.length;
        const accent = beat % 8;
        const note = score.melody[beat % score.melody.length];
        voice(context, bus, note, next, pulse * 1.26, combat ? .052 : .046, score.voice);
        if (accent === 0 || (combat && accent === 4)) voice(context, bus, score.bass[measure], next, pulse * (combat ? 2 : 3.8), .082, 'sine');
        if (accent === 0 || accent === 4) {
          for (const chord of score.harmony[measure]) voice(context, bus, chord, next + .016, pulse * 3.2, .022, 'triangle');
        }
        if (combat && (accent === 2 || accent === 6)) voice(context, bus, 29, next, .08, .028, 'square');
        next += pulse;
        beat++;
      }
    }

    schedule();
    const interval = window.setInterval(schedule, 50);
    return () => {
      window.clearInterval(interval);
      bus.gain.cancelScheduledValues(context.currentTime);
      bus.gain.setTargetAtTime(.0001, context.currentTime, .07);
      window.setTimeout(() => { stopAir?.(); bus.disconnect(); }, 350);
    };
  }, [enabled, scene]);

  useEffect(() => {
    function visibility() {
      if (!audio.current) return;
      const { context } = audio.current;
      if (document.hidden) { stopFortressSound.current?.(); stopCry(); }
      if (muted.current) return;
      void (document.hidden ? context.suspend() : context.resume()).catch(() => {});
    }
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.clearTimeout(previewTimer.current);
      void audio.current?.context.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  const play = useCallback((cue: SoundCue, surface: Footing = 'stone') => {
    const preview = previewTimer.current !== undefined && (cue === 'wardImpact' ||
      (previewKind.current === 'cry' ? cue === 'kyuremCry' : cue === 'slackEast' || cue === 'slackWest' || cue === 'wardTension'));
    if ((muted.current && !preview) || !audio.current || document.hidden) return;
    const { context, output, noise } = audio.current;
    if (context.state !== 'running') return;
    const time = context.currentTime + .005;
    if (cue === 'kyuremCry') {
      void audio.current.kyurem.play();
      return;
    }
    const roomOutput = chamber.current?.input ?? output;
    if (cue === 'slackWest' || cue === 'slackEast') {
      const pan = context.createStereoPanner();
      pan.pan.value = cue === 'slackWest' ? -.76 : .76;
      pan.connect(roomOutput);
      voice(context, pan, 78, time, .14, .072, 'triangle');
      voice(context, pan, 59, time + .23, .29, .10, 'triangle');
      voice(context, pan, 86, time + .23, .34, .027, 'sine');
      window.setTimeout(() => pan.disconnect(), 900);
      return;
    }
    if (cue === 'wardTension' || cue === 'ratchet') {
      if (cue === 'ratchet') {
        for (const delay of [0, .11, .21, .29]) footfall(context, roomOutput, noise, 'iron', time + delay, 1);
      }
      voice(context, roomOutput, cue === 'ratchet' ? 48 : 75, time + (cue === 'ratchet' ? .37 : 0), .24, .066, 'triangle');
      return;
    }
    if (cue === 'wardImpact') {
      voice(context, roomOutput, 32, time, .50, .12, 'sine');
      voice(context, output, 67, time + .045, .41, .038, 'triangle');
      voice(context, output, 74, time + .19, .56, .02, 'sine');
      return;
    }
    if (cue === 'bridge' || cue === 'iceGate') {
      const surface = cue === 'bridge' ? 'timber' : 'iron';
      for (let i = 0; i < 4; i++) {
        footfall(context, roomOutput, noise, surface, time + .065 * i, i);
      }
    }
    if (cue === 'step') {
      footfall(context, roomOutput, noise, surface, time, foot.current++);
      return;
    }
    if (cue === 'hoist' || cue === 'discharge') {
      stopFortressSound.current?.();
      stopFortressSound.current = spillwaySound(context, output, noise, cue === 'discharge', time);
    }
    if (cue === 'seal' || cue === 'tideDial') {
      cues[cue].forEach((note, i) => {
        voice(context, output, note, time + .22 * i, 1.6, .063, 'sine');
        if (cue === 'tideDial') voice(context, output, note + 12, time + .38 + i * .22, 1.05, .019, 'triangle');
      });
      return;
    }
    cues[cue].forEach((note, i) => voice(context, output, note, time + i * .08, .18, .057, cue === 'hit' ? 'square' : 'triangle'));
  }, []);

  return { enabled, toggle, play, stopCry, prepareCry, audition };
}
