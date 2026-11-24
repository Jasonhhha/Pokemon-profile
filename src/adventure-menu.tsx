import { wardPosts } from './fortress-ward-service';
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Anchor, BookOpen, Building2, Castle, Check, Clock3, Compass, Cross, Footprints, Landmark, Leaf, FlaskConical, Flag, LocateFixed, Radio, Sprout, Swords } from 'lucide-react';
import { areas, speciesIn, type AdventureSave } from './adventure';
import { CreatureSprite } from './creature-art';
import { ailmentLabels, creatures, potionHp, maxHp, maxLevel, moves, movePP, typeLabels, xpToNext, type BattleProgress, type CreatureId } from './creatures';
import { fieldAreas, planCityItinerary, type FieldLocation } from './field';
import { maps } from './field-layout';
import { rooms } from './field-rooms';
import { fortressPier, fortressRooms } from './field-fortress-state';
import { cityChartPoint, cityChartSize, drawCityChart } from './field-city-chart';
import { cityStops, courtNotes, surveyStops, type CityStop, type CityStopId, type StreetPoint } from './field-city-walks';

export const areaIcons = { harbor: Building2 } as const;

export function HpBar({ value, total }: { value: number; total: number }) {
  return <div className="hp-track" role="meter" aria-label="生命值" aria-valuemin={0} aria-valuenow={value} aria-valuemax={total} data-low={value <= total / 4}
    style={{ '--health': `${value / total * 100}%` } as CSSProperties}><i /></div>;
}

function CityPreview({ location, walk }: { location?: FieldLocation; walk: { path?: StreetPoint[] } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) drawCityChart(ctx, location, walk);
  }, [location, walk]);
  return <canvas className="route-preview" ref={canvas} width={cityChartSize.width} height={cityChartSize.height}
    role="img" aria-label={`潮汐环城地形图${location ? '，十字标记为当前位置' : ''}`} />;
}

const stopIcons = {
  wharf: Anchor, garden: Sprout, market: Landmark, station: Clock3, fortress: Castle,
  archive: BookOpen, clinic: Cross, greenway: Leaf, research: FlaskConical, signal: Radio, practice: Swords, trial: Flag,
};

// Adjacent addresses occupy the same narrow stretch of street on a phone-sized chart.
const pinOffsets: Partial<Record<CityStopId, [number, number]>> = {
  clinic: [0, 4], research: [4, 0], signal: [-2, 3], practice: [24, -4], greenway: [7, -20],
};

type CityWalkProps = { save: AdventureSave; lastStop?: CityStopId; walkTo: (stop: CityStop) => boolean };

function CityWalkMap({ save, walkTo, lastStop }: CityWalkProps) {
  const [id, select] = useState<CityStopId>(() => lastStop ?? surveyStops.find(stop => !save.courtVisits.includes(stop.survey))?.id ?? 'archive');
  const [routeFailed, setRouteFailed] = useState(false);
  const selected = cityStops.find(stop => stop.id === id)!;
  const local = !save.location.fortressRoom && !save.location.wallPassage;
  const room = save.location.room && rooms[save.location.room];
  const pin = local ? room ? room.map.exits[0].to : save.location : { area: 'harbor' as const, ...fortressPier };
  const route = useMemo(() => {
    const itinerary = planCityItinerary(save.location, selected);
    const path = itinerary?.street;
    return {
      path, indoor: itinerary?.indoor?.path.length, insideDestination: itinerary?.insideDestination,
      grass: path?.filter(tile => maps.harbor.grass[tile.y][tile.x]).length ?? 0,
    };
  }, [save.location, selected]);
  const recorded = selected.survey && save.courtVisits.includes(selected.survey);
  const trialNote = save.battle.trialWon ? '你已通过试炼。守望员在东栈桥等候。' : save.battle.team.length < 2
    ? '试炼需要两位伙伴。可先前往外环绿廊，在高草中捕捉宝可梦。' : selected.subject;
  function choose(next: CityStopId) { select(next); setRouteFailed(false); }

  return <section className="city-walk-map" aria-label="环城步行图">
    <div className="city-chart-wrap">
      <CityPreview location={pin} walk={route} />
      {cityStops.map(stop => {
        const Icon = stopIcons[stop.id];
        const [x, y] = cityChartPoint(stop.position.x, stop.position.y);
        const visited = stop.survey && save.courtVisits.includes(stop.survey);
        const [dx, dy] = pinOffsets[stop.id] ?? [0, 0];
        const anchor = { left: `${100 * x / cityChartSize.width}%`, top: `${100 * y / cityChartSize.height}%` };
        return <Fragment key={stop.id}>
          {Math.hypot(dx, dy) > 8 && <i aria-hidden="true" className="city-pin-leader"
            style={{ ...anchor, width: Math.hypot(dx, dy), transform: `rotate(${Math.atan2(dy, dx)}rad)` }} />}
          <button type="button" className="city-chart-pin" aria-label={stop.name} title={stop.name}
            aria-pressed={id === stop.id} data-survey={Boolean(stop.survey)} data-visited={visited || undefined}
            style={{ left: `calc(${anchor.left} + ${dx}px)`, top: `calc(${anchor.top} + ${dy}px)` }}
            onClick={() => choose(stop.id)}><Icon size={15} aria-hidden="true" /></button>
        </Fragment>;
      })}
    </div>
    <div className="city-walk-picker">
      <label>步行目的地<select value={id} onChange={event => choose(event.target.value as CityStopId)}>
        <optgroup label="院落考察">{surveyStops.map(stop => <option value={stop.id} key={stop.id}>
          {stop.name}{save.courtVisits.includes(stop.survey) ? ' · 已记录' : ''}
        </option>)}</optgroup>
        <optgroup label="城内设施">{cityStops.filter(stop => !stop.survey).map(stop =>
          <option value={stop.id} key={stop.id}>{stop.name}</option>)}</optgroup>
      </select></label>
      {local && <button type="button" className="city-walk-start" disabled={!route.path} onClick={() => setRouteFailed(!walkTo(selected))}>
        <Footprints size={16} />{route.indoor !== undefined ? '出门并沿街步行' : route.path?.length === 0 ? '返回现场' : '沿街步行'}
      </button>}
    </div>
    <div className="city-stop-detail" aria-live="polite">
      <p>{selected.survey ? recorded ? courtNotes[selected.survey].note : `走到${selected.subject}旁，按互动键观察。` : selected.id === 'trial' ? trialNote : selected.subject}</p>
      <small>{routeFailed ? '路线已变化，请重新选择目的地。' : local && route.path
        ? route.indoor !== undefined ? `室内 ${route.indoor} 步 · 沿街 ${route.path.length} 步`
          : route.insideDestination ? '已在这间设施内' : route.path.length ? `实线路线 · ${route.path.length} 步` : '已在目的地旁'
        : '在环城街面可开始步行'}{route.grass > 0 && ` · 途经 ${route.grass} 格高草，可能遇敌`}</small>
    </div>
    <div className="city-notebook">
      <BookOpen size={15} /><strong>街区手记</strong><span>{save.courtVisits.length} / {surveyStops.length}</span>
      <small>{save.courtVisits.length === surveyStops.length ? '考察完成 · 补给已领取' : '记下四处院落，可领两份伤药'}</small>
    </div>
  </section>;
}

export function RouteAtlas({ save, walkTo, lastStop }: CityWalkProps) {
  const room = save.location.room && rooms[save.location.room];
  const floor = save.location.fortressRoom && fortressRooms[save.location.fortressRoom];
  const seen = speciesIn('harbor').filter(species => save.seen.includes(species));
  return <div className="route-list"><article className="route-card" data-current="true" data-city="true">
    <div className="route-overview">
      <div className="route-title"><Building2 size={19} /><h3>{fieldAreas.harbor.name}</h3></div>
      <span className="pixel route-number">{fieldAreas.harbor.english}</span>
      <p>{fieldAreas.harbor.description}</p>
      {seen.length > 0 && <div className="route-native">{seen.map(id => <span key={id}>{creatures[id].name}</span>)}</div>}
      <span className="route-state"><LocateFixed size={13} />{save.location.wallPassage ? '西栈桥外壁长阶' : floor?.name ?? room?.name ?? '当前位置'}</span>
    </div>
    <CityWalkMap save={save} walkTo={walkTo} lastStop={lastStop} />
  </article></div>;
}

const speciesIds = (Object.keys(creatures) as CreatureId[]).sort((a, b) => creatures[a].number - creatures[b].number);

function TypeBadges({ id }: { id: CreatureId }) {
  return <span className="type-badges">{creatures[id].types.map(type => <span className="type-badge" data-type={type} key={type}>{typeLabels[type]}</span>)}</span>;
}

export function Pokedex({ save, entry }: { save: AdventureSave; entry?: CreatureId | 'kyurem' }) {
  const [selected, setActive] = useState(entry ?? save.battle.lead);
  const isKyurem = selected === 'kyurem';
  const active = isKyurem ? save.battle.lead : selected;
  const caught = new Set(save.battle.team.map(member => member.id));
  const known = save.seen.includes(active);
  const pokemon = creatures[active];
  const found = areas.filter(area => speciesIn(area).includes(active));
  return <div className="dex">
    <div className="dex-tally"><span><BookOpen size={16} />已发现 <b>{save.seen.length + Number(save.kyuremObserved)}/{speciesIds.length + 1}</b></span><span><Check size={16} />已入队 <b>{caught.size}/{speciesIds.length}</b></span></div>
    <div className="dex-body">
      <div className="dex-list" role="group" aria-label="图鉴条目">
        {speciesIds.map(id => {
          const species = creatures[id];
          const spotted = save.seen.includes(id);
          const number = String(species.number).padStart(3, '0');
          return <button type="button" className="dex-entry" key={id} aria-pressed={id === selected} onClick={() => setActive(id)}>
            <span className="pixel">#{number}</span>
            <strong>{spotted ? species.name : '未发现'}</strong>
            {caught.has(id) && <span className="dex-caught" aria-label="已入队"><Check size={12} /></span>}
          </button>;
        })}
        <button type="button" className="dex-entry" aria-pressed={isKyurem} onClick={() => setActive('kyurem')}>
          <span className="pixel">#646</span><strong>{save.kyuremObserved ? '酋雷姆' : '未发现'}</strong>
        </button>
      </div>
      {isKyurem ? <article className="dex-detail" aria-live="polite">
        <div className="dex-portrait"><span className="pixel">#646</span>{save.kyuremObserved ? <img className="creature-sprite" src={import.meta.env.BASE_URL + 'assets/kyurem-bw.png'} alt="酋雷姆" /> : <Compass size={45} strokeWidth={1}/>}</div>
        {save.kyuremObserved ? <>
          <div className="dex-species"><h3>酋雷姆</h3><span className="pixel">KYUREM</span></div>
          <p>龙 / 冰 · 身高 3.0 米 · 体重 325.0 千克</p>
          <p>冰核封印殿的观测桥上，可以看见它低下头，再张颌咆哮。冲击传到罩壁，锚柱上的积霜随之落下。</p>
          {save.ward.phase === 'stable' && <p className="ward-field-note"><strong>封印殿巡检手记</strong>
            {wardPosts.find(post => post.id === save.ward.fault)?.name}的止退爪已经归位。复测时，指针只回摆了一次。</p>}
          <a className="dex-reference" href="https://zukan.pokemon.co.jp/detail/0646" target="_blank" rel="noreferrer">查看官方图鉴</a>
        </> : <div className="dex-unseen"><h3>未发现</h3><p>深入海宫，在观测桥上记录这只宝可梦。</p></div>}
      </article> : <article className="dex-detail" aria-live="polite">
        <div className="dex-portrait" style={{ '--species-tint': known ? pokemon.color : '#527078' } as CSSProperties}>
          <span className="pixel">#{String(pokemon.number).padStart(3, '0')}</span>
          {known ? <CreatureSprite id={active} /> : <Compass size={45} strokeWidth={1} />}
        </div>
        {known ? <>
          <div className="dex-species"><h3>{pokemon.name}</h3><span className="pixel">{pokemon.english}</span></div>
          <TypeBadges id={active} />
          <p>{pokemon.description}</p>
          <p className="habitat"><strong>环城栖息地</strong>{found.length ? found.map(area => fieldAreas[area].name).join(' / ') : '初始同行伙伴'}</p>
          <a className="dex-reference" href={`https://www.pokemon.com/us/pokedex/${active}`} target="_blank" rel="noreferrer">查看官方图鉴</a>
        </> : <div className="dex-unseen"><h3>未发现</h3><p>遇见这只宝可梦后会记录它的名称与属性。</p></div>}
      </article>}
    </div>
  </div>;
}

export function TeamPanel({ progress, setLead, heal, inspect, storage, selection, select }: {
  selection: CreatureId; select: (id: CreatureId) => void;
  storage: (opener: HTMLElement) => void;
  progress: BattleProgress;
  setLead: (id: CreatureId) => void;
  heal: (id: CreatureId) => void;
  inspect: (id: CreatureId, opener: HTMLElement) => void;
}) {

  const focus = progress.team.find(member => member.id === selection) ?? progress.team[0];
  const species = creatures[focus.id];
  const capped = focus.level === maxLevel;
  return <div className="pack-panel">
    <div className="pack-items"><span><Cross size={16} />伤药 <b>{progress.medicine}</b></span><span><Compass size={16} />精灵球 <b>{progress.charms}</b></span><span>胜场 <b>{progress.wins}</b></span></div>
    <div className="team-grid" role="group" aria-label="队伍成员">{progress.team.map(member => <button type="button" key={member.id} aria-pressed={member.id === focus.id} onClick={() => select(member.id)}>
      <CreatureSprite id={member.id} />
      <span><strong>{creatures[member.id].name}</strong><small>{member.id === progress.lead ? '首发 · ' : ''}Lv. {member.level}</small></span>
    </button>)}</div>
    <div className="team-detail">
      <div className="team-detail-heading"><div><h3>{species.name}</h3><TypeBadges id={focus.id} />{focus.ailment && <span className="type-badge team-ailment">{ailmentLabels[focus.ailment]}</span>}</div><span className="pixel">LV. {focus.level}</span></div>
      <div className="team-vitals"><span>HP</span><HpBar value={focus.hp} total={maxHp(focus)} /><b>{focus.hp}/{maxHp(focus)}</b><span>EXP</span><div className="exp-track"><i style={{ width: capped ? '100%' : `${focus.xp / xpToNext(focus.level) * 100}%` }} /></div><b>{capped ? 'MAX' : `${focus.xp}/${xpToNext(focus.level)}`}</b></div>
      <ul className="team-moves">{species.moves.map(id => <li key={id}>
        <span className="type-badge" data-type={moves[id].type}>{typeLabels[moves[id].type]}</span><strong>{moves[id].name}</strong><span>PP {movePP(focus, id)}/{moves[id].pp}</span>
      </li>)}</ul>
      <p className="pack-care" aria-live="polite">{focus.hp === 0 ? '这位伙伴已经力竭，可以到环城补给站休整。' : focus.hp === maxHp(focus) ? '体力已满。' : !progress.medicine ? '伤药已用完，可以到环城补给站补充。' : `一份伤药可为${species.name}恢复 ${Math.min(potionHp, maxHp(focus) - focus.hp)} HP。`}</p>
      <div className="team-actions">
        <button type="button" className="subtle-button" disabled={focus.id === progress.lead || focus.hp === 0} onClick={() => setLead(focus.id)}>{focus.id === progress.lead ? '已首发' : '设为首发'}</button>
        <button type="button" className="subtle-button" disabled={!progress.medicine || focus.hp === 0 || focus.hp === maxHp(focus)} onClick={() => heal(focus.id)}>使用伤药</button>
        <button type="button" className="subtle-button" data-panel-entry="team-dex" onClick={event => inspect(focus.id, event.currentTarget)}>图鉴资料</button>
      </div>
    </div>
    <button type="button" className="panel-back pack-storage" data-panel-entry="storage" onClick={event => storage(event.currentTarget)}>管理冒险存档</button>
  </div>;
}
