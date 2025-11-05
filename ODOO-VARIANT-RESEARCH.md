# Odoo Product Variants - Complete Research Document

## Overview
This document contains complete research on how Odoo handles product variants, including RPC calls, field structures, and implementation recommendations for the pre-order system.

---

## 1. Odoo Variant Architecture

### Key Models

#### `product.template`
- The parent/template product
- Contains common attributes shared by all variants
- Fields:
  - `product_variant_count`: Number of variants (1 = no variants, >1 = has variants)
  - `product_variant_ids`: List of variant IDs (product.product IDs)
  - `attribute_line_ids`: List of attribute line IDs
  - `has_configurable_attributes`: Boolean indicating if template has configurable attributes

#### `product.product`
- The actual variant/SKU
- Each variant is a unique product with its own ID
- Fields:
  - `id`: Unique variant ID
  - `name`: Base product name (same as template)
  - `display_name`: **FULL NAME WITH ATTRIBUTES** (e.g., "PASTA RIPIENA (Quadrato, Verde, 1000gr)")
  - `product_tmpl_id`: [ID, Name] of parent template
  - `product_template_attribute_value_ids`: List of attribute value IDs that define this variant
  - `default_code`: SKU/Internal reference
  - `barcode`: Barcode
  - `lst_price`: Sale price
  - `qty_available`: Stock quantity
  - `image_128`: Product image (base64)

#### `product.template.attribute.line`
- Links attributes to templates
- Fields:
  - `attribute_id`: [ID, Name] of the attribute (e.g., [14, "Formato"])
  - `value_ids`: List of possible values for this attribute

#### `product.template.attribute.value`
- Links specific attribute values to the template
- Fields:
  - `id`: Unique ID
  - `name`: Value name (e.g., "Quadrato")
  - `display_name`: Full display (e.g., "Formato: Quadrato")
  - `product_attribute_value_id`: [ID, DisplayName] of the value
  - `attribute_id`: [ID, Name] of the attribute
  - `product_tmpl_id`: [ID, Name] of the template
  - `price_extra`: Additional price for this variant
  - `html_color`: Color code (if color attribute)

---

## 2. Real-World Example

### Template with Variants
From live Odoo instance:

**Template:**
```json
{
  "id": 13109,
  "name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC",
  "product_variant_count": 12,
  "product_variant_ids": [22915, 22916, 22917, ...],
  "attribute_line_ids": [689, 3592, 3593, 3594],
  "has_configurable_attributes": true
}
```

**Attributes:**
1. **Brand** (Brand): "PASTIFICIO MARCELLO"
2. **Formato** (Shape): "Quadrato", "mezzaluna", "Treccia"
3. **Colore** (Color): "Normale", "Verde"
4. **Peso** (Weight): "250gr", "1000gr"

**Example Variant:**
```json
{
  "id": 22915,
  "name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC",
  "display_name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC (Quadrato, Normale, 1000gr)",
  "product_tmpl_id": [13109, "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC"],
  "product_template_attribute_value_ids": [683, 3939, 3940, 3942],
  "lst_price": 25.93,
  "qty_available": 0
}
```

---

## 3. API Calls

### 3.1 Check if Product Has Variants

```javascript
// Method 1: From product.template
const templates = await rpc.searchRead(
  'product.template',
  [['id', '=', templateId]],
  ['product_variant_count', 'product_variant_ids']
);

const hasVariants = templates[0].product_variant_count > 1;
```

```javascript
// Method 2: From product.product (when you have variant ID)
const products = await rpc.searchRead(
  'product.product',
  [['id', '=', productId]],
  ['product_tmpl_id']
);

const templateId = products[0].product_tmpl_id[0];

// Then check variant count on template
const templates = await rpc.searchRead(
  'product.template',
  [['id', '=', templateId]],
  ['product_variant_count']
);

const hasVariants = templates[0].product_variant_count > 1;
```

### 3.2 Get All Variants for a Template

```javascript
const variants = await rpc.searchRead(
  'product.product',
  [['product_tmpl_id', '=', templateId]],
  [
    'id',
    'name',
    'display_name',        // ⭐ USE THIS for display!
    'default_code',
    'barcode',
    'lst_price',
    'qty_available',
    'image_128',
    'product_template_attribute_value_ids'
  ]
);
```

### 3.3 Get Attribute Details (Optional - for advanced UI)

```javascript
// Get attribute lines for template
const attributeLines = await rpc.searchRead(
  'product.template.attribute.line',
  [['id', 'in', template.attribute_line_ids]],
  ['attribute_id', 'value_ids', 'product_tmpl_id']
);

// Get attribute details
const attributeIds = attributeLines.map(line => line.attribute_id[0]);
const attributes = await rpc.searchRead(
  'product.attribute',
  [['id', 'in', attributeIds]],
  ['id', 'name', 'display_type']
);

// Get all attribute values
const allValueIds = attributeLines.reduce((acc, line) => [...acc, ...line.value_ids], []);
const attributeValues = await rpc.searchRead(
  'product.attribute.value',
  [['id', 'in', allValueIds]],
  ['id', 'name', 'attribute_id', 'html_color']
);
```

---

## 4. Implementation for Pre-Order System

### 4.1 Modified Pre-Order Products API

**Location:** `app/api/smart-ordering-v2/pre-order-products/route.ts`

```typescript
// Current code gets product.product
const products = await rpc.searchRead(
  'product.product',
  [
    ['product_tmpl_id', 'in', templateIds],
    ['active', '=', true]
  ],
  [
    'id',
    'name',
    'display_name',              // ADD THIS
    'default_code',
    'qty_available',
    'uom_id',
    'seller_ids',
    'product_tmpl_id'
  ]
);

// Then check for variants
const enrichedProducts = await Promise.all(products.map(async (product) => {
  const templateId = product.product_tmpl_id[0];

  // Check if this template has variants
  const templates = await rpc.searchRead(
    'product.template',
    [['id', '=', templateId]],
    ['product_variant_count', 'product_variant_ids']
  );

  const hasVariants = templates[0].product_variant_count > 1;

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
    variantCount: templates[0].product_variant_count,
    variants: variants
  };
}));
```

### 4.2 Frontend Data Structure

```typescript
interface PreOrderProduct {
  id: number;
  name: string;
  image_url: string;
  stock: number;
  uom: string;
  supplier_name: string;
  supplier_id: number;
  hasPreOrderTag: boolean;
  assigned_customers: AssignedCustomer[];

  // NEW VARIANT FIELDS
  hasVariants: boolean;
  variantCount: number;
  variants?: ProductVariant[];
  selectedVariantId?: number;  // For tracking user selection
}

interface ProductVariant {
  id: number;
  display_name: string;  // e.g., "PASTA (Quadrato, Verde, 1000gr)"
  qty_available: number;
  lst_price: number;
  default_code?: string;
  image_128?: string;
}
```

### 4.3 UI Components

#### Option 1: Dropdown (Best for 6+ variants)

```tsx
{product.hasVariants && (
  <select
    value={product.selectedVariantId || product.id}
    onChange={(e) => handleVariantChange(product.id, parseInt(e.target.value))}
    className="w-full p-2 border rounded"
  >
    {product.variants.map(variant => (
      <option key={variant.id} value={variant.id}>
        {variant.display_name} - Stock: {variant.qty_available}
      </option>
    ))}
  </select>
)}
```

#### Option 2: Radio Buttons (Best for 2-5 variants)

```tsx
{product.hasVariants && (
  <div className="space-y-2">
    {product.variants.map(variant => (
      <label key={variant.id} className="flex items-center space-x-2">
        <input
          type="radio"
          name={`variant-${product.id}`}
          value={variant.id}
          checked={product.selectedVariantId === variant.id}
          onChange={() => handleVariantChange(product.id, variant.id)}
        />
        <span>{variant.display_name}</span>
        <span className="text-sm text-gray-500">
          (Stock: {variant.qty_available})
        </span>
      </label>
    ))}
  </div>
)}
```

#### Option 3: Expandable Row (Best for complex products)

```tsx
<tr>
  <td colSpan={7}>
    {product.hasVariants && (
      <button
        onClick={() => toggleVariantExpansion(product.id)}
        className="flex items-center space-x-2"
      >
        <ChevronDown className={expanded ? 'rotate-180' : ''} />
        <span>{product.variantCount} varianti disponibili</span>
      </button>
    )}

    {expanded && (
      <div className="p-4 bg-gray-50">
        <div className="grid grid-cols-3 gap-4">
          {product.variants.map(variant => (
            <div
              key={variant.id}
              className={`p-3 border rounded cursor-pointer ${
                product.selectedVariantId === variant.id ? 'border-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleVariantChange(product.id, variant.id)}
            >
              <div className="font-medium">{variant.display_name}</div>
              <div className="text-sm text-gray-600">
                Stock: {variant.qty_available} | Prezzo: €{variant.lst_price}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </td>
</tr>
```

---

## 5. Database Considerations

### 5.1 Update `preorder_customer_assignments` Table

```sql
-- Current schema
CREATE TABLE preorder_customer_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,  -- This is product.product ID (variant ID)
  customer_id INTEGER NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Keep as-is! product_id already refers to variant ID
-- No changes needed - existing structure supports variants
```

The current schema is already correct because:
- `product_id` stores `product.product.id` (variant ID)
- Each variant has a unique ID
- When querying, we get the exact variant assigned

---

## 6. Example Workflow

### User Story: Assigning a variant to a customer

1. **API loads products with PRE-ORDINE tag**
   - Returns templates
   - For each template, checks `product_variant_count`
   - If > 1, loads all variants

2. **User sees product row**
   - If `hasVariants === false`: Normal product (current behavior)
   - If `hasVariants === true`: Shows variant selector

3. **User selects variant**
   - Frontend updates `selectedVariantId`
   - Uses selected variant ID for all operations

4. **User assigns to customer**
   - Saves `selectedVariantId` (not template ID!) to database
   - Each customer can be assigned different variants of same template

5. **Creating pre-orders**
   - When creating supplier order, uses variant ID
   - Odoo receives correct `product.product` ID with exact variant

---

## 7. Key Insights

### ✅ What Works

1. **`display_name` is the key field**
   - Odoo automatically formats it with variant attributes
   - Example: "PASTA (Quadrato, Verde, 1000gr)"
   - No need to manually parse attributes

2. **Each variant is a unique product**
   - Has own ID, stock, price
   - Can be treated independently

3. **Existing code already uses variant IDs**
   - Current `product_id` in database is correct
   - No migration needed

### ⚠️ Important Considerations

1. **Template vs Variant**
   - `product.template` = parent/template
   - `product.product` = actual sellable variant
   - Always use `product.product.id` for orders/assignments

2. **Single-variant products**
   - If `product_variant_count === 1`, still has one variant
   - That one variant IS the product
   - Treat as normal product (no variant selector needed)

3. **Stock is per-variant**
   - Each variant has independent `qty_available`
   - Must check stock on selected variant

---

## 8. Testing Script

Location: `c:/Users/lapa/OneDrive/Desktop/Claude Code/scripts/test-odoo-variants.js`

Run with:
```bash
node scripts/test-odoo-variants.js
```

This script:
- Connects to live Odoo instance
- Finds products with variants
- Explores all variant fields
- Shows real-world examples

---

## 9. Next Steps for Implementation

### Phase 1: Backend API Changes
1. ✅ Modify `pre-order-products/route.ts` to include variant detection
2. ✅ Load all variants when `product_variant_count > 1`
3. ✅ Return enriched product data with variants array

### Phase 2: Frontend UI
1. Add variant selector component (dropdown/radio/expandable)
2. Track `selectedVariantId` in state
3. Update assignment logic to use selected variant ID

### Phase 3: Order Creation
1. Ensure supplier orders use variant ID (not template ID)
2. Validate stock on selected variant
3. Test with real multi-variant products

---

## 10. Code Snippets from Codebase

### Current pre-order-products route.ts (line 62-77)

```typescript
const products = await rpc.searchRead(
  'product.product',
  [
    ['product_tmpl_id', 'in', templateIds],
    ['active', '=', true]
  ],
  [
    'id',
    'name',
    'default_code',
    'qty_available',
    'uom_id',
    'seller_ids',
    'product_tmpl_id'  // Already loading this - can use to check variants!
  ]
);
```

### Existing variant handling in codebase

From `verifica-fornitore-odoo.js`:
```javascript
// Example of using product_tmpl_id to link products
const product = await searchRead(
  'product.product',
  [[['id', '=', productId]]],
  { fields: ['product_tmpl_id', 'seller_ids'] }
);

const productTmplId = product.product_tmpl_id[0];
```

---

## 11. Summary

### Key Takeaways

1. **RPC Call**: `product.product.search_read` with domain `[['product_tmpl_id', '=', templateId]]`
2. **Essential Fields**: `id`, `display_name`, `qty_available`, `lst_price`
3. **Variant Detection**: Check `product_variant_count > 1` on template
4. **Display**: Use `display_name` field directly (Odoo formats it)
5. **UI Pattern**:
   - 2-5 variants → Radio buttons or cards
   - 6+ variants → Dropdown
   - Complex → Expandable row with grid

### No Breaking Changes Required

- ✅ Database schema already supports variants (stores `product.product.id`)
- ✅ Existing code uses correct IDs
- ✅ Only need to add variant selection UI
- ✅ Backend needs minimal changes (add variant loading)

---

## Appendix: Odoo Credentials

From `.env.local`:
```
ODOO_URL=https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
ODOO_DB=lapadevadmin-lapa-v2-main-7268478
ODOO_ADMIN_EMAIL=apphubplatform@lapa.ch
ODOO_ADMIN_PASSWORD=apphubplatform2025
```
