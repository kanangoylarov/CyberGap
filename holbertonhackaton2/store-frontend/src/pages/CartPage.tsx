import { Link } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import CartItemComponent from '@/components/CartItem';
import CartSummary from '@/components/CartSummary';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

export default function CartPage() {
  const { items, loading, error, updateItem, removeItem, totalItems, totalPrice } = useCart();

  const handleUpdateQuantity = async (itemId: number, quantity: number) => {
    if (quantity < 1) return;
    await updateItem(itemId, { quantity });
  };

  const handleRemove = async (itemId: number) => {
    await removeItem(itemId);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
        <EmptyState message="Your cart is empty" />
        <div className="text-center mt-4">
          <Link
            to="/"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <CartItemComponent
              key={item.id}
              item={item}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <CartSummary totalItems={totalItems} totalPrice={totalPrice} />
          </div>
        </div>
      </div>
    </div>
  );
}
