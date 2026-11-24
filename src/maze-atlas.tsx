import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { CornerDownLeft, Map as MapIcon, Navigation } from 'lucide-react';
import { fortressLiftStops, fortressRooms } from './field-fortress-state';
import { mazeFloors, type MazePoint, type MazeRoom, type MazeTile } from './fortress-maze';
import { surveyedCells } from './fortress-survey';
import './maze-atlas.css';

type MapProps = { room: MazeRoom; position: MazePoint; walked: number[]; open: boolean };
const ink: Record<MazeTile, string> = {
  wall: '#384340', channel: '#204952', stone: '#6c7368', ice: '#7a9fa5', bridge: '#a58d68', grate: '#7a877d', gate: '#84694c',
};

function MapDrawing({ room, position, walked, open, compact, pin, onPin }: MapProps & {
  compact?: boolean; pin?: MazePoint; onPin?: (point: MazePoint) => void;
}) {
  const floor = mazeFloors[room];
  const seen = useMemo(() => surveyedCells(room, walked, open), [room, walked, open]);
  const steps = useMemo(() => new Set(walked), [walked]);
  const size = floor.width;
  const plan = useMemo(() => {
    const paths = new Map<string,string[]>();
    floor.tiles.forEach((row,y) => row.forEach((tile,x) => {
      if (tile === 'wall') return;
      const col = tile === 'channel' ? '#24454c' : '#485554';
      const parts = paths.get(col) ?? [];
      parts.push(`M${x},${y}h1v1h-1z`); paths.set(col,parts);
    }));
    return [...paths].map(([fill,parts]) => <path key={fill} fill={fill} d={parts.join('')}/>);
  },[floor]);
  const plots = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const id of seen) {
      const x = id % size, y = Math.floor(id / size), tile = floor.tiles[y][x];
      const color = tile === 'gate' && open ? ink.bridge : ink[tile];
      const group = groups.get(color) ?? [];
      group.push(`M${x},${y}h1v1h-1z`);
      groups.set(color, group);
    }
    return [...groups].map(([color, cells]) => <path key={color} fill={color} d={cells.join('')} />);
  }, [floor, open, seen, size]);

  function choose(event: MouseEvent<SVGSVGElement>) {
    if (!onPin) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const world = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const point = { x: Math.floor(world.x), y: Math.floor(world.y) };
    if (point.x >= 0 && point.x < size && steps.has(point.y * size + point.x)) onPin(point);
  }
  function chooseWithKeys(event: KeyboardEvent<SVGSVGElement>) {
    const offsets: Record<string, [number, number]> = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] };
    const offset = offsets[event.key];
    if (!onPin || !offset) return;
    event.preventDefault();
    const start = pin ?? position, point = { x: start.x + offset[0], y: start.y + offset[1] };
    if (point.x >= 0 && point.x < size && steps.has(point.y * size + point.x)) onPin(point);
  }
  const area = compact ? 11 : size;
  const left = Math.max(0, Math.min(size - area, position.x - 5));
  const top = Math.max(0, Math.min(floor.height - area, position.y - 5));
  const trace = useMemo(() => {
    const links: string[] = [];
    for (const id of walked) {
      const x = id % size, y = Math.floor(id / size);
      if (x + 1 < size && steps.has(id + 1)) links.push(`M${x+.5} ${y+.5}h1`);
      if (steps.has(id + size)) links.push(`M${x+.5} ${y+.5}v1`);
    }
    return links.join('');
  }, [size, steps, walked]);
  const features = [
    ...(room === 'catacomb' ? [{ ...fortressLiftStops.catacomb, mark: 'lift' }] : []),
    { ...floor.up, mark: 'up' }, { ...floor.down, mark: 'down' }, { ...floor.switch, mark: 'handle' },
  ];
  return <svg className="maze-drawing" viewBox={`${left} ${top} ${area} ${area}`} role="img"
    aria-label={compact ? '已探索的通路与当前位置' : '本层行迹。可点选金色足迹，或用方向键沿足迹选择返回点。'}
    tabIndex={compact ? undefined : 0} onClick={choose} onKeyDown={chooseWithKeys}>
    <rect width={size} height={floor.height} fill="#18262a" />
    {plan}{plots}
    <path d={trace} stroke="#d7b777" opacity=".7" strokeWidth=".18" fill="none" />
    {walked.map(id => <rect key={id} x={id % size + .31} y={Math.floor(id / size) + .31} width=".38" height=".38" fill="#e7c58d" />)}
    {features.map(f => <g transform={`translate(${f.x + .5} ${f.y + .5})`} key={f.mark}>
      {f.mark === 'up' || f.mark === 'down' ? <path d="M0,-.68 .66,.49 -.66,.49Z" transform={f.mark === 'down' ? 'rotate(180)' : undefined} fill="#f5dfaf" stroke="#263536" strokeWidth=".14" /> :
        f.mark === 'lift' ? <path d="M-.48,-.48h.96v.96h-.96z" fill="#29454e" stroke="#d2b57e" strokeWidth=".24"/> : f.mark === 'handle' ? <circle r=".55" fill="#17464a" stroke="#85ebd3" strokeWidth=".25" /> :
        <path d="M-.45,-.54v1.08M0,-.54v1.08M.45,-.54v1.08" stroke={open ? '#85ebd3' : '#efa07c'} strokeWidth=".23" />}
    </g>)}
    {pin && <rect x={pin.x - .17} y={pin.y - .17} width="1.34" height="1.34" fill="none" stroke="#ffcd70" strokeWidth=".17" />}
    <circle cx={position.x + .5} cy={position.y + .5} r={compact ? .91 : .66} fill="#d8fff7" stroke="#214f54" strokeWidth=".27" />
  </svg>;
}

export function MazeMinimap(props: MapProps & { expand: () => void }) {
  return <button type="button" className="maze-minimap" aria-label="打开本层行迹图" title="查看本层行迹图 (M)" onClick={props.expand}>
    <MapDrawing {...props} compact />
    <span><strong>{fortressRooms[props.room].level}</strong><MapIcon size={12} /></span>
  </button>;
}

export function MazeAtlas(props: MapProps & { walk: (point: MazePoint) => void }) {
  const { room, position, walked, open } = props;
  const floor = mazeFloors[room];
  const [pin, setPin] = useState<MazePoint>();
  const seen = useMemo(() => surveyedCells(room, walked, open), [room, walked, open]);
  const visible = (point: MazePoint) => seen.has(point.y * floor.width + point.x);
  const canTravel = pin && (pin.x !== position.x || pin.y !== position.y);
  return <div className="maze-atlas">
    <div className="maze-sheet"><MapDrawing {...props} pin={pin} onPin={setPin} /></div>
    <div className="maze-notes">
      <div className="maze-floor-name"><span>{fortressRooms[room].level}</span><h3>{fortressRooms[room].name}</h3></div>
      <p>纵贯南北的仪道通向两端楼梯。灰线是宫殿平面，金色是你的足迹。点选足迹可原路折返。</p>
      <ul className="maze-key">
        <li><b>●</b>你的位置</li><li><b>▲ / ▼</b>上下阶梯</li><li><b>◎</b>{floor.switchName}</li>
      </ul>
      {room === 'catacomb' && <p className="maze-gate-state">□ 古升降台 · 可往返潮枢水殿</p>}
      <p className="maze-gate-state">{floor.switchName} · {open ? '已校准' : '待校准'}</p>
      {floor.landmarks.filter(visible).map(mark => <div key={mark.name} className="maze-place"><Navigation size={13} />{mark.name}</div>)}
      <button className="subtle-button maze-return" disabled={!canTravel} onClick={() => { if (pin) props.walk(pin); }}>
        <CornerDownLeft size={15}/>{canTravel ? '沿足迹返回所选处' : '选择一个足迹'}
      </button>
    </div>
  </div>;
}
