/**
 * PRODUCT INTELLIGENCE TOOLS
 * Tools for Agent 2: Product Intelligence Agent
 */

import { sql } from '@vercel/postgres';
import type { AgentTool, ProductIntelligence } from '../types';

// ============================================================================
// TOOL 2.1: get_product_info
// ============================================================================

export const getProductInfoTool: AgentTool = {
  name: 'get_product_info',
  description:
    'Get detailed information about a product including sales metrics, trends, customer segments, and pairing suggestions.',
  input_schema: {
    type: 'object',
    properties: {
      product_id: {
        type: 'number',
        description: 'Product ID (internal database ID)',
      },
      product_name: {
        type: 'string',
        description: 'Product name to search for (alternative to product_id)',
      },
    },
    required: [],
  },
  handler: async (input: { product_id?: number; product_name?: string }) => {
    console.log('🔍 get_product_info', input);

    let query;

    if (input.product_id) {
      query = sql`
        SELECT * FROM product_intelligence
        WHERE id = ${input.product_id}
        LIMIT 1
      `;
    } else if (input.product_name) {
      query = sql`
        SELECT * FROM product_intelligence
        WHERE product_name ILIKE ${`%${input.product_name}%`}
        ORDER BY total_revenue DESC
        LIMIT 1
      `;
    } else {
      throw new Error('Either product_id or product_name must be provided');
    }

    const result = await query;

    if (result.rows.length === 0) {
      return {
        found: false,
        message: 'Product not found',
      };
    }

    const row = result.rows[0];

    const product: ProductIntelligence = {
      id: row.id,
      odoo_product_id: row.odoo_product_id,
      product_name: row.product_name,
      product_category: row.product_category,
      product_code: row.product_code,

      total_quantity_sold: row.total_quantity_sold,
      total_revenue: parseFloat(row.total_revenue),
      avg_price: row.avg_price ? parseFloat(row.avg_price) : null,
      units_sold_last_30d: row.units_sold_last_30d,
      units_sold_last_90d: row.units_sold_last_90d,

      trend_30d: row.trend_30d,
      growth_rate_30d: row.growth_rate_30d ? parseFloat(row.growth_rate_30d) : null,
      velocity_score: row.velocity_score,

      total_customers: row.total_customers,
      top_customer_segments: row.top_customer_segments
        ? JSON.parse(row.top_customer_segments)
        : [],
      customer_satisfaction_avg: row.customer_satisfaction_avg
        ? parseFloat(row.customer_satisfaction_avg)
        : null,

      best_paired_products: row.best_paired_products
        ? JSON.parse(row.best_paired_products)
        : [],
      similar_products: row.similar_products,
      seasonal_pattern: row.seasonal_pattern,
      recommended_for_segments: row.recommended_for_segments,

      current_stock: row.current_stock,
      stock_status: row.stock_status,

      last_calculated: row.last_calculated,
      updated_at: row.updated_at,
    };

    return {
      found: true,
      product,
    };
  },
};

// ============================================================================
// TOOL 2.2: find_product_opportunities
// ============================================================================

export const findProductOpportunitiesTool: AgentTool = {
  name: 'find_product_opportunities',
  description:
    'Analyze a customer and find cross-sell and upsell opportunities based on their purchase history and preferences.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number }) => {
    console.log('🔍 find_product_opportunities', input);

    // Get customer profile
    const customerResult = await sql`
      SELECT
        id, name, top_products, product_categories,
        avg_order_value, upsell_potential_score,
        personality_type
      FROM customer_avatars
      WHERE id = ${input.customer_id}
      LIMIT 1
    `;

    if (customerResult.rows.length === 0) {
      return {
        found: false,
        message: 'Customer not found',
      };
    }

    const customer = customerResult.rows[0];
    const topProducts = JSON.parse(customer.top_products || '[]');
    const productCategories = JSON.parse(customer.product_categories || '{}');

    const opportunities: any[] = [];

    // CROSS-SELL: Products they don't buy but are often paired with what they buy
    if (topProducts.length > 0) {
      const topProductIds = topProducts.map((p: any) => p.product_id);

      // Get products frequently bought together (limit to first 10 for SQL query)
      const idsForQuery = topProductIds.slice(0, 10);

      const pairingResult = await sql.query(
        `SELECT p.id, p.product_name, p.avg_price, p.best_paired_products
         FROM product_intelligence p
         WHERE p.id = ANY($1::int[])
         AND p.best_paired_products IS NOT NULL
         LIMIT 3`,
        [idsForQuery]
      );

      for (const row of pairingResult.rows) {
        const pairings = JSON.parse(row.best_paired_products || '[]');
        for (const pairing of pairings) {
          // Check if customer doesn't already buy this product
          if (!topProductIds.includes(pairing.product_id)) {
            opportunities.push({
              type: 'cross_sell',
              current_product: row.product_name,
              suggested_product_id: pairing.product_id,
              suggested_product_name: pairing.product_name,
              reasoning: `Buys ${row.product_name} frequently but never tried ${pairing.product_name} (often bought together by ${pairing.pairing_frequency}% of customers)`,
              probability: pairing.pairing_frequency / 100,
              estimated_order_value: parseFloat(row.avg_price || 0),
            });
          }
        }
      }
    }

    // UPSELL: Premium versions of products they already buy
    if (customer.upsell_potential_score >= 60 && topProducts.length > 0) {
      // Get similar (premium) products
      for (const topProduct of topProducts.slice(0, 2)) {
        const upsellResult = await sql`
          SELECT
            id, product_name, avg_price, product_category
          FROM product_intelligence
          WHERE product_category = (
            SELECT product_category FROM product_intelligence WHERE odoo_product_id = ${topProduct.product_id}
          )
          AND avg_price > (
            SELECT avg_price * 1.2 FROM product_intelligence WHERE odoo_product_id = ${topProduct.product_id}
          )
          ORDER BY avg_price ASC
          LIMIT 1
        `;

        if (upsellResult.rows.length > 0) {
          const upsell = upsellResult.rows[0];
          opportunities.push({
            type: 'upsell',
            current_product: topProduct.product_name,
            current_product_id: topProduct.product_id,
            suggested_product_id: upsell.id,
            suggested_product_name: upsell.product_name,
            reasoning: `Customer ${customer.personality_type || 'quality-focused'}, buys ${topProduct.product_name} regularly. Premium version could appeal.`,
            probability: customer.upsell_potential_score / 100,
            price_difference: parseFloat(upsell.avg_price) - topProduct.total_revenue / topProduct.times_purchased,
            estimated_additional_revenue: (parseFloat(upsell.avg_price) - topProduct.total_revenue / topProduct.times_purchased) * 3,
          });
        }
      }
    }

    return {
      customer_id: input.customer_id,
      customer_name: customer.name,
      total_opportunities: opportunities.length,
      opportunities: opportunities.slice(0, 5),
    };
  },
};

// ============================================================================
// TOOL 2.3: get_product_trends
// ============================================================================

export const getProductTrendsTool: AgentTool = {
  name: 'get_product_trends',
  description:
    'Get trending products (growing, declining, stable) for a specific time period and category.',
  input_schema: {
    type: 'object',
    properties: {
      period_days: {
        type: 'number',
        description: 'Period to analyze (default: 30 days)',
      },
      category: {
        type: 'string',
        description: 'Product category to filter by (optional)',
      },
      trend_type: {
        type: 'string',
        description: 'Filter by trend type: growing, declining, stable (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 10)',
      },
    },
    required: [],
  },
  handler: async (input: {
    period_days?: number;
    category?: string;
    trend_type?: string;
    limit?: number;
  }) => {
    console.log('🔍 get_product_trends', input);

    const limit = input.limit || 10;
    const periodDays = input.period_days || 30;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.category) {
      conditions.push(`product_category ILIKE $${paramIndex}`);
      params.push(`%${input.category}%`);
      paramIndex++;
    }

    if (input.trend_type) {
      conditions.push(`trend_30d = $${paramIndex}`);
      params.push(input.trend_type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryText = `
      SELECT
        id, product_name, product_category, product_code,
        total_quantity_sold, total_revenue,
        units_sold_last_30d, units_sold_last_90d,
        trend_30d, growth_rate_30d, velocity_score,
        total_customers
      FROM product_intelligence
      ${whereClause}
      ORDER BY
        CASE
          WHEN trend_30d = 'growing' THEN 1
          WHEN trend_30d = 'stable' THEN 2
          WHEN trend_30d = 'declining' THEN 3
          ELSE 4
        END,
        ABS(growth_rate_30d) DESC,
        velocity_score DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await sql.query(queryText, params);

    return {
      period_days: periodDays,
      category: input.category || 'all',
      total_found: result.rows.length,
      products: result.rows.map((row) => ({
        id: row.id,
        product_name: row.product_name,
        product_category: row.product_category,
        product_code: row.product_code,
        total_quantity_sold: row.total_quantity_sold,
        total_revenue: parseFloat(row.total_revenue),
        units_sold_last_30d: row.units_sold_last_30d,
        units_sold_last_90d: row.units_sold_last_90d,
        trend_30d: row.trend_30d,
        growth_rate_30d: row.growth_rate_30d ? parseFloat(row.growth_rate_30d) : null,
        velocity_score: row.velocity_score,
        total_customers: row.total_customers,
      })),
    };
  },
};

// ============================================================================
// TOOL 2.4: suggest_products_for_customer
// ============================================================================

export const suggestProductsForCustomerTool: AgentTool = {
  name: 'suggest_products_for_customer',
  description:
    'Suggest new products for a customer based on their profile, purchase history, and what similar customers buy.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
      limit: {
        type: 'number',
        description: 'Maximum products to suggest (default: 5)',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number; limit?: number }) => {
    console.log('🔍 suggest_products_for_customer', input);

    const limit = input.limit || 5;

    // Get customer info
    const customerResult = await sql`
      SELECT
        name, top_products, product_categories,
        personality_type, total_revenue, avg_order_value
      FROM customer_avatars
      WHERE id = ${input.customer_id}
      LIMIT 1
    `;

    if (customerResult.rows.length === 0) {
      return {
        found: false,
        message: 'Customer not found',
      };
    }

    const customer = customerResult.rows[0];
    const topProducts = JSON.parse(customer.top_products || '[]');
    const productCategories = JSON.parse(customer.product_categories || '{}');
    const boughtProductIds = topProducts.map((p: any) => p.product_id);

    // Get products in same categories they like but haven't bought
    const mainCategories = Object.keys(productCategories).slice(0, 2);

    if (mainCategories.length === 0) {
      return {
        customer_id: input.customer_id,
        suggestions: [],
        message: 'No purchase history to base suggestions on',
      };
    }

    const suggestionsResult = await sql.query(
      `SELECT
        id, odoo_product_id, product_name, product_category,
        avg_price, velocity_score, total_customers,
        best_paired_products
      FROM product_intelligence
      WHERE product_category = ANY($1::text[])
        AND odoo_product_id != ALL($2::int[])
        AND velocity_score >= 50
      ORDER BY velocity_score DESC, total_customers DESC
      LIMIT $3`,
      [mainCategories, boughtProductIds, limit]
    );

    return {
      customer_id: input.customer_id,
      customer_name: customer.name,
      total_suggestions: suggestionsResult.rows.length,
      suggestions: suggestionsResult.rows.map((row) => ({
        product_id: row.id,
        odoo_product_id: row.odoo_product_id,
        product_name: row.product_name,
        product_category: row.product_category,
        avg_price: row.avg_price ? parseFloat(row.avg_price) : null,
        velocity_score: row.velocity_score,
        total_customers: row.total_customers,
        reasoning: `Popular in ${row.product_category} category (${row.total_customers} customers, velocity ${row.velocity_score}/100). Customer already buys in this category.`,
      })),
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const productTools: AgentTool[] = [
  getProductInfoTool,
  findProductOpportunitiesTool,
  getProductTrendsTool,
  suggestProductsForCustomerTool,
];
