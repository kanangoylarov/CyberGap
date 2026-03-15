import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { AttackBreakdown as AttackBreakdownType } from '@/types';
import { ATTACK_TYPE_MAP } from '@/types';

interface AttackBreakdownProps {
  data: AttackBreakdownType[];
}

const COLORS = [
  '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899',
  '#06B6D4', '#F97316', '#84CC16', '#E11D48', '#6366F1',
];

function getColor(attackType: number): string {
  return COLORS[attackType % COLORS.length];
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: {
    attack_label: string;
    count: number;
    percentage: number;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-white">{item.payload.attack_label}</p>
      <p className="text-xs text-gray-400">
        {item.payload.count.toLocaleString()} ({item.payload.percentage.toFixed(1)}%)
      </p>
    </div>
  );
}

function AttackBreakdown({ data }: AttackBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700/50 flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">No attack data available</p>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.attack_label,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700/50">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Attack Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="count"
              nameKey="name"
            >
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.attack_type}`}
                  fill={getColor(entry.attack_type)}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-4 space-y-2">
        {data.map((item) => {
          const info = ATTACK_TYPE_MAP[item.attack_type];
          return (
            <div key={item.attack_type} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getColor(item.attack_type) }}
                />
                <span className="text-gray-300">{info?.label || item.attack_label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">{item.count.toLocaleString()}</span>
                <span className="text-gray-500 text-xs w-14 text-right">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AttackBreakdown;
