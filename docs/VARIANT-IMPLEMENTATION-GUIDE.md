# Quick Implementation Guide: Product Variants in Pre-Order System

## TL;DR - What You Need to Know

### The Problem
Currently, the pre-order system shows only ONE product per template, even if that template has multiple variants (sizes, colors, formats, etc.)

### The Solution
Detect when a product has variants and let users select which variant to assign to customers.

---

## 1. Minimal API Changes

### File: `app/api/smart-ordering-v2/pre-order-products/route.ts`

**Add after line 77** (after loading products):

```typescript
// 3. Check for variants and enrich product data
const enrichedProducts = await Promise.all(products.map(async (product: any) => {
  const templateId = product.product_tmpl_id[0];

  // Load template to check variant count
  const template = await rpc.searchRead(
    'product.template',
    [['id', '=', templateId]],
    ['product_variant_count', 'product_variant_ids'],
    1
  );

  const hasVariants = template[0].product_variant_count > 1;

  // If has variants, load all of them
  let variants = [];
  if (hasVariants) {
    variants = await rpc.searchRead(
      'product.product',
      [['product_tmpl_id', '=', templateId]],
      [
        'id',
        'display_name',
        'qty_available',
        'lst_price',
        'default_code',
        'image_128'
      ]
    );
  }

  return {
    ...product,
    hasVariants,
    variantCount: template[0].product_variant_count,
    variants: hasVariants ? variants : []
  };
}));

// Use enrichedProducts instead of products for supplier loading
```

**Update the final response** (around line 160):

```typescript
const formattedProducts = enrichedProducts.map((product: any) => {
  const mainSupplierId = product.seller_ids && product.seller_ids.length > 0 ? product.seller_ids[0] : null;
  const supplier = mainSupplierId ? supplierMap.get(mainSupplierId) : null;

  return {
    id: product.id,
    name: product.name,
    image_url: `https://lapadevadmin-lapa-v2-staging-2406-24586301.dev.odoo.com/web/image/product.product/${product.id}/image_128`,
    stock: product.qty_available || 0,
    uom: product.uom_id ? product.uom_id[1] : 'PZ',
    supplier_name: supplier ? supplier.name : 'Nessun fornitore',
    supplier_id: supplier ? supplier.id : null,
    hasPreOrderTag: true,
    assigned_customers: assignmentsByProduct.get(product.id) || [],

    // NEW VARIANT FIELDS
    hasVariants: product.hasVariants,
    variantCount: product.variantCount,
    variants: product.variants.map((v: any) => ({
      id: v.id,
      display_name: v.display_name,
      qty_available: v.qty_available || 0,
      lst_price: v.lst_price || 0,
      default_code: v.default_code || null,
      image_url: v.image_128
        ? `https://lapadevadmin-lapa-v2-staging-2406-24586301.dev.odoo.com/web/image/product.product/${v.id}/image_128`
        : null
    }))
  };
});
```

---

## 2. Frontend Types

### File: `app/prodotti-preordine/page.tsx` (or create separate types file)

```typescript
interface ProductVariant {
  id: number;
  display_name: string;
  qty_available: number;
  lst_price: number;
  default_code: string | null;
  image_url: string | null;
}

interface PreOrderProduct {
  id: number;
  name: string;
  image_url: string;
  stock: number;
  uom: string;
  supplier_name: string;
  supplier_id: number | null;
  hasPreOrderTag: boolean;
  assigned_customers: AssignedCustomer[];

  // Variant fields
  hasVariants: boolean;
  variantCount: number;
  variants: ProductVariant[];
}

// Add to state
const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
// Key: product.id (template's first variant), Value: selected variant ID
```

---

## 3. Simple UI - Dropdown Variant Selector

### Add this component before the table:

```tsx
const VariantSelector = ({
  product,
  selectedVariantId,
  onVariantChange
}: {
  product: PreOrderProduct;
  selectedVariantId: number;
  onVariantChange: (variantId: number) => void;
}) => {
  if (!product.hasVariants) return null;

  return (
    <select
      value={selectedVariantId}
      onChange={(e) => onVariantChange(Number(e.target.value))}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
      onClick={(e) => e.stopPropagation()} // Prevent row expansion
    >
      {product.variants.map(variant => (
        <option key={variant.id} value={variant.id}>
          {variant.display_name} - Stock: {variant.qty_available}
        </option>
      ))}
    </select>
  );
};
```

### Update table row to include selector:

```tsx
<tr key={product.id}>
  <td className="px-4 py-2">
    {product.hasVariants ? (
      <div className="space-y-2">
        <div className="font-medium">{product.name}</div>
        <VariantSelector
          product={product}
          selectedVariantId={selectedVariants[product.id] || product.id}
          onVariantChange={(variantId) => {
            setSelectedVariants(prev => ({
              ...prev,
              [product.id]: variantId
            }));
          }}
        />
        <div className="text-xs text-gray-500">
          {product.variantCount} varianti disponibili
        </div>
      </div>
    ) : (
      <div className="font-medium">{product.name}</div>
    )}
  </td>
  {/* ... rest of columns ... */}
</tr>
```

---

## 4. Update Assignment Logic

### When assigning to customer:

```typescript
const handleAssignCustomer = async (productId: number, customerId: number, quantity: number) => {
  // Use selected variant ID, or default to product ID if no variants
  const variantId = selectedVariants[productId] || productId;

  const response = await fetch('/api/smart-ordering-v2/assign-customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: variantId,  // Use variant ID!
      customer_id: customerId,
      quantity: quantity
    })
  });

  // ... handle response
};
```

---

## 5. Display Stock for Selected Variant

Update stock display to reflect selected variant:

```tsx
const getDisplayStock = (product: PreOrderProduct) => {
  if (!product.hasVariants) {
    return product.stock;
  }

  const selectedVariantId = selectedVariants[product.id] || product.id;
  const selectedVariant = product.variants.find(v => v.id === selectedVariantId);

  return selectedVariant?.qty_available || 0;
};

// In table cell:
<td className="px-4 py-2">
  {getDisplayStock(product)} {product.uom}
</td>
```

---

## 6. Visual Indicator for Multi-Variant Products

Add a badge to show variant count:

```tsx
{product.hasVariants && (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
    {product.variantCount} varianti
  </span>
)}
```

---

## 7. Testing

### Test Products to Look For

Search Odoo for products with these terms (they often have variants):
- "PASTA" (shapes, sizes, colors)
- "formato" (format variants)
- "taglia" (size variants)
- "colore" (color variants)
- "ml", "kg", "gr" (weight variants)

### Expected Behavior

1. **Single variant product** (variantCount = 1):
   - No dropdown shown
   - Works exactly like before

2. **Multi-variant product** (variantCount > 1):
   - Dropdown shows all variants with display names
   - Stock updates when variant selected
   - Assignment saves correct variant ID

---

## 8. Common Issues & Solutions

### Issue: "All variants show same name"
**Solution**: Use `display_name` field, not `name`. The `display_name` includes variant attributes.

### Issue: "Wrong stock shown"
**Solution**: Get stock from selected variant, not from template's first variant.

### Issue: "Assignment saves wrong product"
**Solution**: Use `selectedVariants[productId]` or fallback to `productId`, never use template ID.

### Issue: "Dropdown too long"
**Solution**: If > 10 variants, consider searchable dropdown or modal selector.

---

## 9. Future Enhancements

### Phase 2: Advanced UI
- Modal with grid layout for variants
- Visual attribute selectors (color swatches, size buttons)
- Variant images in selector

### Phase 3: Bulk Operations
- "Copy to all variants" button
- Bulk assignment across variants
- Template-level operations

### Phase 4: Analytics
- Track which variants sell best
- Show variant performance in pre-order history
- Suggest popular variants to customers

---

## 10. Complete Code Example

### Full component with variant support:

```tsx
'use client';

import { useState, useEffect } from 'react';

interface ProductVariant {
  id: number;
  display_name: string;
  qty_available: number;
  lst_price: number;
  default_code: string | null;
  image_url: string | null;
}

interface PreOrderProduct {
  id: number;
  name: string;
  image_url: string;
  stock: number;
  uom: string;
  supplier_name: string;
  supplier_id: number | null;
  hasPreOrderTag: boolean;
  assigned_customers: any[];
  hasVariants: boolean;
  variantCount: number;
  variants: ProductVariant[];
}

export default function ProdottiPreordinePage() {
  const [products, setProducts] = useState<PreOrderProduct[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const response = await fetch('/api/smart-ordering-v2/pre-order-products');
    const data = await response.json();

    if (data.success) {
      setProducts(data.products);

      // Initialize selected variants (default to first variant)
      const initialSelection: Record<number, number> = {};
      data.products.forEach((p: PreOrderProduct) => {
        if (p.hasVariants && p.variants.length > 0) {
          initialSelection[p.id] = p.variants[0].id;
        }
      });
      setSelectedVariants(initialSelection);
    }

    setLoading(false);
  };

  const getSelectedVariant = (product: PreOrderProduct) => {
    if (!product.hasVariants) return null;

    const selectedId = selectedVariants[product.id] || product.id;
    return product.variants.find(v => v.id === selectedId);
  };

  const getDisplayStock = (product: PreOrderProduct) => {
    const variant = getSelectedVariant(product);
    return variant ? variant.qty_available : product.stock;
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Prodotti Pre-Ordine</h1>

      {loading ? (
        <div>Caricamento...</div>
      ) : (
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Prodotto</th>
              <th className="px-4 py-2 border">Stock</th>
              <th className="px-4 py-2 border">Fornitore</th>
              <th className="px-4 py-2 border">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td className="px-4 py-2 border">
                  <div className="space-y-2">
                    <div className="font-medium">{product.name}</div>

                    {product.hasVariants && (
                      <>
                        <select
                          value={selectedVariants[product.id] || product.id}
                          onChange={(e) => {
                            setSelectedVariants(prev => ({
                              ...prev,
                              [product.id]: Number(e.target.value)
                            }));
                          }}
                          className="w-full p-2 border rounded"
                        >
                          {product.variants.map(variant => (
                            <option key={variant.id} value={variant.id}>
                              {variant.display_name}
                            </option>
                          ))}
                        </select>

                        <span className="text-xs text-gray-500">
                          {product.variantCount} varianti
                        </span>
                      </>
                    )}
                  </div>
                </td>

                <td className="px-4 py-2 border">
                  {getDisplayStock(product)} {product.uom}
                </td>

                <td className="px-4 py-2 border">
                  {product.supplier_name}
                </td>

                <td className="px-4 py-2 border">
                  {/* Assignment buttons here */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## Summary Checklist

- [ ] Update backend API to detect variants
- [ ] Load all variants for multi-variant products
- [ ] Add variant selector UI component
- [ ] Track selected variant in state
- [ ] Update stock display for selected variant
- [ ] Use selected variant ID for assignments
- [ ] Test with real multi-variant products
- [ ] Handle single-variant products (no UI change)

**Estimated Time**: 2-3 hours for basic implementation
**Risk Level**: Low (no database changes, backward compatible)
