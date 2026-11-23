import { cityCourtyards, type CityCourtyard } from './field-city-layout';
import { maps } from './field-layout';

export type SurveyId = CityCourtyard['kind'];
export type CityStopId = SurveyId | 'archive' | 'clinic' | 'greenway' | 'ferry';
export type StreetPoint = { x: number; y: number };
export type CityStop = {
  id: CityStopId;
  name: string;
  subject: string;
  position: StreetPoint;
  approaches: StreetPoint[];
  survey?: SurveyId;
};

export const courtNotes: Record<SurveyId, { subject: string; note: string }> = {
  wharf: { subject: '手摇水泵', note: '转了两圈手柄，弯管里冒出一股水，落进轮边的石槽。松开手，槽里的细纹又荡了一会儿。' },
  garden: { subject: '石砌蕨床', note: '花床中央的蕨叶向外舒展，矮石沿两头各坐着一张长椅。穿过这片街区的人可以在这里歇脚。' },
  market: { subject: '盐市方尖碑', note: '沿三级石台向上看，窄窄的碑身收成一个尖顶。买卖人留下的铜铭牌嵌在基座两面，站到跟前才看得见。' },
  station: { subject: '信号场站钟', note: '站钟的长短针装在同一根轴上。钟下的铁柱分段加粗，一直落到石座，旁边还留着旧信号柜。' },
};

function courtyardStop(court: CityCourtyard): CityStop & { survey: SurveyId } {
  const f = court.feature;
  const approaches: StreetPoint[] = [];
  for (let y = court.z; y < court.z + court.depth; y++) {
    for (let x = court.x; x < court.x + court.width; x++) {
      const dx = Math.max(f.x - x, x - (f.x + f.width - 1), 0);
      const dy = Math.max(f.z - y, y - (f.z + f.depth - 1), 0);
      if (dx + dy === 1) approaches.push({ x, y });
    }
  }
  return {
    id: court.kind, name: court.label, subject: courtNotes[court.kind].subject, survey: court.kind,
    position: { x: f.x + f.width / 2, y: f.z + f.depth / 2 }, approaches,
  };
}

export const surveyStops = cityCourtyards.map(courtyardStop);

function serviceStop(id: CityStopId, name: string, subject: string, point: StreetPoint): CityStop {
  return { id, name, subject, approaches: [point], position: { x: point.x + .5, y: point.y + .5 } };
}

const ferry = maps.harbor.exits[0];
export const cityStops: readonly CityStop[] = [
  ...surveyStops,
  serviceStop('archive', '潮汐档案屋', '在门口互动，进屋翻看档案。', { x: 10, y: 11 }),
  serviceStop('clinic', '环城补给站', '与医师交谈，恢复体力和招式次数。', { x: 18, y: 11 }),
  serviceStop('greenway', '外环绿廊', '从路边进入高草，寻找野生宝可梦。', { x: 29, y: 14 }),
  serviceStop('ferry', '东渡口', '从栈桥尽头再走一步，去往雾杉小径。', { x: ferry.x, y: ferry.y - 1 }),
];

export function surveyAt(point: StreetPoint) {
  return surveyStops.find(stop => stop.approaches.some(tile => tile.x === point.x && tile.y === point.y));
}
