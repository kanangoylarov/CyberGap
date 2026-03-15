import type { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onAddToCart: (productId: number) => void;
}

export default function ProductGrid({ products, loading, onAddToCart }: ProductGridProps) {
  if (loading) {
    return <LoadingSpinner />;
  }

  if (products.length === 0) {
    return <EmptyState message="No products found." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}
