import { useEffect, useState, type RefObject } from 'react';
import { Gauge } from 'lucide-react';
import type { FieldControls } from './field';
import { nominalPower } from './fortress-power';
import './fortress-power.css';

const instruments = [
  { key: 'source', label: '封印采能', detail: '感应环从酋雷姆的冰晶汲取能量。' },
  { key: 'bus', label: '上行母线', detail: '两支母线把能量输往上层宫殿。' },
  { key: 'city', label: '环城照明', detail: '地面路灯、楼窗和塔冠正在使用这条线路。' },
] as const;

export function GridMonitor({ controller, limited, disabled }: {
  controller: RefObject<FieldControls | null>; limited: boolean; disabled: boolean;
}) {
  const [reading, setReading] = useState(() => controller.current?.powerReading() ?? nominalPower);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && controller.current) setReading(controller.current.powerReading());
    }, 180);
    return () => window.clearInterval(timer);
  }, [controller]);

  return <section className="power-console" aria-label="酋雷姆采能回路" data-limited={limited}>
    <div className="power-console-id"><Gauge size={17} aria-hidden="true" /><strong>酋雷姆采能回路</strong></div>
    <div className="power-instruments">
      {instruments.map(({ key, label, detail }) => {
        const percent = Math.round(reading[key] * 100);
        return <label key={key} title={detail}>
          <span>{label}</span>
          <meter aria-label={label} aria-description={detail} min={0} max={100} value={percent} />
          <b>{percent}%</b>
        </label>;
      })}
    </div>
    <button type="button" className="fortress-replay" disabled={disabled} aria-pressed={limited}
      onClick={() => controller.current?.toggleGridLoad()}>{limited ? '恢复环城供能' : '降低环城负载'}</button>
  </section>;
}
