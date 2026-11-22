// Read-only QA surface, attached only by the explicitly selected Vite test mode.
import type { Battle } from './engine';
export function attachQA(battle: Battle) {
  const target = window as unknown as { __CRATER_QA__?: () => unknown };
  target.__CRATER_QA__ = () => ({ phase: battle.phase, terrain: Array.from(battle.terrain), tanks: battle.tanks.map(t => ({ ...t, ammo: { ...t.ammo } })), wind: battle.wind, round: battle.round, stats: { ...battle.stats }, result: battle.result, revision: battle.terrainRevision, projectile: battle.projectile ? { ...battle.projectile, trail: [] } : null });
  return () => { delete target.__CRATER_QA__; };
}
