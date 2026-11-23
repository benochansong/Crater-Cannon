// Read-only QA surface, attached only by the explicitly selected Vite test mode.
import { guideLevel, visibleGuide } from "./aimPrediction";
import type { Battle } from "./engine";
import type { Renderer } from "./renderer";
export function attachQA(battle: Battle, renderer: Renderer) {
  const target = window as unknown as { __CRATER_QA__?: () => unknown };
  target.__CRATER_QA__ = () => ({
    config: structuredClone(battle.config),
    placement: battle.placement,
    aiming: {
      level: renderer.aimGuide,
      guideLevel: guideLevel(battle, renderer.aimGuide),
      visible:
        battle.phase === "aim" && renderer.prediction.value
          ? visibleGuide(
              renderer.prediction.value,
              guideLevel(battle, renderer.aimGuide),
            )
          : [],
      endpointVisible:
        battle.phase === "aim" &&
        !renderer.prediction.value?.impact?.escaped &&
        guideLevel(battle, renderer.aimGuide) === "full" &&
        !!renderer.prediction.value?.impact &&
        !renderer.prediction.value.uncertain &&
        !renderer.prediction.value.special,
      historyMarkers: Math.min(1, battle.shotHistory.length),
      prediction: structuredClone(renderer.prediction.value),
      calculations: renderer.prediction.calculations,
    },
    history: structuredClone(battle.shotHistory),
    specialHistory: structuredClone(battle.specialHistory),
    training: structuredClone(battle.trainingStats),
    trainingLesson: battle.trainingLesson,
    assisted: battle.assisted,
    convoy: battle.convoy ? { ...battle.convoy } : null,
    boss: battle.boss ? structuredClone(battle.boss) : null,
    scene: battle.scene ? { ...battle.scene } : null,
    operation: battle.operationRecord,
    convoyCovered: battle.convoyCovered,
    canProtectConvoy: battle.canProtectConvoy(),
    facility: battle.facility ? { ...battle.facility } : null,
    objective: battle.objectiveRecord,
    completedRounds: battle.completedRounds,
    aiAttackTarget: battle.aiAttackTarget,
    selectedTarget: battle.selectedTarget,
    canReinforce: battle.canReinforce(),
    breachProgress: battle.breachProgress,
    fortified: battle.fortified,
    guardTime: battle.guardTime,
    canShield: battle.canShield(),
    phase: battle.phase,
    turn: battle.turn,
    action: battle.action ? { ...battle.action } : null,
    pendingAir: battle.pendingAir ? { ...battle.pendingAir } : null,
    air: battle.air
      ? { ...battle.air, impacts: battle.air.impacts.map((p) => ({ ...p })) }
      : null,
    airSelection: battle.airSelection,
    airTarget: battle.airTarget,
    actions: structuredClone(battle.actionCounts),
    supportStats: structuredClone(battle.supportStats),
    target: battle.target,
    drone: battle.drone
      ? {
          ...battle.drone,
          destination: { ...battle.drone.destination },
          trail: [],
        }
      : null,
    defense: battle.defense ? { ...battle.defense } : null,
    canRepair: battle.canRepair(),
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
    tanks: battle.tanks.map((t) => ({
      ...t,
      ammo: { ...t.ammo },
      support: { ...t.support },
    })),
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
