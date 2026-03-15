# Plan 02 -- Store Frontend (React E-Commerce UI)

> **Purpose**: This document is a complete, self-contained implementation specification for the user-facing e-commerce store frontend. Feed this entire file to Claude and it will produce every file listed below, verbatim, with no ambiguity.

---

## 1. Overview

The Store Frontend is a single-page React application that lets customers browse products, manage a shopping cart, and place orders. It communicates exclusively with the backend through a relative `/api` path -- the gateway and Ingress routing are transparent to this app. Session identity is carried via a `session_id` cookie set by the backend.

---

## 2. Tech Stack

| Tool | Version / Notes |
|---|---|
| React | 18.x (createRoot API) |
| TypeScript | 5.x, strict mode |
| Vite | 5.x, build tool + dev server |
| Tailwind CSS | 3.x, utility-first styling |
| React Router | v6 (BrowserRouter, useParams, useNavigate) |
| Axios | 1.x, HTTP client |
| Docker | Multi-stage: `node:20-alpine` build, `nginx:alpine` serve |

No external state management library (Redux, Zustand, etc.) is used. Local component state via `useState` / `useEffect` is sufficient for this scope.

---

## 3. Complete Directory Tree

Every file listed below MUST be generated. No file may be omitted.

```
store-frontend/
├── Dockerfile
├── nginx.conf
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── index.html
├── public/
│   └── favicon.ico          # (placeholder -- generate a minimal valid .ico or leave empty)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── vite-env.d.ts
    ├── api/
    │   └── client.ts
    ├── types/
    │   └── index.ts
    ├── components/
    │   ├── Layout.tsx
    │   ├── Navbar.tsx
    │   ├── ProductCard.tsx
    │   ├── ProductGrid.tsx
    │   ├── CartItem.tsx
    │   ├── CartSummary.tsx
    │   ├── SearchBar.tsx
    │   ├── CategoryFilter.tsx
    │   ├── LoadingSpinner.tsx
    │   └── EmptyState.tsx
    ├── pages/
    │   ├── HomePage.tsx
    │   ├── ProductDetailPage.tsx
    │   ├── CartPage.tsx
    │   └── CheckoutPage.tsx
    ├── hooks/
    │   ├── useProducts.ts
    │   ├── useProduct.ts
    │   ├── useCart.ts
    │   └── useOrders.ts
    └── styles/
        └── index.css
```

---

## 4. Configuration Files

### 4.1 `package.json`

```json
{
  "name": "store-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

### 4.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

### 4.3 `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

**Notes:**
- The `@/` alias maps to `src/` for clean imports.
- The dev server proxy sends `/api` requests to the gateway at `localhost:8000` during local development.

### 4.4 `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
```

### 4.5 `postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 4.6 `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Store</title>
  </head>
  <body class="bg-gray-50 text-gray-900 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 5. Docker & Nginx

### 5.1 `Dockerfile`

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Notes:**
- `npm ci` uses the lockfile for deterministic installs.
- The final image contains only the static build output and nginx. No Node.js runtime.

### 5.2 `nginx.conf`

```nginx
server {
    listen       80;
    server_name  _;

    root   /usr/share/nginx/html;
    index  index.html;

    # Serve static files; fall back to index.html for SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to the gateway service.
    # In Kubernetes this path is handled by the Ingress controller,
    # but this block enables `docker compose` local development.
    location /api/ {
        proxy_pass         http://gateway:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Source Files -- Detailed Implementation Specifications

### 6.1 `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
```

This file is required by Vite for TypeScript ambient type declarations.

### 6.2 `src/styles/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Optional base layer overrides */
@layer base {
  body {
    @apply min-h-screen;
  }
}
```

### 6.3 `src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### 6.4 `src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

**Route table:**

| Path | Page Component | Purpose |
|---|---|---|
| `/` | `HomePage` | Product listing with search and category filter |
| `/products/:id` | `ProductDetailPage` | Single product detail view |
| `/cart` | `CartPage` | Shopping cart management |
| `/checkout` | `CheckoutPage` | Order form and confirmation |

---

## 7. Types -- `src/types/index.ts`

Generate this file exactly:

```typescript
/* ============================================================
   Shared TypeScript interfaces.
   These MUST match the JSON shapes returned by the store-backend API.
   ============================================================ */

// --- Product ---

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;        // float, e.g. 29.99
  image_url: string;    // absolute or relative URL
  category: string;     // e.g. "Electronics", "Books"
  stock: number;        // integer >= 0
  created_at: string;   // ISO 8601
}

// --- Cart ---

export interface CartItem {
  id: number;           // cart-item row ID
  session_id: string;
  product_id: number;
  quantity: number;
  product: Product;     // backend joins the product on read
  created_at: string;
}

export interface CartAddRequest {
  product_id: number;
  quantity: number;
}

export interface CartUpdateRequest {
  quantity: number;
}

// --- Order ---

export interface Order {
  id: number;
  session_id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total: number;
  status: string;       // e.g. "pending", "confirmed"
  created_at: string;
}

export interface OrderCreateRequest {
  customer_name: string;
  customer_email: string;
  shipping_address: string;
}

// --- Pagination ---

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}
```

---

## 8. API Client -- `src/api/client.ts`

### 8.1 Axios Instance

Create a single Axios instance used by all API calls:

```typescript
import axios from 'axios';
import type {
  Product,
  CartItem,
  CartAddRequest,
  CartUpdateRequest,
  Order,
  OrderCreateRequest,
  PaginatedResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,          // ensures session_id cookie is sent
  headers: { 'Content-Type': 'application/json' },
});

// --- Response interceptor ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log the error for debugging
    console.error('[API Error]', error.response?.status, error.response?.data);
    return Promise.reject(error);
  },
);
```

### 8.2 `productApi`

```typescript
export const productApi = {
  /**
   * GET /api/products
   * Query params: search, category, page, per_page
   * Returns PaginatedResponse<Product>
   */
  list: async (params?: {
    search?: string;
    category?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Product>> => {
    const { data } = await api.get<PaginatedResponse<Product>>('/products', { params });
    return data;
  },

  /**
   * GET /api/products/:id
   * Returns a single Product
   */
  get: async (id: number): Promise<Product> => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  /**
   * GET /api/products/categories
   * Returns string[] of distinct category names
   */
  categories: async (): Promise<string[]> => {
    const { data } = await api.get<string[]>('/products/categories');
    return data;
  },
};
```

### 8.3 `cartApi`

```typescript
export const cartApi = {
  /**
   * GET /api/cart
   * Returns CartItem[] for the current session
   */
  get: async (): Promise<CartItem[]> => {
    const { data } = await api.get<CartItem[]>('/cart');
    return data;
  },

  /**
   * POST /api/cart
   * Body: CartAddRequest
   * Returns the created CartItem
   */
  add: async (body: CartAddRequest): Promise<CartItem> => {
    const { data } = await api.post<CartItem>('/cart', body);
    return data;
  },

  /**
   * PUT /api/cart/:itemId
   * Body: CartUpdateRequest
   * Returns the updated CartItem
   */
  update: async (itemId: number, body: CartUpdateRequest): Promise<CartItem> => {
    const { data } = await api.put<CartItem>(`/cart/${itemId}`, body);
    return data;
  },

  /**
   * DELETE /api/cart/:itemId
   */
  remove: async (itemId: number): Promise<void> => {
    await api.delete(`/cart/${itemId}`);
  },
};
```

### 8.4 `orderApi`

```typescript
export const orderApi = {
  /**
   * POST /api/orders
   * Body: OrderCreateRequest
   * Returns the created Order
   */
  create: async (body: OrderCreateRequest): Promise<Order> => {
    const { data } = await api.post<Order>('/orders', body);
    return data;
  },

  /**
   * GET /api/orders/:id
   * Returns a single Order
   */
  get: async (id: number): Promise<Order> => {
    const { data } = await api.get<Order>(`/orders/${id}`);
    return data;
  },
};
```

Export everything at the bottom of the file:

```typescript
export default api;
```

---

## 9. Custom Hooks

All hooks follow the same pattern:

```
{
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;        // for queries
  mutate?: (args) => Promise;  // for mutations
}
```

### 9.1 `src/hooks/useProducts.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { productApi } from '../api/client';
import type { Product, PaginatedResponse } from '../types';

interface UseProductsParams {
  search?: string;
  category?: string;
  page?: number;
  per_page?: number;
}

interface UseProductsReturn {
  data: PaginatedResponse<Product> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProducts(params: UseProductsParams = {}): UseProductsReturn {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize params so useEffect deps work correctly
  const paramKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await productApi.list(params);
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### 9.2 `src/hooks/useProduct.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { productApi } from '../api/client';
import type { Product } from '../types';

interface UseProductReturn {
  data: Product | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProduct(id: number): UseProductReturn {
  const [data, setData] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await productApi.get(id);
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch product';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### 9.3 `src/hooks/useCart.ts`

This is the most complex hook. It manages the full cart lifecycle.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { cartApi } from '../api/client';
import type { CartItem, CartAddRequest, CartUpdateRequest } from '../types';

interface UseCartReturn {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  addItem: (body: CartAddRequest) => Promise<void>;
  updateItem: (itemId: number, body: CartUpdateRequest) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  totalItems: number;       // sum of all quantities
  totalPrice: number;       // sum of (quantity * product.price)
}
```

**Implementation details:**

1. **`refetch`**: Calls `cartApi.get()`, sets `items`.
2. **`addItem`**: Calls `cartApi.add(body)`, then refetches the entire cart to get the joined product data.
3. **`updateItem`**: Calls `cartApi.update(itemId, body)`, then refetches.
4. **`removeItem`**: Calls `cartApi.remove(itemId)`, then refetches.
5. **`totalItems`**: Derived -- `items.reduce((sum, item) => sum + item.quantity, 0)`.
6. **`totalPrice`**: Derived -- `items.reduce((sum, item) => sum + item.quantity * item.product.price, 0)`.

On mount (`useEffect`), call `refetch()` once.

Each mutation (`addItem`, `updateItem`, `removeItem`) must:
- Set `loading` to `true` before the call.
- On success, call `refetch()` to sync state.
- On failure, set `error` and re-throw so callers can react.
- Set `loading` to `false` in `finally`.

### 9.4 `src/hooks/useOrders.ts`

```typescript
import { useState } from 'react';
import { orderApi } from '../api/client';
import type { Order, OrderCreateRequest } from '../types';

interface UseOrdersReturn {
  order: Order | null;
  loading: boolean;
  error: string | null;
  createOrder: (body: OrderCreateRequest) => Promise<Order>;
}
```

**Implementation details:**

1. **`createOrder`**: Calls `orderApi.create(body)`, stores the returned `Order` in state, returns it.
2. No `useEffect` needed -- this hook is mutation-only.
3. On error, set `error` state and re-throw.

---

## 10. Components -- Full Specifications

### 10.1 `src/components/Layout.tsx`

**Purpose**: Wraps all pages with consistent chrome (Navbar on top, main content, footer).

**Props:**
```typescript
interface LayoutProps {
  children: React.ReactNode;
}
```

**Structure (JSX):**
```
<div className="flex flex-col min-h-screen">
  <Navbar />
  <main className="flex-grow container mx-auto px-4 py-8">
    {children}
  </main>
  <footer className="bg-gray-800 text-gray-300 text-center py-4 text-sm">
    &copy; {currentYear} Store. All rights reserved.
  </footer>
</div>
```

### 10.2 `src/components/Navbar.tsx`

**Purpose**: Top navigation bar with logo/title, nav links, and a cart icon with item-count badge.

**Internal state**: Uses `useCart` hook (just the `totalItems` count -- NOTE: since `useCart` makes a network call, and we do not want the Navbar to independently fetch the cart, an alternative approach is acceptable: pass `cartItemCount` as context or use a lightweight fetch. For simplicity, the Navbar should call `useCart()` directly. The hook's data will be cached within its lifecycle.)

Actually, because hooks are per-component-instance and we want the cart badge to stay in sync across pages, do the following instead:

- The `Navbar` calls `cartApi.get()` in its own `useEffect` on mount.
- Expose a manual refetch via a custom event. After any cart mutation in other components, dispatch `window.dispatchEvent(new Event('cart-updated'))`. The Navbar listens for this event and refetches.

**Detailed implementation:**

```typescript
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cartApi } from '../api/client';

export default function Navbar() {
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = async () => {
    try {
      const items = await cartApi.get();
      const total = items.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(total);
    } catch {
      // Silently ignore -- badge just stays at 0
    }
  };

  useEffect(() => {
    fetchCartCount();

    // Listen for cart-updated events from other components
    const handler = () => fetchCartCount();
    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  // ... render
}
```

**Render structure:**
```
<nav className="bg-white shadow-md sticky top-0 z-50">
  <div className="container mx-auto px-4 py-3 flex items-center justify-between">
    {/* Logo / Title */}
    <Link to="/" className="text-xl font-bold text-primary-600">
      Store
    </Link>

    {/* Nav Links */}
    <div className="flex items-center gap-6">
      <Link to="/" className="text-gray-600 hover:text-primary-600 font-medium">
        Products
      </Link>
      <Link to="/cart" className="relative text-gray-600 hover:text-primary-600 font-medium">
        Cart
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-4 bg-primary-600 text-white text-xs
                           rounded-full h-5 w-5 flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </Link>
    </div>
  </div>
</nav>
```

### 10.3 `src/components/ProductCard.tsx`

**Props:**
```typescript
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: number) => void;
}
```

**Behavior:**
- Clicking the card image or title navigates to `/products/:id` (use `Link` from react-router-dom).
- "Add to Cart" button calls `onAddToCart(product.id)`.
- If `product.stock === 0`, show "Out of Stock" badge and disable the button.
- Display price formatted as `$XX.XX` using `product.price.toFixed(2)`.

**Render structure:**
```
<div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow
                duration-200 flex flex-col">
  {/* Image */}
  <Link to={`/products/${product.id}`}>
    <img
      src={product.image_url}
      alt={product.name}
      className="w-full h-48 object-cover"
    />
  </Link>

  {/* Content */}
  <div className="p-4 flex flex-col flex-grow">
    {/* Category badge */}
    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
      {product.category}
    </span>

    {/* Title */}
    <Link to={`/products/${product.id}`}
          className="mt-1 text-lg font-semibold text-gray-800 hover:text-primary-600
                     line-clamp-2">
      {product.name}
    </Link>

    {/* Price */}
    <p className="mt-2 text-xl font-bold text-gray-900">${product.price.toFixed(2)}</p>

    {/* Spacer to push button down */}
    <div className="flex-grow" />

    {/* Add to Cart button */}
    <button
      onClick={() => onAddToCart(product.id)}
      disabled={product.stock === 0}
      className="mt-4 w-full py-2 px-4 rounded-md font-medium text-white
                 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300
                 disabled:cursor-not-allowed transition-colors"
    >
      {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
    </button>
  </div>
</div>
```

### 10.4 `src/components/ProductGrid.tsx`

**Props:**
```typescript
import type { Product } from '../types';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onAddToCart: (productId: number) => void;
}
```

**Behavior:**
- If `loading` is true, render `<LoadingSpinner />`.
- If `products` is empty and not loading, render `<EmptyState message="No products found." />`.
- Otherwise, render a responsive CSS grid of `<ProductCard />` components.

**Grid classes:**
```
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {products.map((product) => (
    <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
  ))}
</div>
```

### 10.5 `src/components/CartItem.tsx`

**Props:**
```typescript
import type { CartItem as CartItemType } from '../types';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onRemove: (itemId: number) => void;
}
```

**Render structure:**
```
<div className="flex items-center gap-4 bg-white rounded-lg shadow-sm p-4">
  {/* Product image */}
  <img
    src={item.product.image_url}
    alt={item.product.name}
    className="w-20 h-20 object-cover rounded-md"
  />

  {/* Product info */}
  <div className="flex-grow">
    <h3 className="font-semibold text-gray-800">{item.product.name}</h3>
    <p className="text-gray-500 text-sm">${item.product.price.toFixed(2)} each</p>
  </div>

  {/* Quantity controls */}
  <div className="flex items-center gap-2">
    <button
      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
      disabled={item.quantity <= 1}
      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50
                 flex items-center justify-center font-bold"
    >
      -
    </button>
    <span className="w-8 text-center font-medium">{item.quantity}</span>
    <button
      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
      disabled={item.quantity >= item.product.stock}
      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50
                 flex items-center justify-center font-bold"
    >
      +
    </button>
  </div>

  {/* Line total */}
  <p className="w-24 text-right font-bold text-gray-900">
    ${(item.quantity * item.product.price).toFixed(2)}
  </p>

  {/* Remove button */}
  <button
    onClick={() => onRemove(item.id)}
    className="text-red-500 hover:text-red-700 ml-2"
    aria-label="Remove item"
  >
    {/* Trash icon -- use inline SVG */}
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0
               002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0
               0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0
               00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd" />
    </svg>
  </button>
</div>
```

### 10.6 `src/components/CartSummary.tsx`

**Props:**
```typescript
interface CartSummaryProps {
  totalItems: number;
  totalPrice: number;
  onCheckout: () => void;
  disabled?: boolean;
}
```

**Render structure:**
```
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>

  <div className="flex justify-between mb-2">
    <span className="text-gray-600">Items ({totalItems})</span>
    <span className="font-medium">${totalPrice.toFixed(2)}</span>
  </div>

  <div className="flex justify-between mb-2">
    <span className="text-gray-600">Shipping</span>
    <span className="font-medium text-green-600">Free</span>
  </div>

  <hr className="my-4" />

  <div className="flex justify-between mb-6">
    <span className="text-lg font-bold">Total</span>
    <span className="text-lg font-bold">${totalPrice.toFixed(2)}</span>
  </div>

  <button
    onClick={onCheckout}
    disabled={disabled || totalItems === 0}
    className="w-full py-3 px-4 rounded-md font-semibold text-white bg-primary-600
               hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed
               transition-colors"
  >
    Proceed to Checkout
  </button>
</div>
```

### 10.7 `src/components/SearchBar.tsx`

**Props:**
```typescript
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

**Behavior:**
- Controlled input. The parent passes `value` and `onChange`.
- Debouncing is NOT done inside this component -- the parent (HomePage) can debounce if desired, or we can add a simple 300ms debounce inside `onChange` using `setTimeout`.

**Implementation approach (with built-in debounce):**

Actually, for better UX, implement debouncing inside the component:

```typescript
import { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = 'Search products...' }: SearchBarProps) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, onSearch]);

  return (
    <div className="relative">
      {/* Search icon (inline SVG) */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg"
             viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89
                   3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6
                   6 0 012 8z"
                clipRule="evenodd" />
        </svg>
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-primary-500
                   focus:border-transparent"
      />
    </div>
  );
}
```

### 10.8 `src/components/CategoryFilter.tsx`

**Props:**
```typescript
interface CategoryFilterProps {
  categories: string[];
  selected: string;         // "" means "All"
  onSelect: (category: string) => void;
}
```

**Behavior:**
- Renders a row of pill-shaped buttons: "All" + one per category.
- The active category gets a solid primary color; inactive ones get an outlined style.

**Render structure:**
```
<div className="flex flex-wrap gap-2">
  <button
    onClick={() => onSelect('')}
    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
      ${selected === ''
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
  >
    All
  </button>
  {categories.map((cat) => (
    <button
      key={cat}
      onClick={() => onSelect(cat)}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
        ${selected === cat
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
      {cat}
    </button>
  ))}
</div>
```

### 10.9 `src/components/LoadingSpinner.tsx`

**Props:** None (or optional `className` string).

**Render:**
```
<div className="flex justify-center items-center py-12">
  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
</div>
```

### 10.10 `src/components/EmptyState.tsx`

**Props:**
```typescript
interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
```

**Render:**
```
<div className="text-center py-16">
  {/* Empty box icon (inline SVG) */}
  <svg className="mx-auto h-16 w-16 text-gray-300" xmlns="http://www.w3.org/2000/svg"
       fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
  <p className="mt-4 text-gray-500 text-lg">{message}</p>
  {actionLabel && onAction && (
    <button
      onClick={onAction}
      className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-md
                 hover:bg-primary-700 transition-colors font-medium"
    >
      {actionLabel}
    </button>
  )}
</div>
```

---

## 11. Pages -- Full Specifications

### 11.1 `src/pages/HomePage.tsx`

**State variables:**
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState('');
const [categories, setCategories] = useState<string[]>([]);
```

**Data fetching:**
```typescript
const { data, loading, error } = useProducts({
  search: searchQuery || undefined,
  category: selectedCategory || undefined,
});
```

**On mount, also fetch categories:**
```typescript
useEffect(() => {
  productApi.categories()
    .then(setCategories)
    .catch(console.error);
}, []);
```

**Add-to-cart handler:**
```typescript
const handleAddToCart = async (productId: number) => {
  try {
    await cartApi.add({ product_id: productId, quantity: 1 });
    // Notify Navbar to update badge
    window.dispatchEvent(new Event('cart-updated'));
    // Optional: show a brief toast/notification (for simplicity, an alert or no feedback)
  } catch (err) {
    console.error('Failed to add to cart:', err);
  }
};
```

**Render structure:**
```
<div>
  <h1 className="text-3xl font-bold text-gray-900 mb-6">Products</h1>

  {/* Search and filter bar */}
  <div className="flex flex-col sm:flex-row gap-4 mb-8">
    <div className="flex-grow">
      <SearchBar onSearch={setSearchQuery} />
    </div>
  </div>

  {/* Category filter */}
  {categories.length > 0 && (
    <div className="mb-6">
      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
    </div>
  )}

  {/* Error state */}
  {error && (
    <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
      {error}
    </div>
  )}

  {/* Product grid */}
  <ProductGrid
    products={data?.items ?? []}
    loading={loading}
    onAddToCart={handleAddToCart}
  />
</div>
```

### 11.2 `src/pages/ProductDetailPage.tsx`

**URL**: `/products/:id`

**Data fetching:**
```typescript
const { id } = useParams<{ id: string }>();
const navigate = useNavigate();
const { data: product, loading, error } = useProduct(Number(id));
const [quantity, setQuantity] = useState(1);
const [adding, setAdding] = useState(false);
```

**Add-to-cart handler:**
```typescript
const handleAddToCart = async () => {
  if (!product) return;
  setAdding(true);
  try {
    await cartApi.add({ product_id: product.id, quantity });
    window.dispatchEvent(new Event('cart-updated'));
    navigate('/cart');
  } catch (err) {
    console.error('Failed to add to cart:', err);
  } finally {
    setAdding(false);
  }
};
```

**Render structure:**
```
{loading && <LoadingSpinner />}

{error && (
  <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
)}

{product && (
  <div className="max-w-4xl mx-auto">
    {/* Back link */}
    <button onClick={() => navigate('/')}
            className="mb-6 text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
      &larr; Back to Products
    </button>

    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="md:flex">
        {/* Image */}
        <div className="md:w-1/2">
          <img src={product.image_url} alt={product.name}
               className="w-full h-80 md:h-full object-cover" />
        </div>

        {/* Details */}
        <div className="p-6 md:w-1/2 flex flex-col">
          <span className="text-sm font-semibold text-primary-600 uppercase tracking-wide">
            {product.category}
          </span>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-4 text-gray-600 leading-relaxed">{product.description}</p>
          <p className="mt-6 text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</p>

          {/* Stock status */}
          <p className={`mt-2 text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </p>

          {/* Quantity selector */}
          {product.stock > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <label className="text-gray-700 font-medium">Qty:</label>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none
                           focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: Math.min(product.stock, 10) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-grow" />

          {/* Add to Cart button */}
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0 || adding}
            className="mt-6 w-full py-3 px-4 rounded-md font-semibold text-white
                       bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300
                       disabled:cursor-not-allowed transition-colors"
          >
            {adding ? 'Adding...' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 11.3 `src/pages/CartPage.tsx`

**Data fetching:**
Uses the `useCart` hook.

```typescript
const {
  items, loading, error, totalItems, totalPrice,
  updateItem, removeItem, refetch
} = useCart();
const navigate = useNavigate();
```

**Handlers:**
```typescript
const handleUpdateQuantity = async (itemId: number, quantity: number) => {
  if (quantity < 1) return;
  await updateItem(itemId, { quantity });
  window.dispatchEvent(new Event('cart-updated'));
};

const handleRemove = async (itemId: number) => {
  await removeItem(itemId);
  window.dispatchEvent(new Event('cart-updated'));
};

const handleCheckout = () => {
  navigate('/checkout');
};
```

**Render structure:**
```
<div>
  <h1 className="text-3xl font-bold text-gray-900 mb-6">Shopping Cart</h1>

  {loading && <LoadingSpinner />}

  {error && (
    <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
  )}

  {!loading && items.length === 0 && (
    <EmptyState
      message="Your cart is empty"
      actionLabel="Browse Products"
      onAction={() => navigate('/')}
    />
  )}

  {items.length > 0 && (
    <div className="lg:flex lg:gap-8">
      {/* Cart items list */}
      <div className="flex-grow space-y-4">
        {items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onUpdateQuantity={handleUpdateQuantity}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Order summary sidebar */}
      <div className="mt-8 lg:mt-0 lg:w-80 flex-shrink-0">
        <CartSummary
          totalItems={totalItems}
          totalPrice={totalPrice}
          onCheckout={handleCheckout}
        />
      </div>
    </div>
  )}
</div>
```

### 11.4 `src/pages/CheckoutPage.tsx`

**State variables:**
```typescript
const [formData, setFormData] = useState<OrderCreateRequest>({
  customer_name: '',
  customer_email: '',
  shipping_address: '',
});
const [formErrors, setFormErrors] = useState<Record<string, string>>({});
const { order, loading, error, createOrder } = useOrders();
const { items, totalPrice, totalItems } = useCart();
const navigate = useNavigate();
const [submitted, setSubmitted] = useState(false);
```

**Validation function:**
```typescript
const validate = (): boolean => {
  const errors: Record<string, string> = {};

  if (!formData.customer_name.trim()) {
    errors.customer_name = 'Name is required';
  }

  if (!formData.customer_email.trim()) {
    errors.customer_email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
    errors.customer_email = 'Please enter a valid email address';
  }

  if (!formData.shipping_address.trim()) {
    errors.shipping_address = 'Shipping address is required';
  }

  setFormErrors(errors);
  return Object.keys(errors).length === 0;
};
```

**Submit handler:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;

  try {
    await createOrder(formData);
    setSubmitted(true);
    // Clear cart badge
    window.dispatchEvent(new Event('cart-updated'));
  } catch (err) {
    console.error('Order failed:', err);
  }
};
```

**Input change handler:**
```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
  // Clear field error on change
  if (formErrors[name]) {
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }
};
```

**Render -- two states:**

**State A: Order confirmation (when `submitted && order`):**
```
<div className="max-w-lg mx-auto text-center py-16">
  {/* Green checkmark circle (inline SVG) */}
  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
    <svg className="w-8 h-8 text-green-600" xmlns="http://www.w3.org/2000/svg"
         fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>
  <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
  <p className="text-gray-600 mb-2">Your order ID is <strong>#{order.id}</strong></p>
  <p className="text-gray-500 mb-8">
    A confirmation will be sent to <strong>{order.customer_email}</strong>
  </p>
  <button
    onClick={() => navigate('/')}
    className="px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700
               transition-colors font-medium"
  >
    Continue Shopping
  </button>
</div>
```

**State B: Checkout form (when not submitted):**
```
<div className="max-w-3xl mx-auto">
  <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>

  <div className="lg:flex lg:gap-8">
    {/* Form */}
    <form onSubmit={handleSubmit} className="flex-grow">
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Customer Information</h2>

        {/* customer_name field */}
        <div>
          <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="customer_name"
            name="customer_name"
            value={formData.customer_name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2
                        focus:ring-primary-500 focus:border-transparent
                        ${formErrors.customer_name ? 'border-red-500' : 'border-gray-300'}`}
          />
          {formErrors.customer_name && (
            <p className="mt-1 text-sm text-red-600">{formErrors.customer_name}</p>
          )}
        </div>

        {/* customer_email field */}
        <div>
          <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="customer_email"
            name="customer_email"
            value={formData.customer_email}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2
                        focus:ring-primary-500 focus:border-transparent
                        ${formErrors.customer_email ? 'border-red-500' : 'border-gray-300'}`}
          />
          {formErrors.customer_email && (
            <p className="mt-1 text-sm text-red-600">{formErrors.customer_email}</p>
          )}
        </div>

        {/* shipping_address field */}
        <div>
          <label htmlFor="shipping_address" className="block text-sm font-medium text-gray-700 mb-1">
            Shipping Address
          </label>
          <textarea
            id="shipping_address"
            name="shipping_address"
            rows={3}
            value={formData.shipping_address}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2
                        focus:ring-primary-500 focus:border-transparent
                        ${formErrors.shipping_address ? 'border-red-500' : 'border-gray-300'}`}
          />
          {formErrors.shipping_address && (
            <p className="mt-1 text-sm text-red-600">{formErrors.shipping_address}</p>
          )}
        </div>

        {/* API error */}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-md font-semibold text-white bg-primary-600
                     hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>
    </form>

    {/* Order summary (read-only) */}
    <div className="mt-8 lg:mt-0 lg:w-80 flex-shrink-0">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>

        {/* Cart items list (compact) */}
        <div className="space-y-3 mb-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.product.name} x {item.quantity}
              </span>
              <span className="font-medium">
                ${(item.quantity * item.product.price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <hr className="my-3" />

        <div className="flex justify-between">
          <span className="font-bold">Total ({totalItems} items)</span>
          <span className="font-bold">${totalPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 12. Cart-Updated Event Protocol

Because there is no global state management, cart mutations must signal the Navbar to refresh its badge count. The protocol is:

1. After any successful call to `cartApi.add()`, `cartApi.update()`, or `cartApi.remove()`, the calling component dispatches:
   ```typescript
   window.dispatchEvent(new Event('cart-updated'));
   ```

2. The `Navbar` component listens for this event in a `useEffect` and refetches the cart count.

This pattern is used in:
- `HomePage.tsx` -- after `handleAddToCart`
- `ProductDetailPage.tsx` -- after `handleAddToCart`
- `CartPage.tsx` -- after `handleUpdateQuantity` and `handleRemove`
- `CheckoutPage.tsx` -- after successful `createOrder` (cart is emptied server-side)

---

## 13. Responsive Design Specification

| Breakpoint | Tailwind prefix | Product grid cols | Cart layout | Checkout layout |
|---|---|---|---|---|
| < 640px | (default) | 1 column | Stacked | Stacked |
| >= 640px | `sm:` | 2 columns | Stacked | Stacked |
| >= 1024px | `lg:` | 3 columns | Side-by-side (items + summary) | Side-by-side (form + summary) |
| >= 1280px | `xl:` | 4 columns | Same as lg | Same as lg |

---

## 14. Color and Visual Design Tokens

| Element | Tailwind class(es) |
|---|---|
| Page background | `bg-gray-50` (set on `<body>`) |
| Card background | `bg-white` |
| Card shadow | `shadow-md`, `hover:shadow-lg` on product cards |
| Card border radius | `rounded-lg` |
| Primary color | `primary-600` (#2563eb) -- buttons, links, badges |
| Primary hover | `primary-700` (#1d4ed8) |
| Text primary | `text-gray-900` |
| Text secondary | `text-gray-600` |
| Text muted | `text-gray-500` |
| Error text | `text-red-600` |
| Error background | `bg-red-50` |
| Success text | `text-green-600` |
| Disabled button | `bg-gray-300 cursor-not-allowed` |
| Input focus ring | `focus:ring-2 focus:ring-primary-500 focus:border-transparent` |
| Category pill active | `bg-primary-600 text-white` |
| Category pill inactive | `bg-gray-100 text-gray-700 hover:bg-gray-200` |
| Footer | `bg-gray-800 text-gray-300` |
| Navbar | `bg-white shadow-md sticky top-0 z-50` |
| Badge (cart count) | `bg-primary-600 text-white text-xs rounded-full h-5 w-5` |

---

## 15. Error Handling Strategy

1. **Network errors**: Caught in hooks, stored as `error: string | null`. Components render an error banner (`bg-red-50 text-red-700 p-4 rounded-lg`).

2. **Empty results**: Components render `<EmptyState />` with a contextual message and optional action button.

3. **Form validation**: Client-side validation in `CheckoutPage`. Errors shown per-field below the input in red text. The submit button is disabled while `loading` is true.

4. **Axios interceptor**: The response interceptor in `api/client.ts` logs errors to the console. It does NOT show user-facing toasts -- that is handled by the components themselves.

5. **404 product**: If `useProduct` returns an error, show an error message and a "Back to Products" link.

---

## 16. API Route Summary

The frontend calls these routes. The base path `/api` is relative -- in production it is routed by the Kubernetes Ingress to the gateway; in development it is proxied by Vite or nginx.

| Method | Path | Description | Used by |
|---|---|---|---|
| GET | `/api/products` | List products (query: search, category, page, per_page) | `useProducts`, `HomePage` |
| GET | `/api/products/:id` | Single product | `useProduct`, `ProductDetailPage` |
| GET | `/api/products/categories` | Distinct category names | `HomePage` |
| GET | `/api/cart` | Get cart items for session | `useCart`, `Navbar` |
| POST | `/api/cart` | Add item to cart | `cartApi.add()` |
| PUT | `/api/cart/:itemId` | Update item quantity | `cartApi.update()` |
| DELETE | `/api/cart/:itemId` | Remove item from cart | `cartApi.remove()` |
| POST | `/api/orders` | Create order from cart | `useOrders`, `CheckoutPage` |
| GET | `/api/orders/:id` | Get order by ID | `orderApi.get()` |

---

## 17. Session Management

- The backend sets a `session_id` cookie on the first request to `/api/cart` or `/api/orders`.
- The Axios instance is configured with `withCredentials: true` so the cookie is automatically included in all requests.
- The frontend never reads or writes the `session_id` cookie directly.
- The cookie links the anonymous user to their cart and orders.

---

## 18. Build and Run Commands

### Local development:
```bash
cd store-frontend
npm install
npm run dev          # Starts Vite dev server on http://localhost:3000
```

### Production build:
```bash
npm run build        # Outputs to ./dist
```

### Docker:
```bash
docker build -t store-frontend .
docker run -p 80:80 store-frontend
```

---

## 19. Implementation Checklist

When generating code, produce every file listed in Section 3 in this exact order:

1. `package.json`
2. `tsconfig.json`
3. `tailwind.config.js`
4. `postcss.config.js`
5. `vite.config.ts`
6. `index.html`
7. `Dockerfile`
8. `nginx.conf`
9. `src/vite-env.d.ts`
10. `src/styles/index.css`
11. `src/main.tsx`
12. `src/types/index.ts`
13. `src/api/client.ts`
14. `src/hooks/useProducts.ts`
15. `src/hooks/useProduct.ts`
16. `src/hooks/useCart.ts`
17. `src/hooks/useOrders.ts`
18. `src/components/LoadingSpinner.tsx`
19. `src/components/EmptyState.tsx`
20. `src/components/SearchBar.tsx`
21. `src/components/CategoryFilter.tsx`
22. `src/components/ProductCard.tsx`
23. `src/components/ProductGrid.tsx`
24. `src/components/CartItem.tsx`
25. `src/components/CartSummary.tsx`
26. `src/components/Navbar.tsx`
27. `src/components/Layout.tsx`
28. `src/App.tsx`
29. `src/main.tsx` (already listed -- skip duplicate)
30. `src/pages/HomePage.tsx`
31. `src/pages/ProductDetailPage.tsx`
32. `src/pages/CartPage.tsx`
33. `src/pages/CheckoutPage.tsx`

Every file must be complete -- no `// ...` placeholders, no `TODO` comments, no truncation. Every import must be valid. Every type must be explicitly annotated. The code must compile with `tsc --noEmit` and build with `vite build` without errors.
