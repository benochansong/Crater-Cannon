import type { Drone, GameEvent, Projectile } from "./engine";
export class Sound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private flying: {
    source: OscillatorNode;
    gain: GainNode;
    pan: StereoPannerNode;
  } | null = null;
  private engineLoop: {
    source: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null = null;
  volume = 0.55;
  muted = false;
  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
      this.configure(this.volume, this.muted);
    } catch {
      /* Sound is optional. */
    }
  }
  configure(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        muted ? 0 : volume * 0.45,
        this.context.currentTime,
        0.02,
      );
  }
  private tone(
    freq: number,
    end: number,
    duration: number,
    type: OscillatorType = "sine",
    delay = 0,
    strength = 0.5,
  ) {
    if (!this.context || !this.master) return;
    const c = this.context,
      osc = c.createOscillator(),
      gain = c.createGain(),
      t = c.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + duration);
    gain.gain.setValueAtTime(strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    this.active.add(osc);
    osc.onended = () => {
      this.active.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
  private noise(duration: number, cutoff: number, strength: number) {
    if (!this.context || !this.master) return;
    const c = this.context,
      buffer = c.createBuffer(
        1,
        Math.ceil(c.sampleRate * duration),
        c.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.value = strength;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  event(e: GameEvent) {
    try {
      if (e.type === "repair") {
        this.tone(440, 880, 0.3, "sine", 0, 0.15);
        this.tone(660, 990, 0.3, "sine", 0.5, 0.15);
        this.noise(0.7, 1800, 0.1);
      }
      if (e.type === "shield") {
        this.tone(160, 800, 0.6, "sine", 0, 0.3);
        this.tone(400, 1000, 0.4, "triangle", 0.2, 0.15);
      }
      if (e.type === "block") {
        this.tone(1000, 200, 0.2, "triangle", 0, 0.35);
        this.noise(0.2, 2800, 0.2);
      }
      if (e.type === "shield-end") this.tone(600, 100, 0.35, "sine", 0, 0.1);
      if (e.type === "move") this.noise(0.8, 380, 0.15);
      if (e.type === "air-call") {
        this.tone(650, 650, 0.1, "sine", 0, 0.2);
        this.tone(850, 850, 0.15, "sine", 0.15, 0.2);
      }
      if (e.type === "air-enter") {
        if (e.airKind === "artillery") {
          this.tone(90, 25, 0.5, "triangle", 0, 0.3);
          this.noise(0.4, 900, 0.25);
        } else if (e.airKind === "propeller") {
          for (let i = 0; i < 18; i++)
            this.tone(95, 70, 0.15, "sawtooth", i * 0.2, 0.08);
        } else if (e.airKind === "helicopter")
          for (let i = 0; i < 22; i++)
            this.tone(65, 42, 0.12, "triangle", i * 0.18, 0.18);
        else {
          this.noise(2.5, 450, 0.3);
          this.tone(70, 40, 3, "sawtooth", 0, 0.12);
        }
      }
      if (e.type === "emp") {
        this.noise(0.35, 3500, 0.35);
        this.tone(1100, 120, 0.45, "sine", 0, 0.4);
        this.tone(220, 880, 0.2, "triangle", 0.15, 0.15);
      }
      if (e.type === "threat") {
        this.tone(700, 700, 0.12, "triangle", 0, 0.25);
        this.tone(950, 950, 0.12, "triangle", 0.2, 0.25);
      }
      if (e.type === "disabled") this.tone(380, 45, 0.4, "sawtooth", 0, 0.12);
      if (e.type === "shot" && e.weapon === "drone")
        this.tone(70, 150, 0.5, "triangle", 0, 0.2);
      if (e.type === "shot" && e.weapon !== "drone") {
        this.noise(0.16, 2400, 0.75);
        this.tone(190, 38, 0.23, "triangle", 0, 0.7);
        this.tone(70, 30, 0.25, "sine", 0, 0.8);
      }
      if (e.type === "explosion") {
        if (e.weapon === "shock") {
          this.tone(220, 35, 0.55, "sine", 0, 0.9);
          this.tone(900, 120, 0.35, "triangle", 0, 0.25);
          this.noise(0.25, 3500, 0.3);
        } else if (e.weapon === "crater") {
          this.noise(1.05, 650, 0.95);
          this.noise(0.35, 2400, 0.3);
          this.tone(65, 22, 0.7, "sine", 0, 0.9);
        } else {
          this.noise(0.65, 1400, 0.9);
          this.tone(110, 25, 0.48, "sine", 0, 0.9);
          this.tone(48, 24, 0.8, "triangle", 0.07, 0.3);
        }
      }
      if (e.type === "damage") {
        this.tone(150, 70, 0.1, "square", 0, 0.15);
        if (e.direct) {
          this.tone(660, 440, 0.16, "triangle");
          this.tone(880, 880, 0.22, "sine", 0.1);
        }
      }
      if (e.type === "wind") this.tone(440, 600, 0.12, "sine", 0, 0.1);
      if (e.type === "end") {
        const notes =
          e.outcome === "victory" ? [392, 523, 659, 784] : [330, 294, 247, 165];
        notes.forEach((n, i) => this.tone(n, n, 0.4, "triangle", i * 0.12));
      }
    } catch {
      /* Browser audio failures never interrupt a match. */
    }
  }
  flight(projectile: Projectile | Drone | null) {
    try {
      if (!projectile || !this.context || !this.master) {
        if (this.flying) {
          this.flying.source.stop();
          this.flying.source.disconnect();
          this.flying.gain.disconnect();
          this.flying.pan.disconnect();
          this.flying = null;
        }
        return;
      }
      if (!this.flying) {
        const source = this.context.createOscillator(),
          gain = this.context.createGain(),
          pan = this.context.createStereoPanner();
        source.type = "sine";
        gain.gain.value = 0.035;
        source.connect(gain);
        gain.connect(pan);
        pan.connect(this.master);
        source.start();
        this.flying = { source, gain, pan };
      }
      const isDrone = !("weapon" in projectile);
      this.flying.source.type = isDrone ? "triangle" : "sine";
      this.flying.source.frequency.setTargetAtTime(
        isDrone
          ? 95 + Math.hypot(projectile.vx, projectile.vy) * 0.2
          : 260 +
              Math.min(500, Math.hypot(projectile.vx, projectile.vy) * 0.65),
        this.context.currentTime,
        0.08,
      );
      this.flying.pan.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, (projectile.x / 1280 - 0.5) * 1.5)),
        this.context.currentTime,
        0.08,
      );
    } catch {
      /* Optional flight audio may fail on restricted browsers. */
    }
  }

  drive(speed: number, era: "ww2" | "modern") {
    try {
      if (!this.context || !this.master) return;
      if (speed <= 0 || this.muted) {
        if (this.engineLoop) {
          const { source, gain, filter } = this.engineLoop;
          source.stop();
          source.disconnect();
          gain.disconnect();
          filter.disconnect();
          this.engineLoop = null;
          if (!this.muted) this.tone(55, 25, 0.12, "triangle", 0, 0.07);
        }
        return;
      }
      const c = this.context;
      if (!this.engineLoop) {
        const source = c.createOscillator(),
          gain = c.createGain(),
          filter = c.createBiquadFilter();
        source.type = "sawtooth";
        filter.type = "lowpass";
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start();
        this.engineLoop = { source, gain, filter };
        this.tone(25, 55, 0.1, "triangle", 0, 0.05);
      }
      const loop = this.engineLoop;
      loop.source.frequency.setTargetAtTime(
        (era === "ww2" ? 30 : 44) + speed * 0.55,
        c.currentTime,
        0.07,
      );
      loop.filter.frequency.setTargetAtTime(
        era === "ww2" ? 170 : 230,
        c.currentTime,
        0.08,
      );
      loop.gain.gain.setTargetAtTime(
        0.07 + Math.min(speed, 95) * 0.001,
        c.currentTime,
        0.04,
      );
    } catch {
      /* Optional engine audio. */
    }
  }
  stop() {
    this.drive(0, "modern");
    this.flight(null);
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.active.clear();
  }
  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.master = null;
  }
}
