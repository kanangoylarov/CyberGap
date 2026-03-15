import { Link } from 'react-router-dom';

interface CartSummaryProps {
  totalItems: number;
  totalPrice: number;
}

export default function CartSummary({ totalItems, totalPrice }: CartSummaryProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-gray-600">
          <span>Items</span>
          <span>{totalItems}</span>
        </div>
        <div className="flex justify-between text-gray-900 font-bold text-lg border-t pt-2">
          <span>Subtotal</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <Link
        to="/checkout"
        className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors"
      >
        Proceed to Checkout
      </Link>

      <Link
        to="/"
        className="block w-full text-center text-blue-600 hover:text-blue-800 mt-3 font-medium transition-colors"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
