import { ATTACK_TYPE_MAP } from '../types';

interface AttackBadgeProps {
  attackType: number;
  label?: string;
}

function AttackBadge({ attackType, label }: AttackBadgeProps) {
  const info = ATTACK_TYPE_MAP[attackType] || ATTACK_TYPE_MAP[0];
  const displayLabel = label || info.label;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.bg} ${info.text}`}>
      {displayLabel}
    </span>
  );
}

export default AttackBadge;
