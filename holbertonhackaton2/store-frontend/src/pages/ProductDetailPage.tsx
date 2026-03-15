import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '@/hooks/useProduct';
import { cartApi } from '@/api/client';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, loading, error } = useProduct(Number(id));
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await cartApi.add({ product_id: product.id, quantity });
      window.dispatchEvent(new Event('cart-updated'));
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 1000);
    } catch {
      // Error handled by API interceptor
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !product) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
        <p className="text-gray-600 mb-6">
          {error || 'The product you are looking for does not exist.'}
        </p>
        <Link
          to="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Back to Products
        </Link>
      </div>
    );
  }

  const isOutOfStock = product.stock === 0;

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium mb-6 transition-colors"
      >
        <svg
          className="h-5 w-5 mr-1"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="rounded-lg overflow-hidden shadow-md">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-96 object-cover"
          />
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <div className="mb-3">
            <span className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
              {product.category}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

          <p className="text-3xl font-bold text-gray-900 mb-6">
            ${product.price.toFixed(2)}
          </p>

          <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>

          {/* Stock Status */}
          <div className="mb-6">
            {isOutOfStock ? (
              <span className="inline-flex items-center text-red-600 font-medium">
                <svg
                  className="h-5 w-5 mr-1"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Out of Stock
              </span>
            ) : (
              <span className="inline-flex items-center text-green-600 font-medium">
                <svg
                  className="h-5 w-5 mr-1"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                In Stock ({product.stock} available)
              </span>
            )}
          </div>

          {/* Quantity Selector & Add to Cart */}
          {!isOutOfStock && (
            <div className="flex items-center gap-4 mb-6">
              <label htmlFor="quantity" className="text-gray-700 font-medium">
                Quantity:
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                max={product.stock}
                value={quantity}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(product.stock, Number(e.target.value)));
                  setQuantity(val);
                }}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className={`w-full sm:w-auto px-8 py-3 rounded-md font-medium text-lg transition-colors ${
              isOutOfStock
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : addedSuccess
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {adding ? 'Adding...' : addedSuccess ? 'Added!' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
