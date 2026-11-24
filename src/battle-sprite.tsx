import type { BattleSide } from './battle-turn';
import { creatures, type CreatureId } from './creatures';

// All clips use the same canvas width. The original height and ground line differ by species and view.
const heights: Record<CreatureId, [front: number, back: number]> = {
  piplup: [41, 41], starly: [41, 42], shinx: [38, 39], buizel: [49, 49],
  drifloon: [69, 70], riolu: [50, 50], gible: [54, 51], snover: [56, 55],
};

export function BattleSprite({ id, side, still = false }: { id: CreatureId; side: BattleSide; still?: boolean }) {
  const view = side === 'ally' ? 'back' : 'front';
  const base = `${import.meta.env.BASE_URL}assets/battle/${id}-${view}`;
  return <img className="creature-sprite battle-sprite" data-species={id} data-view={view}
    src={`${base}.${still ? 'png' : 'webp'}`} width={76} height={heights[id][side === 'ally' ? 1 : 0]} alt={creatures[id].name}
    draggable={false} onError={event => {
      if (event.currentTarget.src.endsWith('.webp')) event.currentTarget.src = `${base}.png`;
    }} />;
}
