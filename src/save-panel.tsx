import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, RotateCcw } from 'lucide-react';
import type { AdventureSave } from './adventure';
import { creatures } from './creatures';
import { fieldAreas } from './field';
import { fortressRooms } from './field-fortress-state';
import { rooms } from './field-rooms';
import { exportText, parseBackup, type SaveStatus } from './save-store';

const statusText: Record<SaveStatus, string> = {
  saved: '冒险进度已保存在当前浏览器。换设备时可以带走一份存档。',
  unavailable: '浏览器暂时无法写入。可以下载本次进度，或重新尝试保存。',
  conflict: '另一个页面已更新存档。可以先下载本页进度，再载入浏览器里的最新进度。',
  damaged: '浏览器里的存档无法读取，原始文件仍然保留。可以下载原件，再选择一份备份恢复。',
};

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function Summary({ save }: { save: AdventureSave }) {
  const { area, room, fortressRoom } = save.location;
  const checkpoint = save.pendingBattle;
  const party = checkpoint?.state.progress ?? save.battle;
  const member = party.team.find(member => member.id === party.lead) ?? party.team[0];
  return <dl className="save-summary">
    <div><dt>所在位置</dt><dd>{save.location.wallPassage ? '堡垒外壁长阶' : fortressRoom ? fortressRooms[fortressRoom].name : room ? rooms[room].name : fieldAreas[area].name}</dd></div>
    <div><dt>队伍</dt><dd>{creatures[member.id].name} Lv. {member.level} · {party.team.length} 位伙伴</dd></div>
    <div><dt>探索记录</dt><dd>{save.deepestFloor ? fortressRooms[save.deepestFloor].level + ' · ' : ''}{party.wins} 胜{checkpoint ? ' · 对战进行中' : ''}</dd></div>
  </dl>;
}

type Props = {
  save: AdventureSave; status: SaveStatus; original: string | null; previous: AdventureSave | null;
  apply: (save: AdventureSave) => boolean; latest: () => void; retry: () => void;
};

export function SavePanel({ save, status, original, previous, apply, latest, retry }: Props) {
  const [candidate, setCandidate] = useState<{ save: AdventureSave; undo: boolean } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  async function read(file?: File) {
    if (!file) return;
    const key = ++sequence.current;
    setCandidate(null);
    setError('');
    setNotice('');
    try {
      if (file.size > 512 * 1024) throw new Error('文件太大，请选择小于 512 KB 的潮汐群岛存档。');
      const candidate = parseBackup(await file.text());
      if (key === sequence.current) setCandidate({ save: candidate, undo: false });
    } catch (cause) {
      if (key === sequence.current) setError(cause instanceof Error ? cause.message : '读取文件失败，请重试。');
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  return <div className="save-panel">
    <p className="panel-copy" role="status">{statusText[status]}</p><Summary save={save} />
    <div className="save-actions">
      <button type="button" className="primary-button" onClick={() => { download(exportText(save), 'tidebound-' + date + '.json'); setNotice('已生成冒险存档文件。'); }}><Download size={16}/>下载存档</button>
      <button type="button" className="subtle-button" onClick={() => input.current?.click()}><FileUp size={16}/>选择存档文件</button>
      <input type="file" hidden ref={input} accept=".json,application/json" aria-label="选择冒险存档" onChange={event => { void read(event.target.files?.[0]); event.target.value = ''; }}/>
      {status === 'unavailable' && <button type="button" className="subtle-button" onClick={retry}>重新保存</button>}
      {status === 'conflict' && <button type="button" className="subtle-button" onClick={latest}>载入最新进度</button>}
      {status === 'damaged' && original !== null && <button type="button" className="subtle-button" onClick={() => download(original, 'tidebound-original-' + date + '.json')}>下载原始文件</button>}
      {previous && <button type="button" className="subtle-button" onClick={() => { ++sequence.current; setError(''); setCandidate({ save: previous, undo: true }); }}><RotateCcw size={15}/>找回载入前的进度</button>}
    </div>
    {candidate && <section className="save-confirm" aria-label="存档预览">
      <h3>{candidate.undo ? '载入前的进度' : '文件中的进度'}</h3><Summary save={candidate.save}/>
      <p>确认后将从这个位置继续。本次打开游戏期间，可以找回替换前的进度。</p>
      <div className="save-actions"><button type="button" className="primary-button" onClick={() => {
        if (!apply(candidate.save)) setError('浏览器里的存档刚刚发生了变化。请先载入最新进度，再选择文件。');
      }}>确认载入</button><button type="button" className="subtle-button" onClick={() => { setCandidate(null); setError(''); }}>取消</button></div>
    </section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="copy-feedback" role="status">{notice}</p>}
    <p className="save-scope">备份包含冒险记录与进行中的对战。个人资料和留言保留在本页。</p>
  </div>;
}
