import { Footprints } from 'lucide-react';
import { wallPoint, wallSection, wallTop } from './fortress-wall-walk';

const stops = [
  {row:83,name:'西栈桥'}, {row:43,name:'第一层观海台'}, {row:25,name:'泄水拱廊平台'}, {row:1,name:'下层王门'}
];
const project = (row:number) => ({x:16+(wallTop.y-row)*3.9,y:26-wallPoint(3,row).y*4.9});
const trace = Array.from({length:83},(_,i)=>{const p=project(83-i);return `${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`}).join(' ');

export function RampartAtlas({ row, walk }: {row:number;walk:(row:number)=>void}) {
  const here = project(row);
  return <div className="rampart-atlas">
    <svg viewBox="0 0 360 143" role="img" aria-label="从西栈桥到下层王门的长阶纵剖面。绿色标记是你的位置。">
      <path d="M12 26H348 M12 55H348 M12 84H348 M12 118H348" stroke="#37515a" strokeDasharray="3 4"/>
      <path d={trace+' L336 136H16Z'} fill="#34464a"/>
      <path d={trace} fill="none" stroke="#c7a470" strokeWidth="2.5"/>
      {stops.map(stop=>{const p=project(stop.row);return <g key={stop.row}>
        <circle cx={p.x} cy={p.y} r="3.3" fill="#dfc28f"/>
        <text x={p.x} y={p.y-9} textAnchor={stop.row===83?'start':stop.row===1?'end':'middle'} fill="#c9d8d7" fontSize="9">{stop.name}</text></g>;})}
      <circle cx={here.x} cy={here.y} r="5.4" stroke="#15332d" strokeWidth="2" fill="#d3f1aa"/>
    </svg>
    <p className="panel-copy">你在{wallSection(row)}。上端通回环城，下端的王门通往潮枢水殿。</p>
    <div className="rampart-stops">{stops.map(stop=><button type="button" className="subtle-button" key={stop.row} disabled={stop.row===row} onClick={()=>walk(stop.row)}>
      <Footprints size={15}/>{stop.name}<small>{Math.abs(stop.row-row)} 格</small></button>)}</div>
  </div>;
}
