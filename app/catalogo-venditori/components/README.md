# Catalogo Venditori - React Components

This directory contains the main React components for the Catalogo Venditori app, a sales catalog application with AI-powered order processing.

## Components Overview

### 1. CustomerSelector.tsx

A component for searching and selecting customers with their delivery addresses.

**Props:**
- `onCustomerSelect: (customerId: number, customerName: string) => void` - Callback when customer is selected
- `onAddressSelect: (addressId: number | null) => void` - Callback when delivery address is selected

**Features:**
- Autocomplete search by customer name, ref code, or city
- Displays customer info: name, ref, city, phone
- Fetches and displays delivery addresses from API
- Loading states during API calls
- Error handling with user-friendly messages
- Dark theme with Tailwind CSS
- Mobile responsive with 48px min touch targets

**API Endpoints Used:**
- `GET /api/catalogo-venditori/customers` - Fetch all customers
- `GET /api/catalogo-venditori/customers/{id}/addresses` - Fetch customer addresses

---

### 2. AIOrderInput.tsx

A component for processing order messages using AI to identify products and quantities.

**Props:**
- `customerId: number | null` - The selected customer ID (required for processing)
- `onProductsMatched: (products: MatchedProduct[]) => void` - Callback with AI-matched products

**Types:**
```typescript
interface MatchedProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  confidence: string; // 'high' | 'medium' | 'low'
  reasoning: string;
}
```

**Features:**
- Large textarea for pasting messages (WhatsApp, email, etc.)
- AI processing button with loading state
- Displays AI results with confidence badges (high/medium/low)
- Shows reasoning for each product match
- Gradient button styling (emerald to blue)
- Mobile optimized
- Disabled state when no customer is selected

**API Endpoints Used:**
- `POST /api/catalogo-venditori/ai-match` - Process message with AI

---

### 3. SmartCart.tsx

A shopping cart component for reviewing and managing order products.

**Props:**
- `products: CartProduct[]` - Array of products in cart
- `onQuantityChange: (index: number, qty: number) => void` - Callback when quantity changes
- `onRemove: (index: number) => void` - Callback when product is removed
- `onConfirm: () => void` - Callback when order is confirmed
- `loading?: boolean` - Optional loading state during order submission

**Types:**
```typescript
interface CartProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  price?: number;
}
```

**Features:**
- Empty state with icon when no products
- Product list with image placeholders
- Quantity controls with +/- buttons
- Price display (if available)
- Total items and price summary
- Remove product functionality
- Confirm order button with loading state
- Mobile responsive with touch-friendly controls

---

### 4. NotesInput.tsx

A component for adding optional notes to orders.

**Props:**
- `value: string` - Current notes value
- `onChange: (value: string) => void` - Callback when notes change

**Features:**
- Textarea with placeholder in Italian
- 500 character limit with counter
- Color-coded counter (green → yellow → red)
- Warning at 90% capacity
- Error message at max capacity
- Helper text with icon
- Dark theme styling
- Mobile responsive

---

## Styling Guidelines

All components follow these design principles:

### Color Scheme (Dark Theme)
- Background: `bg-slate-900`, `bg-slate-800`
- Text: `text-white`, `text-slate-300`, `text-slate-400`
- Borders: `border-slate-700`
- Accent: `emerald-500`, `blue-500`
- Error: `red-500`
- Warning: `yellow-400`

### Touch Targets
- All interactive elements have `min-h-[48px]` for mobile accessibility
- Buttons and inputs use `min-w-[48px]` where appropriate

### Responsive Design
- Mobile-first approach
- Breakpoints: `md:` (tablet), `lg:` (desktop)
- Flexible layouts with flexbox/grid

### Loading States
- Spinner with emerald-500 color
- Border animation: `border-2 border-emerald-500 border-t-transparent rounded-full animate-spin`

### Error States
- Red background: `bg-red-500/10`
- Red border: `border-red-500`
- Red text: `text-red-500`
- Icon for visual clarity

---

## Usage Example

```tsx
'use client';

import { useState } from 'react';
import {
  CustomerSelector,
  AIOrderInput,
  SmartCart,
  NotesInput,
  type MatchedProduct,
  type CartProduct,
} from './components';

export default function CatalogoVenditoriPage() {
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [addressId, setAddressId] = useState<number | null>(null);
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCustomerSelect = (id: number, name: string) => {
    setCustomerId(id);
    setCustomerName(name);
  };

  const handleProductsMatched = (products: MatchedProduct[]) => {
    const newCartProducts: CartProduct[] = products.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      quantity: p.quantity,
    }));
    setCartProducts(prev => [...prev, ...newCartProducts]);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setCartProducts(prev => {
      const updated = [...prev];
      updated[index].quantity = qty;
      return updated;
    });
  };

  const handleRemove = (index: number) => {
    setCartProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    setLoading(true);
    // Submit order to API
    try {
      const response = await fetch('/api/catalogo-venditori/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          addressId,
          products: cartProducts,
          notes,
        }),
      });
      // Handle response...
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <CustomerSelector
        onCustomerSelect={handleCustomerSelect}
        onAddressSelect={setAddressId}
      />

      <AIOrderInput
        customerId={customerId}
        onProductsMatched={handleProductsMatched}
      />

      <SmartCart
        products={cartProducts}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemove}
        onConfirm={handleConfirm}
        loading={loading}
      />

      <NotesInput value={notes} onChange={setNotes} />
    </div>
  );
}
```

---

## Type Definitions

All shared types are available in `../types.ts` for use across the application.

---

## Development Notes

### API Integration
- All components expect standard REST API responses
- Error handling is built-in with user-friendly messages
- Loading states prevent duplicate submissions

### Accessibility
- All interactive elements meet WCAG 2.1 AA standards
- Touch targets are minimum 48x48px
- Color contrast ratios meet accessibility guidelines
- ARIA labels on icon-only buttons

### Mobile Optimization
- Components tested on iOS and Android
- Touch-friendly controls
- Responsive layouts adapt to screen size
- Text remains readable at all sizes

---

## License

Internal use only - Lapa Company
