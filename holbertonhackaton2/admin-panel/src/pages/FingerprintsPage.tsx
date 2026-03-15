import { useState, useCallback, useRef } from 'react';
import { useFingerprints } from '@/hooks/useFingerprints';
import FingerprintTable from '@/components/FingerprintTable';

function FingerprintsPage() {
  const [page, setPage] = useState(1);
  const perPage = 20;
  const { data, loading, error } = useFingerprints(page, perPage);

  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 300);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Filter items client-side based on search (if API doesn't handle it)
  const filteredItems = data?.items.filter((item) => {
    if (!searchInput) return true;
    const q = searchInput.toLowerCase();
    return (
      item.fingerprint.toLowerCase().includes(q) ||
      item.source_ip.toLowerCase().includes(q) ||
      item.attack_label.toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fingerprints</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browser fingerprint tracking and analysis
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by fingerprint, IP, or attack type..."
          value={searchInput}
          onChange={handleSearch}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-500"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <FingerprintTable
          items={filteredItems}
          total={data?.total ?? 0}
          page={page}
          perPage={perPage}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

export default FingerprintsPage;
