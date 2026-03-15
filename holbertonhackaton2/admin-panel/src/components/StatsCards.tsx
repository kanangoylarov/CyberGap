import type { OverviewStats } from '@/types';

interface StatsCardsProps {
  stats: OverviewStats | null;
  loading: boolean;
}

interface CardDef {
  title: string;
  getValue: (s: OverviewStats) => string;
  getSubtext?: (s: OverviewStats) => string;
  accent: string;
  accentBg: string;
  icon: JSX.Element;
}

const cards: CardDef[] = [
  {
    title: 'Total Requests',
    getValue: (s) => s.total_requests.toLocaleString(),
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: 'Attacks Detected',
    getValue: (s) => s.total_attacks.toLocaleString(),
    getSubtext: (s) => `${s.attack_rate.toFixed(1)}% attack rate`,
    accent: 'text-red-400',
    accentBg: 'bg-red-500/10',
    icon: (
      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  {
    title: 'Unique IPs',
    getValue: (s) => s.unique_ips.toLocaleString(),
    accent: 'text-yellow-400',
    accentBg: 'bg-yellow-500/10',
    icon: (
      <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    title: 'Avg Confidence',
    getValue: (s) => `${(s.avg_confidence * 100).toFixed(1)}%`,
    accent: 'text-green-400',
    accentBg: 'bg-green-500/10',
    icon: (
      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 bg-gray-700 rounded" />
        <div className="h-8 w-8 bg-gray-700 rounded" />
      </div>
      <div className="h-8 w-20 bg-gray-700 rounded mb-2" />
      <div className="h-3 w-16 bg-gray-700 rounded" />
    </div>
  );
}

function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400">{card.title}</h3>
              <div className={`p-2 rounded-lg ${card.accentBg}`}>{card.icon}</div>
            </div>
            <p className={`text-2xl font-bold ${card.accent}`}>--</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-gray-800 rounded-lg p-6 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">{card.title}</h3>
            <div className={`p-2 rounded-lg ${card.accentBg}`}>{card.icon}</div>
          </div>
          <p className={`text-2xl font-bold ${card.accent}`}>{card.getValue(stats)}</p>
          {card.getSubtext && (
            <p className="text-xs text-gray-400 mt-1">{card.getSubtext(stats)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default StatsCards;
