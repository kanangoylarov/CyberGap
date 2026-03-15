import type { FingerprintSummary } from '@/types';
import AttackBadge from './AttackBadge';

interface FingerprintTableProps {
  items: FingerprintSummary[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FingerprintTable({ items, total, page, perPage, onPageChange }: FingerprintTableProps) {
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Fingerprint
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                IP
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Attack Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Confidence
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Hit Count
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                First Seen
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No fingerprints found
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.fingerprint}
                  className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-blue-400 bg-gray-900/50 px-1.5 py-0.5 rounded">
                      {item.fingerprint.substring(0, 12)}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                    {item.source_ip}
                  </td>
                  <td className="px-4 py-3">
                    <AttackBadge attackType={item.attack_type} label={item.attack_label} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {(item.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-medium">
                    {item.hit_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDate(item.first_seen)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDate(item.last_seen)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            Showing {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} of{' '}
            {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    pageNum === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FingerprintTable;
