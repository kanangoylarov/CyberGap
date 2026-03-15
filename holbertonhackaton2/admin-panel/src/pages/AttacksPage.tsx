import { useState, useEffect, useCallback } from 'react';
import { fetchBreakdown } from '@/api/client';
import type { AttackBreakdown as AttackBreakdownType } from '@/types';
import { ATTACK_TYPE_MAP } from '@/types';
import AttackBreakdown from '@/components/AttackBreakdown';

const TIME_RANGES = [
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'All Time', value: '' },
];

function AttacksPage() {
  const [breakdown, setBreakdown] = useState<AttackBreakdownType[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBreakdown(timeRange || undefined);
      setBreakdown(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCount = breakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attack Analysis</h1>
          <p className="text-sm text-gray-400 mt-1">Breakdown of detected attack types</p>
        </div>
        <div className="flex items-center gap-2">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                timeRange === tr.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          {/* Large Chart */}
          <div className="max-w-xl mx-auto">
            <AttackBreakdown data={breakdown} />
          </div>

          {/* Detailed Table */}
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-400">
                Attack Types Detail ({totalCount.toLocaleString()} total)
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Distribution
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item, idx) => {
                  const info = ATTACK_TYPE_MAP[item.attack_type];
                  return (
                    <tr
                      key={item.attack_type}
                      className={`border-b border-gray-700/50 ${
                        idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'
                      }`}
                    >
                      <td className="px-6 py-3">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
                          style={{
                            backgroundColor: info?.color + '20',
                            color: info?.color,
                          }}
                        >
                          {item.attack_type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-300 font-medium">
                        {info?.label || item.attack_label}
                      </td>
                      <td className="px-6 py-3 text-gray-300 text-right font-mono">
                        {item.count.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-gray-300 text-right">
                        {item.percentage.toFixed(1)}%
                      </td>
                      <td className="px-6 py-3">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: info?.color || '#6B7280',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AttacksPage;
