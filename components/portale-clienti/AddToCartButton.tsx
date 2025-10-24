/**
 * AddToCartButton Component
 * Button to add products to cart with quantity selector and animations
 */

'use client';

import { useState } from 'react';
import { ShoppingCartIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useCartStore, CartItem } from '@/lib/store/cartStore';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps {
  product: {
    productId: string;
    name: string;
    price: number;
    image?: string;
    variant?: string;
  };
  quantity?: number;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showQuantitySelector?: boolean;
}

export function AddToCartButton({
  product,
  quantity: initialQuantity = 1,
  variant = 'primary',
  size = 'md',
  className,
  showQuantitySelector = false,
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const addItem = useCartStore(state => state.addItem);

  const handleAddToCart = () => {
    setIsAdding(true);

    // Add to cart
    addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image,
      variant: product.variant,
    });

    // Success animation
    setTimeout(() => {
      setIsAdding(false);
      setJustAdded(true);

      // Reset success state after animation
      setTimeout(() => {
        setJustAdded(false);
      }, 2000);
    }, 300);
  };

  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
  };

  const sizeStyles = {
    sm: 'py-1.5 px-3 text-sm',
    md: 'py-2 px-4 text-base',
    lg: 'py-3 px-6 text-lg',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Quantity Selector */}
      {showQuantitySelector && (
        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-l-lg transition-colors"
            disabled={quantity <= 1}
          >
            -
          </button>
          <span className="px-3 font-medium text-gray-900 min-w-[2rem] text-center">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-r-lg transition-colors"
          >
            +
          </button>
        </div>
      )}

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={isAdding || justAdded}
        className={cn(
          "flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-300",
          "disabled:opacity-70 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          justAdded && "scale-105"
        )}
      >
        {justAdded ? (
          <>
            <CheckIcon className="h-5 w-5 animate-bounce" />
            <span>Aggiunto!</span>
          </>
        ) : isAdding ? (
          <>
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Aggiunta...</span>
          </>
        ) : (
          <>
            <ShoppingCartIcon className="h-5 w-5" />
            <span>Aggiungi al Carrello</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * QuickAddButton - Compact version for product cards
 */
export function QuickAddButton({
  product,
  className,
}: {
  product: AddToCartButtonProps['product'];
  className?: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const addItem = useCartStore(state => state.addItem);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if in a Link
    setIsAdding(true);

    addItem({
      productId: product.productId,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
      variant: product.variant,
    });

    setTimeout(() => setIsAdding(false), 600);
  };

  return (
    <button
      onClick={handleQuickAdd}
      disabled={isAdding}
      className={cn(
        "p-2 bg-white hover:bg-blue-50 text-blue-600 rounded-full shadow-md",
        "transition-all duration-200 hover:scale-110 disabled:opacity-50",
        isAdding && "scale-90",
        className
      )}
      aria-label="Aggiungi al carrello"
    >
      {isAdding ? (
        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      ) : (
        <ShoppingCartIcon className="h-5 w-5" />
      )}
    </button>
  );
}
