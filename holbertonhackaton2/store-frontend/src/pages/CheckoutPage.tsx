import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { useCart } from '@/hooks/useCart';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Order } from '@/types';

interface FormData {
  customer_name: string;
  customer_email: string;
  shipping_address: string;
}

interface FormErrors {
  customer_name?: string;
  customer_email?: string;
  shipping_address?: string;
}

export default function CheckoutPage() {
  const { createOrder, loading: submitting, error: orderError } = useOrders();
  const { items, totalPrice, loading: cartLoading } = useCart();

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    customer_email: '',
    shipping_address: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.customer_name.trim()) {
      errors.customer_name = 'Name is required';
    }

    if (!formData.customer_email.trim()) {
      errors.customer_email = 'Email is required';
    } else if (!formData.customer_email.includes('@')) {
      errors.customer_email = 'Please enter a valid email address';
    }

    if (!formData.shipping_address.trim()) {
      errors.shipping_address = 'Shipping address is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const order = await createOrder({
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim(),
        shipping_address: formData.shipping_address.trim(),
      });
      setConfirmedOrder(order);
      window.dispatchEvent(new Event('cart-updated'));
    } catch {
      // Error is set in the hook
    }
  };

  // Confirmation View
  if (confirmedOrder) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg
              className="h-8 w-8 text-green-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">Thank you for your purchase.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8 text-left">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Order ID</span>
              <span className="font-semibold text-gray-900">#{confirmedOrder.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span className="font-semibold text-gray-900">
                ${confirmedOrder.total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className="inline-block bg-yellow-100 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded">
                {confirmedOrder.status}
              </span>
            </div>
          </div>
        </div>

        <Link
          to="/"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (cartLoading) {
    return <LoadingSpinner />;
  }

  // Empty cart redirect hint
  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout</h1>
        <p className="text-gray-600 mb-6">Your cart is empty. Add some products first.</p>
        <Link
          to="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  // Form View
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      {orderError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {orderError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Shipping Information</h2>

            {/* Customer Name */}
            <div>
              <label
                htmlFor="customer_name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Name
              </label>
              <input
                type="text"
                id="customer_name"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  formErrors.customer_name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="John Doe"
              />
              {formErrors.customer_name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.customer_name}</p>
              )}
            </div>

            {/* Customer Email */}
            <div>
              <label
                htmlFor="customer_email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                type="email"
                id="customer_email"
                name="customer_email"
                value={formData.customer_email}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  formErrors.customer_email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="john@example.com"
              />
              {formErrors.customer_email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.customer_email}</p>
              )}
            </div>

            {/* Shipping Address */}
            <div>
              <label
                htmlFor="shipping_address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Shipping Address
              </label>
              <textarea
                id="shipping_address"
                name="shipping_address"
                value={formData.shipping_address}
                onChange={handleChange}
                rows={4}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                  formErrors.shipping_address ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="123 Main St, City, State, ZIP"
              />
              {formErrors.shipping_address && (
                <p className="mt-1 text-sm text-red-600">{formErrors.shipping_address}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 px-4 rounded-md font-medium text-lg transition-colors ${
                submitting
                  ? 'bg-blue-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </form>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-2">
                    {item.product.name} x {item.quantity}
                  </span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
