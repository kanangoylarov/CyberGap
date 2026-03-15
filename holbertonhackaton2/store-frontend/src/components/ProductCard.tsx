import { Link } from 'react-router-dom';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: number) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const isOutOfStock = product.stock === 0;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col">
      <Link to={`/products/${product.id}`} className="block">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      </Link>

      <div className="p-4 flex flex-col flex-grow">
        <div className="mb-2">
          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
            {product.category}
          </span>
        </div>

        <Link
          to={`/products/${product.id}`}
          className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-1"
        >
          {product.name}
        </Link>

        <p className="text-xl font-bold text-gray-900 mt-auto mb-4">
          ${product.price.toFixed(2)}
        </p>

        <button
          onClick={() => onAddToCart(product.id)}
          disabled={isOutOfStock}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            isOutOfStock
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
