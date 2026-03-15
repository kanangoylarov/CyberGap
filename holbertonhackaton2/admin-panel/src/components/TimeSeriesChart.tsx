import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  bucketSize: string;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400 mb-1">
        {label ? new Date(label).toLocaleString() : ''}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700/50 flex items-center justify-center h-[300px]">
        <p className="text-gray-400 text-sm">No time series data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700/50">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Traffic Over Time</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimestamp}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              stroke="#4B5563"
            />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              stroke="#4B5563"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              fill="#3B82F6"
              fillOpacity={0.1}
              stroke="transparent"
            />
            <Area
              type="monotone"
              dataKey="attacks"
              fill="#EF4444"
              fillOpacity={0.1}
              stroke="transparent"
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              name="Total"
            />
            <Line
              type="monotone"
              dataKey="attacks"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
              name="Attacks"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TimeSeriesChart;
