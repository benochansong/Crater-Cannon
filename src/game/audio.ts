import type { GameEvent } from './engine';
export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  volume = 0.55;
  muted = false;
  unlock() {
    try { if (!this.context) { this.context = new AudioContext(); this.master = this.context.createGain(); this.master.connect(this.context.destination); } void this.context.resume().catch(() => {}); this.configure(this.volume, this.muted); } catch { /* Sound is optional. */ }
  }
  configure(volume: number, muted: boolean) { this.volume = volume; this.muted = muted; if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : volume * 0.45, this.context.currentTime, 0.02); }
  private tone(freq: number, end: number, duration: number, type: OscillatorType = 'sine', delay = 0, strength = 0.5) {
    if (!this.context || !this.master) return;
    const c = this.context, osc = c.createOscillator(), gain = c.createGain(), t = c.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + duration);
    gain.gain.setValueAtTime(strength, t); gain.gain.exponentialRampToValueAtTime(0.001, t + duration); osc.connect(gain); gain.connect(this.master);
    this.active.add(osc); osc.onended = () => { this.active.delete(osc); osc.disconnect(); gain.disconnect(); }; osc.start(t); osc.stop(t + duration + 0.02);
  }
  private noise(duration: number, cutoff: number, strength: number) {
    if (!this.context || !this.master) return;
    const c = this.context, buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(); source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff; gain.gain.value = strength;
    source.connect(filter); filter.connect(gain); gain.connect(this.master); this.active.add(source);
    source.onended = () => { this.active.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); }; source.start();
  }
  event(e: GameEvent) {
    try {
      if (e.type === 'shot') { this.noise(0.22, 1800, 0.8); this.tone(160, 45, 0.23, 'triangle'); this.tone(800, 260, 0.65, 'sine', 0.1, 0.07); }
      if (e.type === 'explosion') { this.noise(0.65, 900, 0.9); this.tone(90, 25, 0.5, 'sine', 0, 0.9); }
      if (e.type === 'damage') { this.tone(150, 70, 0.1, 'square', 0, 0.15); if (e.direct) { this.tone(660, 440, 0.16, 'triangle'); this.tone(880, 880, 0.22, 'sine', 0.1); } }
      if (e.type === 'wind') this.tone(440, 600, 0.12, 'sine', 0, 0.1);
      if (e.type === 'end') { const notes = e.outcome === 'victory' ? [392, 523, 659, 784] : [330, 294, 247, 165]; notes.forEach((n, i) => this.tone(n, n, 0.4, 'triangle', i * 0.12)); }
    } catch { /* Browser audio failures never interrupt a match. */ }
  }
  stop() { for (const source of this.active) { try { source.stop(); } catch { /* Already ended. */ } } this.active.clear(); }
  dispose() { this.stop(); void this.context?.close().catch(() => {}); this.context = null; this.master = null; }
}
