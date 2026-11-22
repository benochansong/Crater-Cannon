import type { BattleResult, Difficulty } from './engine';
export interface Settings { volume: number; muted: boolean; shake: boolean; difficulty: Difficulty }
export const defaults: Settings = { volume: 0.55, muted: false, shake: true, difficulty: 'normal' };
export function loadSettings(): Settings {
  try { const v = JSON.parse(localStorage.getItem('crater.settings') || '{}'); return { volume: typeof v.volume === 'number' && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : defaults.volume, muted: typeof v.muted === 'boolean' ? v.muted : false, shake: typeof v.shake === 'boolean' ? v.shake : true, difficulty: ['easy', 'normal', 'hard'].includes(v.difficulty) ? v.difficulty : 'normal' }; } catch { return { ...defaults }; }
}
export function saveSettings(settings: Settings) { try { localStorage.setItem('crater.settings', JSON.stringify(settings)); } catch { /* Storage is optional. */ } }
export function loadRecords(): BattleResult[] {
  try { const data: unknown = JSON.parse(localStorage.getItem('crater.records') || '[]'); if (!Array.isArray(data)) return []; return data.filter((r): r is BattleResult => !!r && typeof r === 'object' && typeof r.id === 'string' && ['victory', 'defeat', 'draw'].includes(r.outcome) && ['easy', 'normal', 'hard'].includes(r.difficulty) && ['hp', 'enemyHp', 'shots', 'hits', 'direct', 'damage', 'seconds'].every(k => typeof r[k] === 'number' && Number.isFinite(r[k]) && r[k] >= 0) && typeof r.date === 'string').slice(0, 20); } catch { return []; }
}
export function saveRecord(record: BattleResult) { try { localStorage.setItem('crater.records', JSON.stringify([record, ...loadRecords().filter(r => r.id !== record.id)].slice(0, 20))); } catch { /* A result still renders when storage is unavailable. */ } }
export function tutorialSeen() { try { return localStorage.getItem('crater.tutorial') === 'done'; } catch { return false; } }
export function finishTutorial() { try { localStorage.setItem('crater.tutorial', 'done'); } catch { /* Optional. */ } }
