import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BookOpen, Building2, Check, Compass, Cross, Leaf, LocateFixed, Mountain } from 'lucide-react';
import { areas, speciesIn, type AdventureSave } from './adventure';
import { CreatureSprite } from './creature-art';
import { ailmentLabels, creatures, maxHp, maxLevel, moves, movePP, typeLabels, xpToNext, type BattleProgress, type CreatureId } from './creatures';
import { fieldAreas, type FieldArea, type FieldLocation } from './field';
import { maps } from './field-art';
import { tileAt, type Tile } from './field-layout';
import { rooms } from './field-rooms';
import { cityChartSize, drawCityChart } from './field-city-chart';

export const areaIcons = { harbor: Building2, grove: Leaf, summit: Mountain } as const;

export function HpBar({ value, total }: { value: number; total: number }) {
  return <div className="hp-track" role="meter" aria-label="生命值" aria-valuemin={0} aria-valuenow={value} aria-valuemax={total} data-low={value <= total / 4}
    style={{ '--health': `${value / total * 100}%` } as CSSProperties}><i /></div>;
}

const chartInk: Readonly<Record<Tile, string>> = {
  lawn: '#4e7263', path: '#a18a73', grass: '#698c53', shore: '#968d72', shelf: '#407582',
  water: '#345a72', dock: '#b99a70', stone: '#9e9ab1', quay: '#aaa495', drop: '#4b4e68',
};

function LocationPreview({ area, location }: { area: FieldArea; location?: FieldLocation }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = maps[area];
  const unit = 4;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    if (area === 'harbor') { drawCityChart(ctx, location); return; }
    ctx.fillStyle = '#17262c';
    ctx.fillRect(0, 0, map.width * unit, map.height * unit);
    map.walkable.forEach((row, y) => row.forEach((passable, x) => {
      const tile = tileAt(area, x, y);
      ctx.fillStyle = chartInk[tile];
      ctx.fillRect(x * unit, y * unit, unit, unit);
      if (!passable && tile !== 'water') {
        ctx.fillStyle = '#18273141';
        ctx.fillRect(x * unit, y * unit, unit, unit);
      }
    }));
    for (const actor of map.npcs) {
      ctx.fillStyle = '#ebbc79';
      ctx.fillRect(actor.x * unit, actor.y * unit, unit, unit);
    }
    for (const gate of map.exits) {
      ctx.fillStyle = '#8abed6';
      ctx.fillRect(gate.x * unit, gate.y * unit - 1, unit, unit + 2);
    }
    if (location) {
      const x = location.x * unit;
      const y = location.y * unit;
      ctx.fillStyle = '#192525';
      ctx.fillRect(x - 2, y - 2, unit + 4, unit + 4);
      ctx.fillStyle = '#e8fca8';
      ctx.fillRect(x - 2, y + 1, unit + 4, 2);
      ctx.fillRect(x + 1, y - 2, 2, unit + 4);
    }
  }, [area, location, map]);
  const size = area === 'harbor' ? cityChartSize : { width: map.width * unit, height: map.height * unit };
  return <canvas className="route-preview" ref={canvas} width={size.width} height={size.height}
    role="img" aria-label={`${fieldAreas[area].name}地形图${location ? '，十字标记为当前位置' : ''}`} />;
}

export function RouteAtlas({ save, travel }: { save: AdventureSave; travel: (area: FieldArea) => void }) {
  return <div className="route-list">
    {areas.map((id, index) => {
      const Icon = areaIcons[id];
      const current = id === save.location.area;
      const visited = save.visited.includes(id);
      const native = speciesIn(id).filter(species => save.seen.includes(species));
      const room = current && save.location.room ? rooms[save.location.room] : undefined;
      const position = room ? { area: id, x: room.exterior.x, y: room.exterior.y + 1 } : save.location;
      return <article className="route-card" key={id} data-current={current} data-city={id === 'harbor' || undefined}>
        <div className="route-overview">
          <div className="route-title"><Icon size={19} /><h3>{fieldAreas[id].name}</h3></div>
          <span className="pixel route-number">0{index + 1} / {fieldAreas[id].english}</span>
          <p>{fieldAreas[id].description}</p>
          {visited && native.length > 0 && <div className="route-native">{native.map(species => <span key={species}>{creatures[species].name}</span>)}</div>}
          {current ? <span className="route-state"><LocateFixed size={13} />{room ? room.name : '当前位置'}</span> : visited ? <button type="button" className="subtle-button" onClick={() => travel(id)}>前往</button> : <span className="route-state">尚未抵达</span>}
        </div>
        {visited && <LocationPreview area={id} location={current ? position : undefined} />}
      </article>;
    })}
    <div className="route-legend" aria-label="航线图例">
      <span><i data-marker="player" />当前位置</span><span><i data-marker="gate" />出口</span><span><i data-marker="actor" />人物</span><span><i data-marker="grass" />高草</span>
    </div>
    <p className="panel-copy">从环城的东渡口前往雾杉小径。到过的地点可以从航线直接返回。</p>
  </div>;
}

const speciesIds = (Object.keys(creatures) as CreatureId[]).sort((a, b) => creatures[a].number - creatures[b].number);

function TypeBadges({ id }: { id: CreatureId }) {
  return <span className="type-badges">{creatures[id].types.map(type => <span className="type-badge" data-type={type} key={type}>{typeLabels[type]}</span>)}</span>;
}

export function Pokedex({ save, entry }: { save: AdventureSave; entry?: CreatureId }) {
  const [active, setActive] = useState(entry ?? save.battle.lead);
  const caught = new Set(save.battle.team.map(member => member.id));
  const known = save.seen.includes(active);
  const pokemon = creatures[active];
  const found = areas.filter(area => speciesIn(area).includes(active));
  return <div className="dex">
    <div className="dex-tally"><span><BookOpen size={16} />已发现 <b>{save.seen.length}/{speciesIds.length}</b></span><span><Check size={16} />已入队 <b>{caught.size}/{speciesIds.length}</b></span></div>
    <div className="dex-body">
      <div className="dex-list" role="group" aria-label="图鉴条目">
        {speciesIds.map(id => {
          const species = creatures[id];
          const spotted = save.seen.includes(id);
          const number = String(species.number).padStart(3, '0');
          return <button type="button" className="dex-entry" key={id} aria-pressed={id === active} onClick={() => setActive(id)}>
            <span className="pixel">#{number}</span>
            <strong>{spotted ? species.name : '未发现'}</strong>
            {caught.has(id) && <span className="dex-caught" aria-label="已入队"><Check size={12} /></span>}
          </button>;
        })}
      </div>
      <article className="dex-detail" aria-live="polite">
        <div className="dex-portrait" style={{ '--species-tint': known ? pokemon.color : '#527078' } as CSSProperties}>
          <span className="pixel">#{String(pokemon.number).padStart(3, '0')}</span>
          {known ? <CreatureSprite id={active} /> : <Compass size={45} strokeWidth={1} />}
        </div>
        {known ? <>
          <div className="dex-species"><h3>{pokemon.name}</h3><span className="pixel">{pokemon.english}</span></div>
          <TypeBadges id={active} />
          <p>{pokemon.description}</p>
          <p className="habitat"><strong>群岛栖息地</strong>{found.length ? found.map(area => fieldAreas[area].name).join(' / ') : '初始同行伙伴'}</p>
          <a className="dex-reference" href={`https://www.pokemon.com/us/pokedex/${active}`} target="_blank" rel="noreferrer">查看官方图鉴</a>
        </> : <div className="dex-unseen"><h3>未发现</h3><p>遇见这只宝可梦后会记录它的名称与属性。</p></div>}
      </article>
    </div>
  </div>;
}

export function TeamPanel({ progress, setLead, heal, inspect }: {
  progress: BattleProgress;
  setLead: (id: CreatureId) => void;
  heal: (id: CreatureId) => void;
  inspect: (id: CreatureId) => void;
}) {
  const [selection, setSelection] = useState(progress.lead);
  const focus = progress.team.find(member => member.id === selection) ?? progress.team[0];
  const species = creatures[focus.id];
  const capped = focus.level === maxLevel;
  return <div className="pack-panel">
    <div className="pack-items"><span><Cross size={16} />伤药 <b>{progress.medicine}</b></span><span><Compass size={16} />精灵球 <b>{progress.charms}</b></span><span>胜场 <b>{progress.wins}</b></span></div>
    <div className="team-grid" role="group" aria-label="队伍成员">{progress.team.map(member => <button type="button" key={member.id} aria-pressed={member.id === focus.id} onClick={() => setSelection(member.id)}>
      <CreatureSprite id={member.id} />
      <span><strong>{creatures[member.id].name}</strong><small>{member.id === progress.lead ? '首发 · ' : ''}Lv. {member.level}</small></span>
    </button>)}</div>
    <div className="team-detail">
      <div className="team-detail-heading"><div><h3>{species.name}</h3><TypeBadges id={focus.id} />{focus.ailment && <span className="type-badge team-ailment">{ailmentLabels[focus.ailment]}</span>}</div><span className="pixel">LV. {focus.level}</span></div>
      <div className="team-vitals"><span>HP</span><HpBar value={focus.hp} total={maxHp(focus)} /><b>{focus.hp}/{maxHp(focus)}</b><span>EXP</span><div className="exp-track"><i style={{ width: capped ? '100%' : `${focus.xp / xpToNext(focus.level) * 100}%` }} /></div><b>{capped ? 'MAX' : `${focus.xp}/${xpToNext(focus.level)}`}</b></div>
      <ul className="team-moves">{species.moves.map(id => <li key={id}>
        <span className="type-badge" data-type={moves[id].type}>{typeLabels[moves[id].type]}</span><strong>{moves[id].name}</strong><span>PP {movePP(focus, id)}/{moves[id].pp}</span>
      </li>)}</ul>
      <div className="team-actions">
        <button type="button" className="subtle-button" disabled={focus.id === progress.lead || focus.hp === 0} onClick={() => setLead(focus.id)}>{focus.id === progress.lead ? '已首发' : '设为首发'}</button>
        <button type="button" className="subtle-button" disabled={!progress.medicine || focus.hp === 0 || focus.hp === maxHp(focus)} onClick={() => heal(focus.id)}>使用伤药</button>
        <button type="button" className="subtle-button" onClick={() => inspect(focus.id)}>图鉴资料</button>
      </div>
    </div>
  </div>;
}
