import { useEffect, useRef, useState } from 'react';
import { Footprints, Map, Navigation } from 'lucide-react';
import { fortressOrder, fortressRooms, type FortressRoom } from './field-fortress-state';
import { nominalPower, type GridReading } from './fortress-power';
import { drawSectionPower, drawSectionStone, sectionRows } from './palace-section-art';
import { isMazeRoom } from './fortress-maze';
import './palace-section.css';

const annotations = {
  sluice: { place:'双层柱廊', text:'王门后方的双层柱廊托着环城。两口竖井穿过蓄水池，铜箍内的亮带向上爬，越过拱顶接入街区。', route:'从南门进殿，沿中央石桥向北走。潮盘后的王阶通往御水长庭。' },
  aqueduct: { place:'御水仪道', text:'两侧的池庭接住高处落水。穿过横桥，可以在铜框观察窗里看到从陵宫送上来的能量。', route:'沿南北仪道直行可到下一层。西廊分水仪控制两侧支渠。' },
  catacomb: { place:'环形星庭', text:'霜沿着抽能井的铜箍凝结。封印室的第一股脉冲在此汇合，沿管壁送往上一层。', route:'穿过中央环廊，北侧王阶通往冰核封印殿。西廊另有升降台直达水殿。' },
  seal: { place:'封印观测桥', text:'整座城市只有这一个能源。采能环接在酋雷姆两侧的冰晶上，冰蓝色能流从罩壁转入竖井，最终点亮地表。', route:'从南端走到观测桥头，靠近封印。可以降低环城负载，或听酋雷姆吼叫。' },
};

export function PalaceSection({room,power,openPlan,openCity}:{
  room:FortressRoom;power:()=>GridReading|undefined;openPlan:(button:HTMLElement)=>void;openCity:(button:HTMLElement)=>void;
}) {
  const [selected,select]=useState(room);
  const surface=useRef<HTMLCanvasElement>(null);
  const [reading,setReading]=useState(()=>power()??nominalPower);
  useEffect(()=>{
    const canvas=surface.current;
    if(!canvas)return;
    const p=canvas.getContext('2d');
    if(!p)return;
    const stone=document.createElement('canvas');
    const pen=stone.getContext('2d')!;
    const sprite=new Image();
    sprite.src=import.meta.env.BASE_URL+'assets/kyurem-bw.png';
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    let previous=-Infinity, previousValue=-Infinity, handle=0;
    function size(){
      const bounds=canvas!.getBoundingClientRect();
      const w=Math.max(1,Math.round(bounds.width*Math.min(2,devicePixelRatio||1))),h=Math.round(w*370/600);
      if(w===canvas!.width&&h===canvas!.height&&stone.width===w)return;
      canvas!.width=stone.width=w;canvas!.height=stone.height=h;
      pen.setTransform(w/600,0,0,h/370,0,0);drawSectionStone(pen,selected);
      previous=-Infinity;
    }
    function paint(time:number){
      if(!document.hidden && time-previous>=(preference.matches?240:75)){
        previous=time;
        const sample=power()??nominalPower,w=canvas!.width,h=canvas!.height;
        p!.setTransform(1,0,0,1,0,0);p!.drawImage(stone,0,0);
        p!.setTransform(w/600,0,0,h/370,0,0);drawSectionPower(p!,sample,preference.matches,sprite,selected,room);
        if(time-previousValue>=360){setReading(sample);previousValue=time;}
      }
      handle=requestAnimationFrame(paint);
    }
    size();const observer=new ResizeObserver(size);observer.observe(canvas);
    handle=requestAnimationFrame(paint);
    return ()=>{observer.disconnect();cancelAnimationFrame(handle);};
  },[selected,room,power]);
  const note=annotations[selected];
  return <div className="palace-section">
    <figure><canvas ref={surface} width="600" height="370" role="img" aria-label="地宫纵剖面。海面上的环城坐落在四层殿堂上，两条采能竖井自冰核封印殿向上贯穿城市。"
      onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect(), y=(event.clientY-bounds.top)*370/bounds.height;
        if(y>68) select(fortressOrder.reduce((nearest,r)=>Math.abs(sectionRows[r]-14-y)<Math.abs(sectionRows[nearest]-14-y)?r:nearest));}}/>
      <figcaption><span>▸ 你在 {fortressRooms[room].level} · {fortressRooms[room].name}</span><span>环城负载 <b>{Math.round(reading.city*100)}%</b></span></figcaption>
    </figure>
    <div className="palace-levels" role="group" aria-label="查看地宫楼层">
      {fortressOrder.map(r=><button type="button" key={r} aria-pressed={selected===r} onClick={()=>select(r)}>
        <b>{fortressRooms[r].level}</b><span>{fortressRooms[r].name}</span></button>)}
    </div>
    <section aria-live="polite" className="palace-note"><h3>{note.place}</h3><p>{note.text}</p><p><Footprints size={16} aria-hidden="true"/>{note.route}</p></section>
    <div className="save-actions">
      {selected===room&&isMazeRoom(room)&&<button type="button" className="primary-button" data-panel-entry="section-plan" onClick={event=>openPlan(event.currentTarget)}><Map size={16}/>展开本层平面</button>}
      <button type="button" className="subtle-button" data-panel-entry="section-city" onClick={event=>openCity(event.currentTarget)}><Navigation size={15}/>查看地表环城</button>
    </div>
  </div>;
}
