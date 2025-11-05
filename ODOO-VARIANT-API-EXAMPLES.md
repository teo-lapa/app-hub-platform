# Odoo Variant API - Executable Examples

## Quick Reference: RPC Calls for Product Variants

All examples use the Odoo instance from `.env.local`:
- **URL**: `https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com`
- **DB**: `lapadevadmin-lapa-v2-main-7268478`
- **Email**: `apphubplatform@lapa.ch`
- **Password**: `apphubplatform2025`

---

## 1. Authenticate

```javascript
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_EMAIL,
        password: ODOO_PASSWORD,
      },
    }),
  });

  const data = await response.json();
  const cookies = response.headers.get('set-cookie');
  const sessionMatch = cookies?.match(/session_id=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  return { uid: data.result.uid, sessionId };
}
```

---

## 2. Check if Product Has Variants

### From product.product ID

```javascript
async function checkVariantsFromProduct(sessionId, productId) {
  // Step 1: Get the template ID
  const product = await callOdoo(
    sessionId,
    'product.product',
    'search_read',
    [[['id', '=', productId]]],
    { fields: ['product_tmpl_id'] }
  );

  const templateId = product[0].product_tmpl_id[0];

  // Step 2: Check variant count on template
  const template = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [[['id', '=', templateId]]],
    { fields: ['product_variant_count', 'product_variant_ids'] }
  );

  const hasVariants = template[0].product_variant_count > 1;

  return {
    hasVariants,
    variantCount: template[0].product_variant_count,
    variantIds: template[0].product_variant_ids,
    templateId
  };
}
```

### From product.template ID

```javascript
async function checkVariantsFromTemplate(sessionId, templateId) {
  const template = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [[['id', '=', templateId]]],
    { fields: ['product_variant_count', 'product_variant_ids'] }
  );

  return {
    hasVariants: template[0].product_variant_count > 1,
    variantCount: template[0].product_variant_count,
    variantIds: template[0].product_variant_ids
  };
}
```

---

## 3. Get All Variants for a Template

```javascript
async function getAllVariants(sessionId, templateId) {
  const variants = await callOdoo(
    sessionId,
    'product.product',
    'search_read',
    [[['product_tmpl_id', '=', templateId]]],
    {
      fields: [
        'id',
        'name',
        'display_name',  // ⭐ MOST IMPORTANT FIELD
        'default_code',
        'barcode',
        'lst_price',
        'qty_available',
        'image_128',
        'product_template_attribute_value_ids'
      ]
    }
  );

  return variants;
}
```

**Example Response:**

```json
[
  {
    "id": 22915,
    "name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC",
    "display_name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC (Quadrato, Normale, 1000gr)",
    "default_code": false,
    "barcode": false,
    "lst_price": 25.93,
    "qty_available": 0,
    "product_template_attribute_value_ids": [683, 3939, 3940, 3942]
  },
  {
    "id": 22916,
    "name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC",
    "display_name": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC (Quadrato, Normale, 250gr)",
    "default_code": false,
    "barcode": false,
    "lst_price": 25.93,
    "qty_available": 0,
    "product_template_attribute_value_ids": [683, 3939, 3940, 3943]
  }
]
```

---

## 4. Get Variant Attribute Details (Advanced)

### Get attribute structure for UI building

```javascript
async function getVariantAttributeStructure(sessionId, templateId) {
  // Step 1: Get template
  const template = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [[['id', '=', templateId]]],
    { fields: ['attribute_line_ids'] }
  );

  // Step 2: Get attribute lines
  const attributeLines = await callOdoo(
    sessionId,
    'product.template.attribute.line',
    'search_read',
    [[['id', 'in', template[0].attribute_line_ids]]],
    { fields: ['attribute_id', 'value_ids'] }
  );

  // Step 3: Get attribute details
  const attributeIds = attributeLines.map(line => line.attribute_id[0]);
  const attributes = await callOdoo(
    sessionId,
    'product.attribute',
    'search_read',
    [[['id', 'in', attributeIds]]],
    { fields: ['id', 'name', 'display_type'] }
  );

  // Step 4: Get all values
  const allValueIds = attributeLines.flatMap(line => line.value_ids);
  const values = await callOdoo(
    sessionId,
    'product.attribute.value',
    'search_read',
    [[['id', 'in', allValueIds]]],
    { fields: ['id', 'name', 'attribute_id', 'html_color'] }
  );

  return {
    attributes,
    attributeLines,
    values
  };
}
```

**Example Response:**

```json
{
  "attributes": [
    { "id": 1, "name": "Brand", "display_type": "radio" },
    { "id": 14, "name": "Formato", "display_type": "radio" },
    { "id": 13, "name": "Colore", "display_type": "color" },
    { "id": 15, "name": "Peso", "display_type": "select" }
  ],
  "attributeLines": [
    { "attribute_id": [1, "Brand"], "value_ids": [98] },
    { "attribute_id": [14, "Formato"], "value_ids": [504, 505, 516] },
    { "attribute_id": [13, "Colore"], "value_ids": [500, 511] },
    { "attribute_id": [15, "Peso"], "value_ids": [506, 509] }
  ],
  "values": [
    { "id": 98, "name": "PASTIFICIO MARCELLO", "attribute_id": [1, "Brand"] },
    { "id": 504, "name": "Treccia", "attribute_id": [14, "Formato"] },
    { "id": 516, "name": "Quadrato", "attribute_id": [14, "Formato"] },
    { "id": 500, "name": "Verde", "attribute_id": [13, "Colore"], "html_color": "#00FF00" },
    { "id": 511, "name": "Normale", "attribute_id": [13, "Colore"] },
    { "id": 506, "name": "250gr", "attribute_id": [15, "Peso"] },
    { "id": 509, "name": "1000gr", "attribute_id": [15, "Peso"] }
  ]
}
```

---

## 5. Complete Helper Function

### Universal variant loader

```javascript
async function loadProductWithVariants(sessionId, productId) {
  // 1. Get product and template ID
  const products = await callOdoo(
    sessionId,
    'product.product',
    'search_read',
    [[['id', '=', productId]]],
    {
      fields: [
        'id',
        'name',
        'display_name',
        'product_tmpl_id',
        'qty_available',
        'lst_price',
        'default_code',
        'image_128'
      ]
    }
  );

  const product = products[0];
  const templateId = product.product_tmpl_id[0];

  // 2. Check if template has variants
  const templates = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [[['id', '=', templateId]]],
    { fields: ['product_variant_count', 'product_variant_ids'] }
  );

  const hasVariants = templates[0].product_variant_count > 1;

  // 3. Load all variants if applicable
  let variants = [];
  if (hasVariants) {
    variants = await callOdoo(
      sessionId,
      'product.product',
      'search_read',
      [[['product_tmpl_id', '=', templateId]]],
      {
        fields: [
          'id',
          'display_name',
          'qty_available',
          'lst_price',
          'default_code',
          'image_128'
        ]
      }
    );
  }

  return {
    product,
    hasVariants,
    variantCount: templates[0].product_variant_count,
    variants
  };
}
```

**Usage:**

```javascript
const { uid, sessionId } = await authenticate();

const result = await loadProductWithVariants(sessionId, 22915);

console.log('Product:', result.product.display_name);
console.log('Has variants:', result.hasVariants);
console.log('Variant count:', result.variantCount);

if (result.hasVariants) {
  console.log('\nAll variants:');
  result.variants.forEach(v => {
    console.log(`  - ${v.display_name} (Stock: ${v.qty_available})`);
  });
}
```

---

## 6. RPC Client Helper

### Generic Odoo RPC function

```javascript
async function callOdoo(sessionId, model, method, args = [], kwargs = {}) {
  const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs,
      },
      id: Math.floor(Math.random() * 1000000),
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}
```

---

## 7. Use Cases

### Use Case 1: Load pre-order products with variants

```javascript
async function loadPreOrderProductsWithVariants(sessionId, preOrderTagId) {
  // 1. Get templates with PRE-ORDINE tag
  const templates = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [
      [
        ['product_tag_ids', 'in', [preOrderTagId]],
        ['active', '=', true]
      ]
    ],
    { fields: ['id', 'product_variant_count', 'product_variant_ids'] }
  );

  // 2. Load products from templates
  const templateIds = templates.map(t => t.id);

  const products = await callOdoo(
    sessionId,
    'product.product',
    'search_read',
    [
      [
        ['product_tmpl_id', 'in', templateIds],
        ['active', '=', true]
      ]
    ],
    {
      fields: [
        'id',
        'name',
        'display_name',
        'product_tmpl_id',
        'qty_available',
        'default_code',
        'seller_ids',
        'image_128'
      ]
    }
  );

  // 3. Enrich with variant info
  const enriched = await Promise.all(
    products.map(async (product) => {
      const templateId = product.product_tmpl_id[0];
      const template = templates.find(t => t.id === templateId);

      const hasVariants = template.product_variant_count > 1;

      let variants = [];
      if (hasVariants) {
        variants = await callOdoo(
          sessionId,
          'product.product',
          'search_read',
          [[['product_tmpl_id', '=', templateId]]],
          {
            fields: [
              'id',
              'display_name',
              'qty_available',
              'lst_price',
              'default_code'
            ]
          }
        );
      }

      return {
        ...product,
        hasVariants,
        variantCount: template.product_variant_count,
        variants
      };
    })
  );

  return enriched;
}
```

### Use Case 2: Find products with variants

```javascript
async function findProductsWithVariants(sessionId, limit = 10) {
  // Get templates with multiple variants
  const templates = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [
      [
        ['product_variant_count', '>', 1],
        ['active', '=', true]
      ]
    ],
    {
      fields: ['id', 'name', 'product_variant_count', 'product_variant_ids'],
      limit
    }
  );

  console.log(`Found ${templates.length} products with variants`);

  templates.forEach(t => {
    console.log(`  - ${t.name} (${t.product_variant_count} variants)`);
  });

  return templates;
}
```

---

## 8. Testing Script Template

```javascript
// test-variants.js
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// ... (include authenticate and callOdoo functions from above)

async function main() {
  // Authenticate
  const { uid, sessionId } = await authenticate();
  console.log('✅ Authenticated as UID:', uid);

  // Test 1: Find products with variants
  console.log('\n📦 Finding products with variants...');
  const templatesWithVariants = await findProductsWithVariants(sessionId, 5);

  if (templatesWithVariants.length > 0) {
    const template = templatesWithVariants[0];

    // Test 2: Load full variant details
    console.log(`\n🔍 Loading variants for: ${template.name}`);
    const variants = await getAllVariants(sessionId, template.id);

    console.log(`\n✅ Found ${variants.length} variants:`);
    variants.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.display_name}`);
      console.log(`     Stock: ${v.qty_available}, Price: €${v.lst_price}`);
    });

    // Test 3: Get attribute structure
    console.log(`\n🏷️ Loading attribute structure...`);
    const structure = await getVariantAttributeStructure(sessionId, template.id);

    console.log('Attributes:');
    structure.attributes.forEach(attr => {
      console.log(`  - ${attr.name} (${attr.display_type})`);
    });
  }
}

main().catch(console.error);
```

Run with:
```bash
node test-variants.js
```

---

## 9. Key Field Reference

### Must-Have Fields

| Field | Model | Purpose |
|-------|-------|---------|
| `display_name` | product.product | **USE THIS!** Full name with variant attributes |
| `product_tmpl_id` | product.product | Link to parent template |
| `product_variant_count` | product.template | Number of variants (1 = no variants) |
| `product_variant_ids` | product.template | List of all variant IDs |
| `qty_available` | product.product | Stock (per variant!) |
| `lst_price` | product.product | Price (per variant!) |

### Optional Fields (Advanced UI)

| Field | Model | Purpose |
|-------|-------|---------|
| `attribute_line_ids` | product.template | Links to attribute lines |
| `product_template_attribute_value_ids` | product.product | Attribute values for this variant |
| `html_color` | product.attribute.value | Color hex code |
| `price_extra` | product.template.attribute.value | Extra price for variant |
| `image_128` | product.product | Variant-specific image |

---

## 10. Common Queries

### Get single variant by ID
```javascript
await callOdoo(sessionId, 'product.product', 'search_read',
  [[['id', '=', 22915]]],
  { fields: ['id', 'display_name', 'qty_available'] }
);
```

### Get all variants for template
```javascript
await callOdoo(sessionId, 'product.product', 'search_read',
  [[['product_tmpl_id', '=', 13109]]],
  { fields: ['id', 'display_name', 'qty_available'] }
);
```

### Check if product has variants
```javascript
const product = await callOdoo(sessionId, 'product.product', 'read',
  [[22915]],
  { fields: ['product_tmpl_id'] }
);

const template = await callOdoo(sessionId, 'product.template', 'read',
  [[product[0].product_tmpl_id[0]]],
  { fields: ['product_variant_count'] }
);

const hasVariants = template[0].product_variant_count > 1;
```

### Search products by name with variant info
```javascript
const products = await callOdoo(sessionId, 'product.product', 'search_read',
  [[['name', 'ilike', 'pasta']]],
  {
    fields: ['id', 'display_name', 'product_tmpl_id', 'qty_available'],
    limit: 20
  }
);

// Then check each for variants using product_tmpl_id
```

---

## Summary

**Essential Flow:**
1. Get product → Extract `product_tmpl_id`
2. Check template → Get `product_variant_count`
3. If > 1 → Load all variants with `display_name`
4. Display variants to user
5. Use selected variant ID (not template ID!) for operations

**Key Insight:**
Always use `display_name` field - it contains the full variant name with all attributes pre-formatted by Odoo.
