let recording: Promise<ArrayBuffer> | undefined;
export function preloadKyuremCry() {
  return recording ??= fetch(import.meta.env.BASE_URL + 'assets/kyurem-cry.ogg').then(response => {
    if (!response.ok) throw Error('Failed to load Kyurem cry');
    return response.arrayBuffer();
  }).catch(error => { recording = undefined; throw error; });
}

// Each call uses the original short cry. Two quieter, filtered reflections place it in the stone chamber.
export function createKyuremVoice(context: AudioContext, output: AudioNode) {
  let sample: Promise<AudioBuffer> | undefined;
  let generation = 0;
  let active: AudioBufferSourceNode[] = [];
  const stop = () => {
    ++generation;
    for (const source of active) source.stop();
    active = [];
  };
  function warm() {
    return sample ??= preloadKyuremCry().then(bytes => context.decodeAudioData(bytes.slice(0)))
      .catch(error => { sample = undefined; throw error; });
  }
  async function play() {
    stop();
    const at = context.currentTime, token = generation;
    let buffer: AudioBuffer;
    try { buffer = await warm(); } catch { return; }
    if (token !== generation || context.state !== 'running') return;
    for (const [delay, amplitude, cutoff] of [[0, .46, 6400], [.13, .105, 2600], [.31, .055, 1400]]) {
      const offset = Math.max(0, context.currentTime - (at + delay));
      if (offset >= buffer.duration) continue;
      const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
      source.buffer = buffer;
      gain.gain.value = amplitude;
      filter.type = 'lowpass'; filter.frequency.value = cutoff;
      source.connect(filter).connect(gain).connect(output);
      active.push(source);
      source.onended = () => {
        source.disconnect(); filter.disconnect(); gain.disconnect();
        active = active.filter(item => item !== source);
      };
      source.start(Math.max(context.currentTime, at + delay), offset);
    }
  }
  return { warm, play, stop };
}
