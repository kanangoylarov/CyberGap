import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cartApi } from '@/api/client';

export default function Navbar() {
  const [totalItems, setTotalItems] = useState<number>(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const response = await cartApi.get();
      const count = response.data.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      setTotalItems(count);
    } catch {
      setTotalItems(0);
    }
  }, []);

  useEffect(() => {
    fetchCartCount();

    const handleCartUpdated = () => {
      fetchCartCount();
    };

    window.addEventListener('cart-updated', handleCartUpdated);
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdated);
    };
  }, [fetchCartCount]);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <svg
              className="h-8 w-8 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span className="text-xl font-bold text-gray-900">Store</span>
          </Link>

          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Products
            </Link>

            <Link
              to="/cart"
              className="relative text-gray-700 hover:text-blue-600 transition-colors"
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
