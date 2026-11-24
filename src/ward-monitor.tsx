import { Ear, Wrench } from 'lucide-react';
import { nearbyWardPost, wardSide, type WardReading, type WardSurvey } from './fortress-ward-service';

type Props = {
  survey: WardSurvey; reading: WardReading; location: { x: number; y: number };
  hint: string; disabled: boolean; pulse: () => void; interact: () => void;
};

export function WardMonitor({ survey, reading, location, hint, disabled, pulse, interact }: Props) {
  const post = nearbyWardPost(location);
  const local = post && reading.inspected === post.id;
  const loose = local && survey.phase === 'seeking' && post.id === survey.fault;
  const double = local ? loose : survey.phase === 'seeking' && reading.heard;
  const signal = double ? 'M0 16H11L14 10 17 26 20 5 24 20 27 16H41L44 12 47 22 50 8 54 18 57 16H76'
    : (local || survey.phase === 'stable' ? 'M0 16H20L23 11 26 23 29 5 33 18 37 16H76' : 'M0 16H76');
  const title = post?.name ?? (survey.phase === 'stable' ? '封印复测通过' : survey.phase === 'braced' ? '锁链已收紧' :
    reading.heard ? wardSide(survey.fault) + '回震' : '锁链听诊器');
  return <div className="game-controls ward-monitor">
    <svg aria-hidden="true" className="ward-trace" data-double={double || undefined} viewBox="0 0 76 32">
      <path d="M0 8H76M0 16H76M0 24H76M15 0V32M30 0V32M45 0V32M60 0V32" stroke="#305053" strokeWidth=".7"/>
      <path d={signal} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    </svg>
    <div className="ward-readout"><strong>{title}</strong><span role="status">{hint}</span></div>
    {survey.phase === 'seeking' && <div className="ward-actions">
      {post && <button type="button" className="fortress-action" disabled={disabled} onClick={interact}><Wrench size={14}/>{loose ? '收紧锁链' : '检查锚柱'}</button>}
      <button type="button" className="fortress-replay" disabled={disabled || reading.sampling} onClick={pulse}><Ear size={14}/>再听一次回震</button>
    </div>}
  </div>;
}
