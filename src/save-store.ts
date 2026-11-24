import { areas, restoreAdventure, saveKey, type AdventureSave } from './adventure';
import { migrateBattleProgress } from './creatures';

export type SaveStatus = 'saved' | 'unavailable' | 'conflict' | 'damaged';
export type SaveSession = { initial: AdventureSave; baseline: string | null; status: SaveStatus };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readSession(): SaveSession {
  let baseline: string | null = null;
  try {
    baseline = localStorage.getItem(saveKey);
    if (baseline !== null) {
      const data: unknown = JSON.parse(baseline);
      if (!record(data)) throw new Error();
      return { baseline, status: 'saved', initial: restoreAdventure(data) };
    }
    const legacy = localStorage.getItem('yu-world-partner');
    let partner: unknown;
    try { if (legacy) partner = JSON.parse(legacy); } catch { /* A new party can still be created. */ }
    return { baseline, status: 'saved', initial: restoreAdventure(null, partner) };
  } catch {
    return { baseline, status: baseline === null ? 'unavailable' : 'damaged', initial: restoreAdventure(null) };
  }
}

// Compare against the snapshot this tab actually read. A background tab may still hold an older party.
export function writeSession(session: SaveSession, save: AdventureSave): SaveStatus {
  if (session.status === 'damaged') return 'damaged';
  try {
    const existing = localStorage.getItem(saveKey);
    const serialized = JSON.stringify(save);
    if (existing === serialized) session.baseline = existing;
    else if (existing !== session.baseline) return session.status = 'conflict';
    else {
      localStorage.setItem(saveKey, serialized);
      session.baseline = serialized;
    }
    return session.status = 'saved';
  } catch { return session.status = 'unavailable'; }
}

export function exportText(save: AdventureSave) {
  return JSON.stringify({ game: 'tidebound', version: 1, exportedAt: new Date().toISOString(), adventure: save }, null, 2);
}

export function parseBackup(text: string): AdventureSave {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('文件内容无法读取，请选择下载的 JSON 存档。'); }
  if (!record(value) || value.game !== 'tidebound') throw new Error('请选择潮汐群岛导出的存档文件。');
  if (value.version !== 1) throw new Error('当前游戏无法读取这个版本的存档。');
  const saved = value.adventure;
  const location = record(saved) ? saved.location : null;
  if (!record(saved) || !record(location) || !(areas.some(area => area === location.area) || location.area === 'grove' || location.area === 'summit') ||
      !Number.isSafeInteger(location.x) || !Number.isSafeInteger(location.y) || !migrateBattleProgress(saved.battle)) {
    throw new Error('存档缺少有效的位置或队伍，当前进度已保留。');
  }
  const restored = restoreAdventure(saved);
  if (saved.pendingBattle && !restored.pendingBattle) throw new Error('未结束的对战记录已损坏，当前进度已保留。');
  return restored;
}
