// Read-only QA surface, attached only by the explicitly selected Vite test mode.
import type { Battle } from "./engine";
import type { Renderer } from "./renderer";
export function attachQA(battle: Battle, renderer: Renderer) {
  const target = window as unknown as { __CRATER_QA__?: () => unknown };
  target.__CRATER_QA__ = () => ({
    phase: battle.phase,
    turn: battle.turn,
    target: battle.target,
    drone: battle.drone
      ? {
          ...battle.drone,
          destination: { ...battle.drone.destination },
          trail: [],
        }
      : null,
    defense: battle.defense ? { ...battle.defense } : null,
    canEmp: battle.canEmp("player"),
    aiMemory: { ...battle.aiMemory },
    visuals: {
      pulses: renderer.pulses.length,
      particles: renderer.particles.length,
      bursts: renderer.bursts.length,
      labels: renderer.labels.length,
      flashes: renderer.flashes.length,
      camera: {
        scale: renderer.camera.scale,
        x: renderer.camera.x,
        y: renderer.camera.y,
      },
    },
    terrain: Array.from(battle.terrain),
    tanks: battle.tanks.map((t) => ({ ...t, ammo: { ...t.ammo } })),
    wind: battle.wind,
    round: battle.round,
    stats: { ...battle.stats },
    result: battle.result ? { ...battle.result } : null,
    revision: battle.terrainRevision,
    projectile: battle.projectile ? { ...battle.projectile, trail: [] } : null,
  });
  return () => {
    delete target.__CRATER_QA__;
  };
}
