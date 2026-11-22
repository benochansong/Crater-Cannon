export const REPAIR_AMOUNT = 20;
export const REPAIR_TIME = 1.6;
export const SHIELD_FACTOR = 0.5;
export function repairAmount(hp: number) {
  return Math.max(0, Math.min(REPAIR_AMOUNT, 100 - hp));
}
// Round the aggregate, not each pellet: a shield treats a multi-hit operation consistently.
export function shieldDamage(raw: number, already: number, enabled: boolean) {
  const amount = enabled
    ? Math.ceil((already + raw) * SHIELD_FACTOR) -
      Math.ceil(already * SHIELD_FACTOR)
    : raw;
  return { amount, absorbed: raw - amount, total: already + raw };
}
