/**
 * LAPA AI Chat v2 - Tool Definitions & Executors
 *
 * 13 tools that wrap existing agent classes.
 * customerId is injected server-side, NEVER from Claude.
 */

import { ProductsAgent } from '../agents/products-agent';
import { getInvoicesAgent } from '../agents/invoices-agent';
import { ShippingAgent } from '../agents/shipping-agent';
import { createHelpdeskAgent } from '../agents/helpdesk-agent';
import { getPartnerIdsForSearch } from '../agents/orders-agent';
import { getOdooClient } from '@/lib/odoo-client';
import type Anthropic from '@anthropic-ai/sdk';

type SupportedLanguage = 'it' | 'en' | 'fr' | 'de';
const VALID_LANGUAGES: SupportedLanguage[] = ['it', 'en', 'fr', 'de'];

function toLanguage(lang: string): SupportedLanguage {
  return VALID_LANGUAGES.includes(lang as SupportedLanguage) ? lang as SupportedLanguage : 'it';
}

// ============================================================================
// TOOL CONTEXT (injected server-side per request)
// ============================================================================

export interface ToolContext {
  customerId?: number;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  customerName?: string;
  customerEmail?: string;
  language: string;
  companyId?: number;
}

type ToolExecutor = (input: any, ctx: ToolContext) => Promise<any>;

// ============================================================================
// TOOL DEFINITIONS (Claude-facing schema)
// ============================================================================

export const ALL_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  // ---- PRODUCTS (no auth required) ----
  {
    name: 'search_products',
    description: 'Search the LAPA product catalog by name, keyword, ingredient, or category. Returns product names, prices, categories, and availability. Use this when a customer asks about any food product, ingredient, or recipe.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query: product name, ingredient, or food keyword (e.g. "mozzarella", "guanciale", "pasta")' },
        limit: { type: 'number', description: 'Max results to return (default 10, max 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_price',
    description: 'Get the personalized price of a specific product for this customer, considering their B2B pricelist and quantity discounts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'number', description: 'Odoo product ID' },
        quantity: { type: 'number', description: 'Quantity for price calculation (default 1)' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'check_availability',
    description: 'Check real-time stock availability for a product. Returns quantities available, incoming, and outgoing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'number', description: 'Odoo product ID to check' },
      },
      required: ['product_id'],
    },
  },

  // ---- ORDERS (auth required) ----
  {
    name: 'get_order_history',
    description: 'Get the customer\'s recent order history. Shows order numbers, dates, amounts, and status. Use when the customer asks "what did I order" or "my orders".',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max orders to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the customer\'s cart (draft quotation). If no cart exists, one is created automatically. Use when the customer confirms they want a product.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'number', description: 'Odoo product ID to add' },
        quantity: { type: 'number', description: 'Quantity to add' },
      },
      required: ['product_id', 'quantity'],
    },
  },
  {
    name: 'view_cart',
    description: 'View the customer\'s current cart contents with product names, quantities, prices, and total amount.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'confirm_order',
    description: 'Confirm the customer\'s cart, converting it from a draft quotation to a confirmed sales order. Ask the customer to confirm before calling this.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  // ---- INVOICES (auth required) ----
  {
    name: 'get_invoices',
    description: 'Get the customer\'s invoices. Can filter by payment status (open/paid/all).',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'paid', 'all'], description: 'Filter: open (unpaid), paid, or all (default: all)' },
        limit: { type: 'number', description: 'Max invoices to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_customer_balance',
    description: 'Get the customer\'s financial summary: total invoiced, total paid, amount due, number of overdue invoices.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_payment_link',
    description: 'Get a payment portal link for a specific invoice so the customer can pay online.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoice_id: { type: 'number', description: 'Odoo invoice ID (account.move)' },
      },
      required: ['invoice_id'],
    },
  },

  // ---- SHIPPING (optional auth) ----
  {
    name: 'track_shipment',
    description: 'Track a shipment by order number or picking reference. Shows delivery status, driver info, and estimated arrival.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_reference: { type: 'string', description: 'Order number (e.g. "SO12345") or picking reference' },
      },
      required: ['order_reference'],
    },
  },

  // ---- HELPDESK (no auth required) ----
  {
    name: 'create_support_ticket',
    description: 'Create a helpdesk support ticket for the customer\'s issue. Use when the customer has a complaint, problem, or needs human assistance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string', description: 'Ticket subject (brief summary)' },
        description: { type: 'string', description: 'Detailed description of the issue' },
        priority: { type: 'string', enum: ['0', '1', '2', '3'], description: 'Priority: 0=Low, 1=Normal, 2=High, 3=Urgent (default: 1)' },
      },
      required: ['subject', 'description'],
    },
  },
  {
    name: 'capture_lead',
    description: 'Capture a potential customer\'s contact information (email, name) for follow-up by the sales team. Use when an anonymous visitor provides their email or asks to be contacted.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Contact email address' },
        contact_name: { type: 'string', description: 'Contact person name' },
        business_name: { type: 'string', description: 'Business/restaurant name (if provided)' },
        notes: { type: 'string', description: 'Additional notes about the lead' },
      },
      required: ['email'],
    },
  },
];

// ============================================================================
// TOOL ACCESS LEVELS
// ============================================================================

export const ANONYMOUS_TOOLS = [
  'search_products', 'get_product_price', 'check_availability',
  'track_shipment', 'create_support_ticket', 'capture_lead'
];

export const AUTHENTICATED_TOOLS = [
  ...ANONYMOUS_TOOLS,
  'get_order_history', 'add_to_cart', 'view_cart', 'confirm_order',
  'get_invoices', 'get_customer_balance', 'get_payment_link'
];

export function getToolsForAuth(isAuthenticated: boolean): Anthropic.Tool[] {
  const allowed = isAuthenticated ? AUTHENTICATED_TOOLS : ANONYMOUS_TOOLS;
  return ALL_TOOL_DEFINITIONS.filter(t => allowed.includes(t.name));
}

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

function requireAuth(ctx: ToolContext): number {
  if (!ctx.customerId) {
    throw new Error('This action requires you to be logged in. Please log in at lapa.ch to access your account.');
  }
  return ctx.customerId;
}

export const toolExecutors: Record<string, ToolExecutor> = {

  // ---- PRODUCTS ----

  search_products: async (input, ctx) => {
    const agent = new ProductsAgent(toLanguage(ctx.language));
    const limit = Math.min(input.limit || 10, 20);
    const result = await agent.searchProducts({ query: input.query }, limit);
    if (!result.success || !result.data) {
      return { products: [], message: 'No products found for this search.' };
    }
    // Return clean product data (no internal costs/margins)
    return {
      products: result.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.default_code || undefined,
        category: p.categ_id?.[1] || 'General',
        price: p.list_price,
        currency: 'CHF',
        available: p.qty_available > 0,
        qty_available: p.qty_available,
        unit: p.uom_id?.[1] || 'Unit',
      })),
      total_found: result.data.length,
    };
  },

  get_product_price: async (input, ctx) => {
    const agent = new ProductsAgent(toLanguage(ctx.language));
    const customerType = ctx.customerType === 'b2b' ? 'B2B' : 'B2C';
    const result = await agent.getPrice(input.product_id, customerType, input.quantity || 1, ctx.customerId);
    if (!result.success || !result.data) {
      return { error: 'Could not retrieve price for this product.' };
    }
    return {
      product_id: input.product_id,
      price: result.data.finalPrice,
      currency: result.data.currency || 'CHF',
      quantity: input.quantity || 1,
      discount_percent: result.data.discountPercent || 0,
      pricelist: result.data.pricelistName || 'Standard',
    };
  },

  check_availability: async (input, ctx) => {
    const agent = new ProductsAgent(toLanguage(ctx.language));
    const result = await agent.checkAvailability(input.product_id);
    if (!result.success || !result.data) {
      return { error: 'Could not check availability.' };
    }
    const d = result.data;
    return {
      product_id: d.productId,
      product_name: d.productName,
      qty_available: d.qty_available,
      incoming: d.incoming_qty,
      outgoing: d.outgoing_qty,
      in_stock: d.qty_available > 0,
    };
  },

  // ---- ORDERS ----

  get_order_history: async (input, ctx) => {
    const customerId = requireAuth(ctx);
    const odoo = await getOdooClient();
    const { ids: partnerIds } = await getPartnerIdsForSearch(customerId);
    const limit = Math.min(input.limit || 10, 30);

    const orders = await odoo.searchRead(
      'sale.order',
      [['partner_id', 'in', partnerIds], ['state', 'in', ['sale', 'done']], ['company_id', '=', 1]],
      ['name', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'],
      limit
    );

    const stateLabels: Record<string, string> = {
      draft: 'Draft', sent: 'Sent', sale: 'Confirmed', done: 'Completed', cancel: 'Cancelled',
    };

    return {
      orders: orders.map((o: any) => ({
        id: o.id,
        name: o.name,
        date: o.date_order,
        status: stateLabels[o.state] || o.state,
        total: o.amount_total,
        currency: o.currency_id?.[1] || 'CHF',
        line_count: Array.isArray(o.order_line) ? o.order_line.length : 0,
      })),
      total: orders.length,
    };
  },

  add_to_cart: async (input, ctx) => {
    const customerId = requireAuth(ctx);
    const odoo = await getOdooClient();

    // Find or create draft order (cart)
    let draftOrders = await odoo.searchRead(
      'sale.order',
      [['partner_id', '=', customerId], ['state', '=', 'draft'], ['company_id', '=', 1]],
      ['id', 'name'],
      1
    );

    let orderId: number;
    if (draftOrders.length > 0) {
      orderId = draftOrders[0].id;
    } else {
      // Create new draft order
      const newOrderId = await odoo.call('sale.order', 'create', [[{
        partner_id: customerId,
        company_id: 1,
      }]]);
      orderId = Array.isArray(newOrderId) ? newOrderId[0] : newOrderId;
    }

    // Get product info for the line
    const products = await odoo.searchRead(
      'product.product',
      [['id', '=', input.product_id]],
      ['name', 'list_price', 'uom_id'],
      1
    );

    if (products.length === 0) {
      throw new Error('Product not found.');
    }

    // Add line to order
    await odoo.call('sale.order.line', 'create', [[{
      order_id: orderId,
      product_id: input.product_id,
      product_uom_qty: input.quantity,
    }]]);

    return {
      success: true,
      order_id: orderId,
      product_name: products[0].name,
      quantity: input.quantity,
      message: `Added ${input.quantity}x ${products[0].name} to cart.`,
    };
  },

  view_cart: async (_input, ctx) => {
    const customerId = requireAuth(ctx);
    const odoo = await getOdooClient();

    const draftOrders = await odoo.searchRead(
      'sale.order',
      [['partner_id', '=', customerId], ['state', '=', 'draft'], ['company_id', '=', 1]],
      ['id', 'name', 'amount_total', 'currency_id', 'order_line'],
      1
    );

    if (draftOrders.length === 0) {
      return { empty: true, message: 'Your cart is empty.' };
    }

    const order = draftOrders[0];
    const lines = await odoo.searchRead(
      'sale.order.line',
      [['order_id', '=', order.id]],
      ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'product_uom'],
      50
    );

    return {
      order_id: order.id,
      order_name: order.name,
      total: order.amount_total,
      currency: order.currency_id?.[1] || 'CHF',
      items: lines.map((l: any) => ({
        product_name: l.product_id?.[1] || 'Unknown',
        quantity: l.product_uom_qty,
        price_unit: l.price_unit,
        subtotal: l.price_subtotal,
        unit: l.product_uom?.[1] || 'Unit',
      })),
    };
  },

  confirm_order: async (_input, ctx) => {
    const customerId = requireAuth(ctx);
    const odoo = await getOdooClient();

    const draftOrders = await odoo.searchRead(
      'sale.order',
      [['partner_id', '=', customerId], ['state', '=', 'draft'], ['company_id', '=', 1]],
      ['id', 'name', 'amount_total'],
      1
    );

    if (draftOrders.length === 0) {
      throw new Error('No cart found to confirm.');
    }

    const order = draftOrders[0];
    await odoo.call('sale.order', 'action_confirm', [[order.id]]);

    return {
      success: true,
      order_name: order.name,
      total: order.amount_total,
      message: `Order ${order.name} confirmed! Total: CHF ${order.amount_total.toFixed(2)}`,
    };
  },

  // ---- INVOICES ----

  get_invoices: async (input, ctx) => {
    const customerId = requireAuth(ctx);
    const invoicesAgent = getInvoicesAgent();
    const result = await invoicesAgent.getCustomerInvoices(customerId);
    if (!result.success || !result.data) {
      return { invoices: [], message: 'No invoices found.' };
    }

    let invoices = result.data;
    // Filter by status if requested
    if (input.status === 'open') {
      invoices = invoices.filter((i: any) => i.payment_state === 'not_paid' || i.payment_state === 'partial');
    } else if (input.status === 'paid') {
      invoices = invoices.filter((i: any) => i.payment_state === 'paid');
    }

    const limit = Math.min(input.limit || 20, 50);
    return {
      invoices: invoices.slice(0, limit).map((i: any) => ({
        id: i.id,
        number: i.name,
        date: i.invoice_date,
        due_date: i.invoice_date_due,
        total: i.amount_total,
        paid: i.amount_total - (i.amount_residual || 0),
        remaining: i.amount_residual || 0,
        currency: i.currency_id?.[1] || 'CHF',
        status: i.payment_state === 'paid' ? 'Paid' : i.payment_state === 'partial' ? 'Partially paid' : 'Open',
      })),
      total: invoices.length,
    };
  },

  get_customer_balance: async (_input, ctx) => {
    const customerId = requireAuth(ctx);
    const invoicesAgent = getInvoicesAgent();
    const result = await invoicesAgent.getCustomerBalance(customerId);
    if (!result.success || !result.data) {
      return { error: 'Could not retrieve balance.' };
    }
    return result.data;
  },

  get_payment_link: async (input, ctx) => {
    requireAuth(ctx);
    const invoicesAgent = getInvoicesAgent();
    const result = await invoicesAgent.getPaymentLink(input.invoice_id);
    if (!result.success || !result.data) {
      return { error: 'Could not generate payment link.' };
    }
    return { url: result.data, invoice_id: input.invoice_id };
  },

  // ---- SHIPPING ----

  track_shipment: async (input, ctx) => {
    const agent = ShippingAgent.getInstance();
    const result = await agent.trackShipment(input.order_reference);
    if (!result.success || !result.data) {
      return { found: false, message: 'Shipment not found for this reference.' };
    }
    const d = result.data;
    return {
      found: true,
      reference: d.name,
      origin: d.origin,
      state: d.state,
      scheduled_date: d.scheduled_date,
      date_done: d.date_done,
      driver: d.driver_name || undefined,
      vehicle: d.vehicle || undefined,
      products: d.products?.map((p: any) => ({
        name: p.product_name,
        quantity: p.quantity_done || p.quantity,
        unit: p.uom,
      })),
    };
  },

  // ---- HELPDESK ----

  create_support_ticket: async (input, ctx) => {
    const agent = createHelpdeskAgent();
    const result = await agent.createTicket({
      customerId: ctx.customerId || 0,
      subject: input.subject,
      description: input.description,
      priority: input.priority || '1',
    });
    if (!result.success) {
      return { error: 'Could not create support ticket. Please email lapa@lapa.ch directly.' };
    }
    return {
      success: true,
      ticket_id: result.ticketId,
      message: 'Support ticket created. Our team will get back to you soon.',
    };
  },

  capture_lead: async (input, ctx) => {
    const odoo = await getOdooClient();

    // Check if partner already exists
    const existing = await odoo.searchRead(
      'res.partner',
      [['email', '=ilike', input.email]],
      ['id', 'name', 'customer_rank'],
      1
    );

    if (existing.length > 0) {
      return {
        already_registered: true,
        partner_name: existing[0].name,
        message: 'This email is already registered. You can log in at lapa.ch.',
      };
    }

    // Create helpdesk ticket as lead
    const agent = createHelpdeskAgent();
    const description = [
      `New lead from website chat`,
      `Email: ${input.email}`,
      input.contact_name ? `Name: ${input.contact_name}` : null,
      input.business_name ? `Business: ${input.business_name}` : null,
      input.notes ? `Notes: ${input.notes}` : null,
    ].filter(Boolean).join('\n');

    await agent.createTicket({
      customerId: 0,
      subject: `New Lead: ${input.contact_name || input.email}`,
      description,
      priority: '2',
    });

    return {
      success: true,
      message: 'Thank you! Our sales team will contact you soon.',
    };
  },
};
