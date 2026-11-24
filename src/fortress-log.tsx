import { useState } from 'react';
import { ArrowUpRight, Check, Map as MapIcon, Navigation } from 'lucide-react';
import type { AdventureSave } from './adventure';
import { fortressOrder, fortressRooms, type FortressRoom } from './field-fortress-state';
import { isMazeRoom, mazeFloors } from './fortress-maze';
import { wardPosts } from './fortress-ward-service';

const crossSections: Record<FortressRoom, string> = {
  sluice: 'M20 21h9v-5q5-10 10 0v5h5v-5q5-10 10 0v5h5v-5q5-10 10 0v5h8 M30 23h38 M44 23v4h11v-4',
  aqueduct: 'M16 14h68 M20 24v-4q6-11 12 0v4h3v-4q6-11 12 0v4h3v-4q6-11 12 0v4h3v-4q6-11 12 0v4 M16 27q6-3 12 0t12 0t12 0t12 0t12 0',
  catacomb: 'M22 11h53 M25 11v14m5-14v14m9-14v14m5-14v14m10-14v14m5-14v14m9-14v14m5-14v14 M20 25h58m-51 3h44',
  seal: 'M18 26h63 M26 25l5-12 3 12m29 0 3-12 4 12 M37 24a13 13 0 0 1 26 0 M40 25h19 M48 8v-3m7 5 2-3m-16 3-2-3',
};

function observation(room: FortressRoom, save: AdventureSave) {
  if (room === 'sluice') return save.tideDialAwake
    ? '古代潮盘已经点亮。水殿北端的石阶通向下一层。' : '沿石桥寻找中央潮盘。穿过柱列，北侧石阶通往御水长庭。';
  if (isMazeRoom(room)) {
    const walked = save.mazeTrail[room].length;
    const open = save.shortcuts.includes(room);
    return `已记录 ${walked} 格足迹。${mazeFloors[room].switchName}${open ? '已校准。' : '可在侧廊校准。'}${room === 'catacomb' ? '西侧升降台可往返水殿。' : '进入这一层时，可以在行迹图上沿原路折返。'}`;
  }
  if (!save.kyuremObserved) return '从南侧走上观测桥，靠近封印罩。';
  if (save.ward.phase === 'idle') return '已观测到酋雷姆。留在桥头听它吼叫，也可以开始检查锁链。';
  if (save.ward.phase === 'seeking') return '巡检进行中。听桥上传来的回震，再沿侧廊检查对应的锚柱。';
  if (save.ward.phase === 'braced') return '锁链已经收紧。返回观测桥，再测一次封印。';
  return `${wardPosts.find(post => post.id === save.ward.fault)?.name}已修复，封印复测通过。`;
}

export function FortressLog({ save, chart, maze, dex }: {
  save: AdventureSave; chart: (opener: HTMLElement) => void; maze: (opener: HTMLElement) => void; dex: (opener: HTMLElement) => void;
}) {
  const current = save.location.fortressRoom;
  const deepest = save.deepestFloor ? fortressOrder.indexOf(save.deepestFloor) : -1;
  const [selected, select] = useState<FortressRoom>(current ?? save.deepestFloor ?? 'sluice');
  const here = selected === current;
  const known = fortressOrder.indexOf(selected) <= deepest;
  const entry = fortressRooms[selected];
  return <div className="fortress-log">
    <p className="panel-copy">{save.fortressOpened ? '海宫已经升起。从西栈桥走上引桥，沿堡壁长阶下到海面附近。穿过下层王门，就是潮枢水殿。'
      : save.fortressStartedAt ? '西栈桥的升降轮已启动。海水排尽后，沿外壁长阶去下层王门。' : '环城的升降轮藏在西栈桥。沿木栈道走到铜轮前，便能唤起海面下的堡垒。'}</p>
    <div className="fortress-log-floors" role="group" aria-label="海宫楼层">
      {fortressOrder.map((room, i) => <button type="button" key={room} disabled={i > deepest} aria-pressed={known && room === selected}
        className="log-floor" data-current={room === current || undefined} onClick={() => select(room)}>
        <b className="pixel">{fortressRooms[room].level}</b>
        <svg viewBox="0 0 100 32" aria-hidden="true" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {i <= deepest ? <path d={crossSections[room]}/> : <path d="M18 23h16l4-3 8 3h13l5-2 12 2" strokeDasharray="3 5"/>}
        </svg>
        <span><strong>{i <= deepest ? fortressRooms[room].name : '未勘察'}</strong>
          <small>{room === current ? '所在楼层' : i <= deepest ? '已到访' : '未记录地形'}</small></span>
        {i <= deepest && <Check size={14}/>}
      </button>)}
    </div>
    {known && <section className="log-observation" aria-live="polite">
      <h3>{entry.name}</h3><p>{observation(selected, save)}</p>
    </section>}
    <div className="save-actions">
      {here && isMazeRoom(selected) && <button type="button" className="primary-button" data-panel-entry="log-map" onClick={event => maze(event.currentTarget)}><MapIcon size={16}/>展开本层行迹图</button>}
      {!current && <button type="button" className="subtle-button" data-panel-entry="log-port" onClick={event => chart(event.currentTarget)}><Navigation size={15}/>标出西栈桥</button>}
      {selected === 'seal' && save.kyuremObserved && <button type="button" className="subtle-button" data-panel-entry="log-dex" onClick={event => dex(event.currentTarget)}>查看酋雷姆图鉴<ArrowUpRight size={14}/></button>}
    </div>
  </div>;
}
