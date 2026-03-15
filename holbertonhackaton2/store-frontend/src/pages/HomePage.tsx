import { useState, useEffect, useCallback } from 'react';
import { productApi, cartApi } from '@/api/client';
import { useProducts } from '@/hooks/useProducts';
import SearchBar from '@/components/SearchBar';
import CategoryFilter from '@/components/CategoryFilter';
import ProductGrid from '@/components/ProductGrid';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  const { data, loading, error } = useProducts({
    search: searchQuery || undefined,
    category: selectedCategory || undefined,
    page,
    per_page: 12,
  });

  const products = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  useEffect(() => {
    productApi.categories().then((res) => {
      setCategories(res.data);
    }).catch(() => {
      // Categories failed to load silently
    });
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setPage(1);
  }, []);

  const handleAddToCart = useCallback(async (productId: number) => {
    try {
      await cartApi.add({ product_id: productId, quantity: 1 });
      window.dispatchEvent(new Event('cart-updated'));
      setAddedProductId(productId);
      setTimeout(() => setAddedProductId(null), 1000);
    } catch {
      // Error handled by API interceptor
    }
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Our Products</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-grow">
          <SearchBar value={searchQuery} onChange={handleSearchChange} />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mb-8">
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={handleCategoryChange}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {addedProductId !== null && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-pulse">
          Added to cart!
        </div>
      )}

      <ProductGrid
        products={products}
        loading={loading}
        onAddToCart={handleAddToCart}
      />

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              page <= 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Previous
          </button>

          <span className="text-gray-700 font-medium">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              page >= totalPages
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
