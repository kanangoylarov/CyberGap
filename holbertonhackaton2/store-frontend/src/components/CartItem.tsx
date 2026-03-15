import type { CartItem as CartItemType } from '@/types';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemove: (itemId: number) => void;
}

export default function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const lineTotal = item.quantity * item.product.price;

  return (
    <div className="flex items-center gap-4 bg-white rounded-lg shadow p-4">
      <img
        src={item.product.image_url}
        alt={item.product.name}
        className="w-20 h-20 object-cover rounded-md"
      />

      <div className="flex-grow">
        <h3 className="text-lg font-semibold text-gray-900">{item.product.name}</h3>
        <p className="text-gray-600">${item.product.price.toFixed(2)}</p>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          disabled={item.quantity <= 1}
          className={`w-8 h-8 rounded-md flex items-center justify-center font-bold transition-colors ${
            item.quantity <= 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          -
        </button>

        <span className="w-10 text-center font-medium text-gray-900">
          {item.quantity}
        </span>

        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          className="w-8 h-8 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-center font-bold transition-colors"
        >
          +
        </button>
      </div>

      <div className="text-right min-w-[80px]">
        <p className="text-lg font-bold text-gray-900">${lineTotal.toFixed(2)}</p>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="text-red-500 hover:text-red-700 transition-colors p-1"
        aria-label="Remove item"
      >
        <svg
          className="h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
