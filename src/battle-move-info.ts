import { accuracyChance, ailmentLabels, effectiveness, movePP, moves, stageLabels, typeLabels, type Move, type MoveId, type TeamMember } from './creatures';

const categories = { physical: '物理', special: '特殊', status: '变化' } as const;

function describeEffect(move: Move) {
  const effect = move.effect;
  if (!effect) return move.highCritical ? '较易击中要害' : '';
  const chance = effect.chance < 1 ? `${Math.round(effect.chance * 100)}% 概率` : '';
  switch (effect.kind) {
    case 'stage': {
      const target = effect.target === 'self' ? '自身' : '对手的';
      return `${chance}${effect.amount > 0 ? '提升' : '降低'}${target}${stageLabels[effect.stat]} ${Math.abs(effect.amount)} 级`;
    }
    case 'flinch': return `先行动时有 ${chance}使对手畏缩`;
    case 'ailment': return `${chance}使对手陷入${ailmentLabels[effect.ailment]}`;
    case 'boost': return `${chance}提升自身攻击、防御、特攻、特防和速度`;
  }
}

export function describeMove(id: MoveId, member: TeamMember, opponent?: TeamMember, accuracyStage = 0) {
  const move = moves[id];
  const remaining = movePP(member, id);
  const modifier = opponent ? effectiveness(id, opponent.id) : 1;
  const type = id === 'struggle' ? '无属性' : typeLabels[move.type];
  const currentAccuracy = Math.round(accuracyChance(move, accuracyStage) * 100);
  const accuracy = move.accuracy === null ? '必中' : `命中 ${currentAccuracy}%${currentAccuracy !== move.accuracy ? `（基础 ${move.accuracy}%）` : ''}`;
  const matchup = !modifier ? '无效' : modifier > 1 ? '效果绝佳' : modifier < 1 ? '效果减弱' : '';
  const description = [type, categories[move.category], id === 'struggle' ? '招式 PP 耗尽时可用' : `PP ${remaining}/${move.pp}`,
    move.power && `威力 ${move.power}`, accuracy, move.priority > 0 && `优先度 +${move.priority}`, matchup && `${matchup}（×${modifier}）`,
    id === 'struggle' ? '使用者受到反作用力伤害' : describeEffect(move)].filter(Boolean).join(' · ');
  return { move, category: categories[move.category], remaining, modifier, type, matchup, description };
}
