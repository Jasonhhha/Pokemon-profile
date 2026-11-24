import type { CreatureId } from './creatures';

export function createBattleVoice(context: AudioContext, output: AudioNode) {
  const samples = new Map<CreatureId, Promise<AudioBuffer>>();
  let generation = 0;
  let active: { source: AudioBufferSourceNode; gain: GainNode } | undefined;

  function stop() {
    ++generation;
    if (!active) return;
    const now = context.currentTime;
    active.gain.gain.setTargetAtTime(0, now, .008);
    active.source.stop(now + .035);
    active = undefined;
  }

  function sample(id: CreatureId) {
    const cached = samples.get(id);
    if (cached) return cached;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const loading = fetch(`${import.meta.env.BASE_URL}assets/battle/${id}-cry.wav`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw Error('Failed to load the battle cry');
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .catch(error => { samples.delete(id); throw error; })
      .finally(() => window.clearTimeout(timeout));
    samples.set(id, loading);
    return loading;
  }

  function play(id: CreatureId) {
    stop();
    const request = generation;
    const start = performance.now();
    void sample(id).then(buffer => {
      // A late download can warm the cache for the next encounter. Its entrance has already passed.
      if (generation !== request || context.state !== 'running' || document.hidden || performance.now() - start > 400) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = .21;
      source.connect(gain).connect(output);
      active = { source, gain };
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (active?.source === source) active = undefined;
      };
      source.start();
    }).catch(() => {});
    return () => { if (generation === request) stop(); };
  }
  return { play, stop };
}
