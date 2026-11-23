import { afterEach, expect, it, vi } from "vitest";
import { Sound } from "./audio";
afterEach(() => vi.unstubAllGlobals());
it("reuses one engine loop, stops on mute/pause, and releases audio nodes", () => {
  const oscillators: {
    type: string;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const signal = () => ({
    value: 0,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  class Context {
    currentTime = 0;
    destination = {};
    resume = () => Promise.resolve();
    close = () => Promise.resolve();
    createOscillator() {
      const node = {
        type: "sine",
        frequency: signal(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(node);
      return node;
    }
    createGain() {
      return { gain: signal(), connect: vi.fn(), disconnect: vi.fn() };
    }
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: signal(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const sound = new Sound();
  sound.unlock();
  for (let i = 1; i <= 100; i++) sound.drive((i % 50) + 1, "modern");
  const engines = () => oscillators.filter((o) => o.type === "sawtooth");
  expect(engines()).toHaveLength(1);
  expect(engines()[0].stop).not.toHaveBeenCalled();
  sound.drive(0, "modern");
  expect(engines()[0].stop).toHaveBeenCalledTimes(1);
  expect(engines()[0].disconnect).toHaveBeenCalledTimes(1);
  sound.drive(30, "ww2");
  expect(engines()).toHaveLength(2);
  sound.configure(0.5, true);
  sound.drive(30, "ww2");
  expect(engines()[1].stop).toHaveBeenCalledTimes(1);
  sound.drive(30, "ww2");
  expect(engines()).toHaveLength(2);
  sound.configure(0.5, false);
  sound.drive(30, "modern");
  sound.stop();
  expect(engines()[2].stop).toHaveBeenCalledTimes(1);
  sound.dispose();
});
