import type { LogEntry } from '@/types';
import AttackBadge from './AttackBadge';

interface LogTableProps {
  logs: LogEntry[];
  isLive: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-cyan-400',
};

function formatTime(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

function LogTable({ logs, isLive }: LogTableProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-800 z-10">
            <tr className="border-b border-gray-700">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">
                Time
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-28">
                IP
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-16">
                Method
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Path
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">
                Attack
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">
                Conf.
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  {isLive ? 'Waiting for incoming requests...' : 'No log entries'}
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr
                  key={`${log.id}-${idx}`}
                  className={`border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors ${
                    idx === 0 && isLive ? 'animate-pulse-once' : ''
                  } ${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}
                >
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono text-xs whitespace-nowrap">
                    {log.source_ip}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`font-mono text-xs font-bold ${METHOD_COLORS[log.method] || 'text-gray-300'}`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-xs font-mono">
                    <span title={log.path}>{truncate(log.path, 60)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <AttackBadge attackType={log.attack_type} label={log.attack_label} />
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-xs">
                    {(log.confidence * 100).toFixed(0)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogTable;
