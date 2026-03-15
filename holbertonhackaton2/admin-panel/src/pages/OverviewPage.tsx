import { useState, useEffect, useCallback } from 'react';
import { useStats } from '@/hooks/useStats';
import { fetchBreakdown, fetchTimeseries } from '@/api/client';
import type { AttackBreakdown as AttackBreakdownType, TimeSeriesPoint } from '@/types';
import StatsCards from '@/components/StatsCards';
import TimeSeriesChart from '@/components/TimeSeriesChart';
import AttackBreakdown from '@/components/AttackBreakdown';

function OverviewPage() {
  const { data: stats, loading: statsLoading } = useStats();
  const [breakdown, setBreakdown] = useState<AttackBreakdownType[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [bucketSize, setBucketSize] = useState('1h');

  const loadCharts = useCallback(async () => {
    try {
      const [breakdownData, tsData] = await Promise.all([
        fetchBreakdown(),
        fetchTimeseries(undefined, bucketSize),
      ]);
      setBreakdown(breakdownData);
      setTimeseries(tsData.points);
    } catch {
      // Errors handled silently; stats hook handles its own errors
    }
  }, [bucketSize]);

  useEffect(() => {
    loadCharts();
    const interval = setInterval(loadCharts, 30000);
    return () => clearInterval(interval);
  }, [loadCharts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Real-time honeypot monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Bucket:</label>
          <select
            value={bucketSize}
            onChange={(e) => setBucketSize(e.target.value)}
            className="bg-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="5m">5 min</option>
            <option value="15m">15 min</option>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="1d">1 day</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} loading={statsLoading} />

      {/* Charts Row */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[70%]">
          <TimeSeriesChart data={timeseries} bucketSize={bucketSize} />
        </div>
        <div className="lg:w-[30%]">
          <AttackBreakdown data={breakdown} />
        </div>
      </div>
    </div>
  );
}

export default OverviewPage;
