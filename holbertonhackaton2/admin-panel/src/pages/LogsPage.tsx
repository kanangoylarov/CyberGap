import { useState, useMemo, useRef, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ATTACK_TYPE_MAP } from '@/types';
import type { LogEntry } from '@/types';
import LogTable from '@/components/LogTable';
import LiveIndicator from '@/components/LiveIndicator';

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function LogsPage() {
  const { messages, isConnected, clearMessages } = useWebSocket();
  const [attackFilter, setAttackFilter] = useState<number | null>(null);
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const frozenLogsRef = useRef<LogEntry[]>([]);

  const filteredLogs = useMemo(() => {
    let logs = messages;

    if (attackFilter !== null) {
      logs = logs.filter((log) => log.attack_type === attackFilter);
    }

    if (methodFilter !== 'ALL') {
      logs = logs.filter((log) => log.method === methodFilter);
    }

    return logs;
  }, [messages, attackFilter, methodFilter]);

  // Freeze/unfreeze logs on pause toggle
  useEffect(() => {
    if (isPaused) {
      frozenLogsRef.current = filteredLogs;
    }
  }, [isPaused, filteredLogs]);

  const displayLogs = isPaused ? frozenLogsRef.current : filteredLogs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Logs</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time request stream via WebSocket
          </p>
        </div>
        <LiveIndicator isConnected={isConnected} />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-gray-800 rounded-lg p-4 border border-gray-700/50">
        {/* Attack Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 whitespace-nowrap">Attack Type:</label>
          <select
            value={attackFilter === null ? '' : String(attackFilter)}
            onChange={(e) =>
              setAttackFilter(e.target.value === '' ? null : parseInt(e.target.value, 10))
            }
            className="bg-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Types</option>
            {Object.entries(ATTACK_TYPE_MAP).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
        </div>

        {/* Method Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 whitespace-nowrap">Method:</label>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className={`px-4 py-1.5 text-sm rounded font-medium transition-colors ${
              isPaused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
          >
            {isPaused ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Resume
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                Pause
              </span>
            )}
          </button>
          <button
            onClick={clearMessages}
            className="px-4 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Count */}
        <div className="text-sm text-gray-400">
          {displayLogs.length.toLocaleString()} entries
        </div>
      </div>

      {/* Log Table */}
      <LogTable logs={displayLogs} isLive={isConnected && !isPaused} />
    </div>
  );
}

export default LogsPage;
