/**
 * Test script to explore Odoo product variants
 *
 * This script connects to Odoo and explores:
 * 1. How to get all variants (product.product) for a template (product.template)
 * 2. What fields identify variants (product_template_attribute_value_ids, etc.)
 * 3. How to display variant names/attributes to users
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_EMAIL = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

  if (data.error) {
    throw new Error(`Auth failed: ${JSON.stringify(data.error)}`);
  }

  // Extract session_id from Set-Cookie header
  const cookies = response.headers.get('set-cookie');
  const sessionMatch = cookies?.match(/session_id=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  console.log('✅ Authenticated successfully');
  console.log('📝 User ID:', data.result.uid);
  console.log('🔑 Session ID:', sessionId);

  return { uid: data.result.uid, sessionId, cookies };
}

async function callOdoo(sessionId, model, method, args = [], kwargs = {}) {
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

async function exploreVariants() {
  console.log('\n🔍 === EXPLORING ODOO PRODUCT VARIANTS ===\n');

  // Step 1: Authenticate
  const { sessionId } = await authenticate();

  // Step 2: Find a product template that has variants
  console.log('\n📦 Step 1: Finding product templates with variants...\n');

  const templates = await callOdoo(
    sessionId,
    'product.template',
    'search_read',
    [
      [['active', '=', true]]
    ],
    {
      fields: [
        'id',
        'name',
        'product_variant_count',
        'product_variant_ids',
        'attribute_line_ids',
        'has_configurable_attributes'
      ],
      limit: 100
    }
  );

  // Filter templates with multiple variants
  const templatesWithVariants = templates.filter(t => t.product_variant_count > 1);

  console.log(`✅ Found ${templates.length} total templates`);
  console.log(`🎯 Found ${templatesWithVariants.length} templates WITH VARIANTS (>1 variant)`);

  if (templatesWithVariants.length > 0) {
    // Pick the first template with variants
    const template = templatesWithVariants[0];

    console.log('\n📋 Selected Template:');
    console.log(JSON.stringify(template, null, 2));

    // Step 3: Get ALL variants for this template
    console.log(`\n🔍 Step 2: Getting all variants for template "${template.name}"...\n`);

    const variants = await callOdoo(
      sessionId,
      'product.product',
      'search_read',
      [
        [['product_tmpl_id', '=', template.id]]
      ],
      {
        fields: [
          'id',
          'name',
          'display_name',
          'default_code',
          'product_tmpl_id',
          'product_template_attribute_value_ids',
          'product_template_variant_value_ids',
          'combination_indices',
          'barcode',
          'lst_price',
          'qty_available',
          'image_128',
          'active'
        ]
      }
    );

    console.log(`✅ Found ${variants.length} variants for template ID ${template.id}`);
    console.log('\n📦 All Variants:');
    console.log(JSON.stringify(variants, null, 2));

    // Step 4: Get attribute line details
    if (template.attribute_line_ids && template.attribute_line_ids.length > 0) {
      console.log(`\n🏷️ Step 3: Getting attribute line details...\n`);

      const attributeLines = await callOdoo(
        sessionId,
        'product.template.attribute.line',
        'search_read',
        [
          [['id', 'in', template.attribute_line_ids]]
        ],
        {
          fields: [
            'id',
            'attribute_id',
            'value_ids',
            'product_tmpl_id'
          ]
        }
      );

      console.log('📋 Attribute Lines:');
      console.log(JSON.stringify(attributeLines, null, 2));

      // Get attribute details
      const attributeIds = attributeLines.map(line => line.attribute_id[0]);

      const attributes = await callOdoo(
        sessionId,
        'product.attribute',
        'search_read',
        [
          [['id', 'in', attributeIds]]
        ],
        {
          fields: ['id', 'name', 'display_type']
        }
      );

      console.log('\n🔖 Attributes:');
      console.log(JSON.stringify(attributes, null, 2));

      // Get all value IDs from all lines
      const allValueIds = attributeLines.reduce((acc, line) => {
        return [...acc, ...line.value_ids];
      }, []);

      if (allValueIds.length > 0) {
        const attributeValues = await callOdoo(
          sessionId,
          'product.attribute.value',
          'search_read',
          [
            [['id', 'in', allValueIds]]
          ],
          {
            fields: ['id', 'name', 'attribute_id', 'html_color']
          }
        );

        console.log('\n🎨 Attribute Values:');
        console.log(JSON.stringify(attributeValues, null, 2));
      }
    }

    // Step 5: Get detailed variant attribute info
    if (variants.length > 0 && variants[0].product_template_attribute_value_ids) {
      console.log(`\n🔍 Step 4: Getting variant attribute value details...\n`);

      // Collect all unique attribute value IDs
      const variantAttrValueIds = new Set();
      variants.forEach(v => {
        if (v.product_template_attribute_value_ids) {
          v.product_template_attribute_value_ids.forEach(id => variantAttrValueIds.add(id));
        }
      });

      const variantAttrValues = await callOdoo(
        sessionId,
        'product.template.attribute.value',
        'search_read',
        [
          [['id', 'in', Array.from(variantAttrValueIds)]]
        ],
        {
          fields: [
            'id',
            'name',
            'display_name',
            'product_attribute_value_id',
            'attribute_id',
            'product_tmpl_id',
            'html_color',
            'price_extra'
          ]
        }
      );

      console.log('📋 Variant Attribute Values:');
      console.log(JSON.stringify(variantAttrValues, null, 2));
    }

    // Step 6: Summary and recommendations
    console.log('\n\n📊 === SUMMARY & RECOMMENDATIONS ===\n');
    console.log('✅ Key Findings:');
    console.log(`   - Template "${template.name}" has ${variants.length} variants`);
    console.log(`   - Each variant has unique product.product ID`);
    console.log(`   - Variants identified by product_template_attribute_value_ids`);
    console.log(`   - Display name shows variant attributes automatically`);
    console.log('\n💡 API Structure for Pre-Order System:');
    console.log('   1. Query: product.product.search_read with domain [["product_tmpl_id", "=", templateId]]');
    console.log('   2. Fields: id, name, display_name, default_code, qty_available, lst_price, product_template_attribute_value_ids');
    console.log('   3. Check if template has variants: product_variant_count > 1');
    console.log('   4. Display: Use display_name for full variant name (includes attributes)');
    console.log('\n🎯 UI Recommendation:');
    console.log('   - For 2-5 variants: Radio buttons or clickable cards');
    console.log('   - For 6+ variants: Dropdown select');
    console.log('   - For complex attributes: Expandable row with attribute selector');

  } else {
    console.log('❌ No templates with variants found. Trying to search for specific products...');

    // Try to find templates with "taglia" or "colore" in name (common variant keywords)
    const searchKeywords = ['taglia', 'colore', 'size', 'color', 'ml', 'kg', 'gr'];

    for (const keyword of searchKeywords) {
      const searchResults = await callOdoo(
        sessionId,
        'product.template',
        'search_read',
        [
          [
            '|',
            ['name', 'ilike', keyword],
            ['description', 'ilike', keyword]
          ]
        ],
        {
          fields: ['id', 'name', 'product_variant_count', 'product_variant_ids'],
          limit: 10
        }
      );

      const withVariants = searchResults.filter(t => t.product_variant_count > 1);

      if (withVariants.length > 0) {
        console.log(`\n✅ Found ${withVariants.length} templates with variants matching "${keyword}":`);
        withVariants.forEach(t => {
          console.log(`   - ${t.name} (${t.product_variant_count} variants)`);
        });
        break;
      }
    }
  }
}

// Run the exploration
exploreVariants().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
