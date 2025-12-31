/**
 * ORDERS AGENT
 * Agent specializzato nella gestione ordini B2B e supporto clienti B2C
 *
 * Funzionalità:
 * - Gestione ordini B2B (creazione, modifica, annullamento)
 * - Consulenza ordini B2C (redirect al sito web)
 * - Tracking stato ordini
 * - Storico ordini clienti
 * - Ricerca prodotti per ordinazione
 */

import { BaseAgent } from '@/lib/maestro-agents/core/base-agent';
import { getOdooClient } from '@/lib/odoo-client';
import type { AgentRole, AgentTask, AgentResult, AgentTool } from '@/lib/maestro-agents/types';

// ============================================================================
// TYPES
// ============================================================================

interface OrderItem {
  product_id: number;
  product_name?: string;
  quantity: number;
  price_unit?: number;
  uom_id?: number;
}

interface OrderDetails {
  id: number;
  name: string;
  partner_id: number;
  partner_name: string;
  date_order: string;
  state: string;
  amount_total: number;
  amount_untaxed: number;
  currency: string;
  order_lines: OrderItem[];
  shipping_date?: string;
  delivery_status?: string;
  payment_status?: string;
  notes?: string;
}

interface OrderHistoryItem {
  id: number;
  name: string;
  date_order: string;
  state: string;
  state_label: string;
  amount_total: number;
  currency: string;
  product_count: number;
  delivery_status?: string;
}

interface ProductSearchResult {
  id: number;
  name: string;
  default_code?: string;
  list_price: number;
  currency: string;
  uom_name: string;
  qty_available?: number;
  categ_name?: string;
}

interface CustomerInfo {
  id: number;
  name: string;
  customer_type: 'b2b' | 'b2c';
  is_company: boolean;
  can_place_orders: boolean;
  payment_terms?: string;
  credit_limit?: number;
}

// ============================================================================
// TOOLS
// ============================================================================

const ordersTools: AgentTool[] = [
  {
    name: 'get_customer_info',
    description: 'Recupera informazioni sul cliente (tipo B2B/B2C, permessi, limiti credito)',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente (Odoo partner_id)',
        },
      },
      required: ['customer_id'],
    },
    handler: async ({ customer_id }): Promise<CustomerInfo> => {
      try {
        const odoo = await getOdooClient();

        const partners = await odoo.searchRead(
          'res.partner',
          [['id', '=', customer_id]],
          [
            'name',
            'is_company',
            'customer_rank',
            'supplier_rank',
            'property_payment_term_id',
            'credit_limit',
            'company_type',
          ]
        );

        if (partners.length === 0) {
          throw new Error(`Cliente ${customer_id} non trovato`);
        }

        const partner = partners[0];
        const isB2B = partner.is_company || partner.customer_rank > 0;

        return {
          id: partner.id,
          name: partner.name,
          customer_type: isB2B ? 'b2b' : 'b2c',
          is_company: partner.is_company,
          can_place_orders: partner.customer_rank > 0,
          payment_terms: partner.property_payment_term_id ? partner.property_payment_term_id[1] : undefined,
          credit_limit: partner.credit_limit || undefined,
        };
      } catch (error) {
        throw new Error(`Errore recupero info cliente: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'get_order_history',
    description: 'Recupera lo storico ordini di un cliente',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente (Odoo partner_id)',
        },
        limit: {
          type: 'number',
          description: 'Numero massimo di ordini da restituire (default: 10)',
        },
        state_filter: {
          type: 'string',
          description: 'Filtra per stato: draft, sent, sale, done, cancel (opzionale)',
        },
      },
      required: ['customer_id'],
    },
    handler: async ({ customer_id, limit = 10, state_filter }): Promise<OrderHistoryItem[]> => {
      try {
        const odoo = await getOdooClient();

        const domain: any[] = [['partner_id', '=', customer_id]];
        if (state_filter) {
          domain.push(['state', '=', state_filter]);
        }

        const orders = await odoo.searchRead(
          'sale.order',
          domain,
          [
            'name',
            'date_order',
            'state',
            'amount_total',
            'currency_id',
            'order_line',
          ],
          limit
        );

        const stateLabels: Record<string, string> = {
          draft: 'Bozza',
          sent: 'Inviato',
          sale: 'Confermato',
          done: 'Completato',
          cancel: 'Annullato',
        };

        return orders.map((order: any) => ({
          id: order.id,
          name: order.name,
          date_order: order.date_order,
          state: order.state,
          state_label: stateLabels[order.state] || order.state,
          amount_total: order.amount_total,
          currency: order.currency_id ? order.currency_id[1] : 'CHF',
          product_count: Array.isArray(order.order_line) ? order.order_line.length : 0,
        }));
      } catch (error) {
        throw new Error(`Errore recupero storico ordini: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'get_order_status',
    description: 'Recupera lo stato dettagliato di un ordine specifico',
    input_schema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'number',
          description: 'ID dell\'ordine Odoo',
        },
      },
      required: ['order_id'],
    },
    handler: async ({ order_id }): Promise<OrderDetails> => {
      try {
        const odoo = await getOdooClient();

        const orders = await odoo.searchRead(
          'sale.order',
          [['id', '=', order_id]],
          [
            'name',
            'partner_id',
            'date_order',
            'state',
            'amount_total',
            'amount_untaxed',
            'currency_id',
            'order_line',
            'commitment_date',
            'note',
            'invoice_status',
            'delivery_status',
          ]
        );

        if (orders.length === 0) {
          throw new Error(`Ordine ${order_id} non trovato`);
        }

        const order = orders[0];

        // Recupera le linee d'ordine dettagliate
        let orderLines: OrderItem[] = [];
        if (order.order_line && order.order_line.length > 0) {
          const lines = await odoo.searchRead(
            'sale.order.line',
            [['id', 'in', order.order_line]],
            ['product_id', 'name', 'product_uom_qty', 'price_unit', 'product_uom']
          );

          orderLines = lines.map((line: any) => ({
            product_id: line.product_id ? line.product_id[0] : 0,
            product_name: line.product_id ? line.product_id[1] : line.name,
            quantity: line.product_uom_qty,
            price_unit: line.price_unit,
            uom_id: line.product_uom ? line.product_uom[0] : undefined,
          }));
        }

        return {
          id: order.id,
          name: order.name,
          partner_id: order.partner_id[0],
          partner_name: order.partner_id[1],
          date_order: order.date_order,
          state: order.state,
          amount_total: order.amount_total,
          amount_untaxed: order.amount_untaxed,
          currency: order.currency_id ? order.currency_id[1] : 'CHF',
          order_lines: orderLines,
          shipping_date: order.commitment_date || undefined,
          delivery_status: order.delivery_status || undefined,
          payment_status: order.invoice_status || undefined,
          notes: order.note || undefined,
        };
      } catch (error) {
        throw new Error(`Errore recupero stato ordine: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'search_products',
    description: 'Cerca prodotti disponibili per ordinazione (per nome, codice, categoria)',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termine di ricerca (nome prodotto, codice, categoria)',
        },
        limit: {
          type: 'number',
          description: 'Numero massimo di risultati (default: 20)',
        },
        category_filter: {
          type: 'string',
          description: 'Filtra per categoria specifica (opzionale)',
        },
      },
      required: ['query'],
    },
    handler: async ({ query, limit = 20, category_filter }): Promise<ProductSearchResult[]> => {
      try {
        const odoo = await getOdooClient();

        const domain: any[] = [
          '|',
          ['name', 'ilike', query],
          ['default_code', 'ilike', query],
          ['sale_ok', '=', true],
        ];

        if (category_filter) {
          domain.push(['categ_id.name', 'ilike', category_filter]);
        }

        const products = await odoo.searchRead(
          'product.product',
          domain,
          [
            'name',
            'default_code',
            'list_price',
            'currency_id',
            'uom_id',
            'qty_available',
            'categ_id',
          ],
          limit
        );

        return products.map((product: any) => ({
          id: product.id,
          name: product.name,
          default_code: product.default_code || undefined,
          list_price: product.list_price,
          currency: product.currency_id ? product.currency_id[1] : 'CHF',
          uom_name: product.uom_id ? product.uom_id[1] : 'Unit',
          qty_available: product.qty_available || undefined,
          categ_name: product.categ_id ? product.categ_id[1] : undefined,
        }));
      } catch (error) {
        throw new Error(`Errore ricerca prodotti: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'get_purchased_products',
    description: 'Recupera la lista dei prodotti acquistati da un cliente (storico acquisti)',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente (Odoo partner_id)',
        },
        limit: {
          type: 'number',
          description: 'Numero massimo di prodotti da restituire (default: 20)',
        },
      },
      required: ['customer_id'],
    },
    handler: async ({ customer_id, limit = 20 }): Promise<{
      products: Array<{
        product_id: number;
        product_name: string;
        product_code?: string;
        total_quantity: number;
        last_purchase_date: string;
        last_order_name: string;
        purchase_count: number;
      }>;
      total_orders: number;
    }> => {
      try {
        const odoo = await getOdooClient();

        // Trova tutti gli ordini del cliente (confermati o completati)
        const orders = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', 'in', ['sale', 'done']]
          ],
          ['id', 'name', 'date_order'],
          100 // Limita a ultimi 100 ordini
        );

        if (orders.length === 0) {
          return { products: [], total_orders: 0 };
        }

        const orderIds = orders.map((o: any) => o.id);
        const orderMap = new Map(orders.map((o: any) => [o.id, o]));

        // Recupera tutte le righe d'ordine
        const orderLines = await odoo.searchRead(
          'sale.order.line',
          [['order_id', 'in', orderIds]],
          ['product_id', 'order_id', 'product_uom_qty', 'price_unit'],
          1000
        );

        // Aggrega per prodotto
        const productMap = new Map<number, {
          product_id: number;
          product_name: string;
          total_quantity: number;
          last_purchase_date: string;
          last_order_name: string;
          purchase_count: number;
          orders: Set<number>;
        }>();

        for (const line of orderLines) {
          if (!line.product_id) continue;

          const productId = line.product_id[0];
          const productName = line.product_id[1];
          const order = orderMap.get(line.order_id[0]);

          if (!order) continue;

          if (!productMap.has(productId)) {
            productMap.set(productId, {
              product_id: productId,
              product_name: productName,
              total_quantity: 0,
              last_purchase_date: order.date_order,
              last_order_name: order.name,
              purchase_count: 0,
              orders: new Set()
            });
          }

          const product = productMap.get(productId)!;
          product.total_quantity += line.product_uom_qty;
          product.orders.add(line.order_id[0]);

          // Aggiorna ultima data se più recente
          if (order.date_order > product.last_purchase_date) {
            product.last_purchase_date = order.date_order;
            product.last_order_name = order.name;
          }
        }

        // Converti in array e ordina per data ultimo acquisto
        const products = Array.from(productMap.values())
          .map(p => ({
            product_id: p.product_id,
            product_name: p.product_name,
            total_quantity: p.total_quantity,
            last_purchase_date: p.last_purchase_date,
            last_order_name: p.last_order_name,
            purchase_count: p.orders.size
          }))
          .sort((a, b) => b.last_purchase_date.localeCompare(a.last_purchase_date))
          .slice(0, limit);

        return {
          products,
          total_orders: orders.length
        };
      } catch (error) {
        throw new Error(`Errore recupero prodotti acquistati: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'get_product_purchase_history',
    description: 'Recupera lo storico acquisti di un prodotto specifico per un cliente',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente (Odoo partner_id)',
        },
        product_name: {
          type: 'string',
          description: 'Nome o parte del nome del prodotto da cercare',
        },
      },
      required: ['customer_id', 'product_name'],
    },
    handler: async ({ customer_id, product_name }): Promise<{
      found: boolean;
      product_name?: string;
      purchases: Array<{
        order_name: string;
        date: string;
        quantity: number;
        price_unit: number;
        total: number;
      }>;
      summary?: {
        total_quantity: number;
        total_spent: number;
        first_purchase: string;
        last_purchase: string;
        purchase_count: number;
      };
    }> => {
      try {
        const odoo = await getOdooClient();

        // Trova ordini del cliente
        const orders = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', 'in', ['sale', 'done']]
          ],
          ['id', 'name', 'date_order'],
          100
        );

        if (orders.length === 0) {
          return { found: false, purchases: [] };
        }

        const orderIds = orders.map((o: any) => o.id);
        const orderMap = new Map(orders.map((o: any) => [o.id, o]));

        // Cerca righe con il prodotto
        const searchTerms = product_name.toLowerCase().split(/\s+/);

        const orderLines = await odoo.searchRead(
          'sale.order.line',
          [['order_id', 'in', orderIds]],
          ['product_id', 'order_id', 'product_uom_qty', 'price_unit', 'price_subtotal'],
          1000
        );

        // Filtra per nome prodotto
        const matchingLines = orderLines.filter((line: any) => {
          if (!line.product_id) return false;
          const productNameLower = line.product_id[1].toLowerCase();
          return searchTerms.every((term: string) => productNameLower.includes(term));
        });

        if (matchingLines.length === 0) {
          return { found: false, purchases: [] };
        }

        // Raggruppa acquisti
        const purchases = matchingLines.map((line: any) => {
          const order = orderMap.get(line.order_id[0]);
          return {
            order_name: order?.name || line.order_id[1],
            date: order?.date_order || '',
            quantity: line.product_uom_qty,
            price_unit: line.price_unit,
            total: line.price_subtotal
          };
        }).sort((a, b) => b.date.localeCompare(a.date));

        // Calcola summary
        const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
        const totalSpent = purchases.reduce((sum, p) => sum + p.total, 0);
        const dates = purchases.map(p => p.date).filter(d => d);

        return {
          found: true,
          product_name: matchingLines[0].product_id[1],
          purchases,
          summary: {
            total_quantity: totalQuantity,
            total_spent: totalSpent,
            first_purchase: dates[dates.length - 1] || '',
            last_purchase: dates[0] || '',
            purchase_count: purchases.length
          }
        };
      } catch (error) {
        throw new Error(`Errore recupero storico prodotto: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  // ============================================================================
  // CARRELLO / PREVENTIVO - Gestione carrello conversazionale
  // ============================================================================

  {
    name: 'get_or_create_cart',
    description: 'Trova o crea un preventivo (carrello) draft per il cliente. Usato come carrello conversazionale.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente',
        },
      },
      required: ['customer_id'],
    },
    handler: async ({ customer_id }): Promise<{ cart_id: number; cart_name: string; items: any[]; total: number; is_new: boolean }> => {
      try {
        const odoo = await getOdooClient();

        // Cerca un preventivo draft esistente (carrello) per questo cliente
        // Ordina per data creazione desc per prendere il più recente
        const existingCarts = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', '=', 'draft']  // Solo preventivi non confermati
          ],
          ['id', 'name', 'amount_total', 'order_line', 'create_date'],
          10  // Limit
        );

        let cartId: number;
        let cartName: string;
        let isNew = false;

        if (existingCarts.length > 0) {
          // Usa il carrello esistente più recente
          cartId = existingCarts[0].id;
          cartName = existingCarts[0].name;
        } else {
          // Crea un nuovo preventivo vuoto
          const newCartIds = await odoo.create('sale.order', [{
            partner_id: customer_id,
            state: 'draft',
          }]);

          if (!newCartIds || newCartIds.length === 0) {
            throw new Error('Errore creazione carrello');
          }

          cartId = newCartIds[0];
          isNew = true;

          // Recupera il nome del carrello creato
          const newCart = await odoo.searchRead(
            'sale.order',
            [['id', '=', cartId]],
            ['name']
          );
          cartName = newCart[0]?.name || `S${cartId}`;
        }

        // Recupera le righe del carrello
        const cart = await odoo.searchRead(
          'sale.order',
          [['id', '=', cartId]],
          ['order_line', 'amount_total']
        );

        let items: any[] = [];
        if (cart[0]?.order_line?.length > 0) {
          const lines = await odoo.searchRead(
            'sale.order.line',
            [['id', 'in', cart[0].order_line]],
            ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'product_uom']
          );

          items = lines.map((line: any) => ({
            line_id: line.id,
            product_id: line.product_id[0],
            product_name: line.product_id[1],
            quantity: line.product_uom_qty,
            price_unit: line.price_unit,
            subtotal: line.price_subtotal,
            uom: line.product_uom?.[1] || 'pz'
          }));
        }

        return {
          cart_id: cartId,
          cart_name: cartName,
          items,
          total: cart[0]?.amount_total || 0,
          is_new: isNew
        };
      } catch (error) {
        throw new Error(`Errore gestione carrello: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'add_to_cart',
    description: 'Aggiunge un prodotto al carrello (preventivo draft) del cliente',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente',
        },
        product_id: {
          type: 'number',
          description: 'ID del prodotto da aggiungere',
        },
        quantity: {
          type: 'number',
          description: 'Quantità da aggiungere',
        },
      },
      required: ['customer_id', 'product_id', 'quantity'],
    },
    handler: async ({ customer_id, product_id, quantity }): Promise<{ success: boolean; cart_id: number; cart_name: string; product_name: string; quantity: number; items: any[]; total: number }> => {
      try {
        const odoo = await getOdooClient();

        // Prima ottieni o crea il carrello
        const existingCarts = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', '=', 'draft']
          ],
          ['id', 'name'],
          1
        );

        let cartId: number;
        let cartName: string;

        if (existingCarts.length > 0) {
          cartId = existingCarts[0].id;
          cartName = existingCarts[0].name;
        } else {
          // Crea nuovo carrello
          const newCartIds = await odoo.create('sale.order', [{
            partner_id: customer_id,
            state: 'draft',
          }]);
          cartId = newCartIds[0];

          const newCart = await odoo.searchRead(
            'sale.order',
            [['id', '=', cartId]],
            ['name']
          );
          cartName = newCart[0]?.name || `S${cartId}`;
        }

        // Recupera info prodotto
        const products = await odoo.searchRead(
          'product.product',
          [['id', '=', product_id]],
          ['name', 'list_price', 'uom_id']
        );

        if (products.length === 0) {
          throw new Error('Prodotto non trovato');
        }

        const product = products[0];

        // Controlla se il prodotto è già nel carrello
        const existingLines = await odoo.searchRead(
          'sale.order.line',
          [
            ['order_id', '=', cartId],
            ['product_id', '=', product_id]
          ],
          ['id', 'product_uom_qty']
        );

        if (existingLines.length > 0) {
          // Aggiorna quantità esistente
          const newQty = existingLines[0].product_uom_qty + quantity;
          await odoo.write('sale.order.line', [existingLines[0].id], {
            product_uom_qty: newQty
          });
        } else {
          // Aggiungi nuova riga
          await odoo.create('sale.order.line', [{
            order_id: cartId,
            product_id: product_id,
            product_uom_qty: quantity,
          }]);
        }

        // Recupera carrello aggiornato
        const updatedCart = await odoo.searchRead(
          'sale.order',
          [['id', '=', cartId]],
          ['order_line', 'amount_total']
        );

        let items: any[] = [];
        if (updatedCart[0]?.order_line?.length > 0) {
          const lines = await odoo.searchRead(
            'sale.order.line',
            [['id', 'in', updatedCart[0].order_line]],
            ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal']
          );

          items = lines.map((line: any) => ({
            product_id: line.product_id[0],
            product_name: line.product_id[1],
            quantity: line.product_uom_qty,
            price_unit: line.price_unit,
            subtotal: line.price_subtotal
          }));
        }

        return {
          success: true,
          cart_id: cartId,
          cart_name: cartName,
          product_name: product.name,
          quantity,
          items,
          total: updatedCart[0]?.amount_total || 0
        };
      } catch (error) {
        throw new Error(`Errore aggiunta al carrello: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'remove_from_cart',
    description: 'Rimuove un prodotto dal carrello del cliente',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente',
        },
        product_id: {
          type: 'number',
          description: 'ID del prodotto da rimuovere',
        },
      },
      required: ['customer_id', 'product_id'],
    },
    handler: async ({ customer_id, product_id }): Promise<{ success: boolean; removed_product: string; items: any[]; total: number }> => {
      try {
        const odoo = await getOdooClient();

        // Trova il carrello
        const carts = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', '=', 'draft']
          ],
          ['id'],
          1
        );

        if (carts.length === 0) {
          throw new Error('Nessun carrello trovato');
        }

        const cartId = carts[0].id;

        // Trova la riga del prodotto
        const lines = await odoo.searchRead(
          'sale.order.line',
          [
            ['order_id', '=', cartId],
            ['product_id', '=', product_id]
          ],
          ['id', 'product_id']
        );

        if (lines.length === 0) {
          throw new Error('Prodotto non trovato nel carrello');
        }

        const productName = lines[0].product_id[1];

        // Elimina la riga
        await odoo.unlink('sale.order.line', [lines[0].id]);

        // Recupera carrello aggiornato
        const updatedCart = await odoo.searchRead(
          'sale.order',
          [['id', '=', cartId]],
          ['order_line', 'amount_total']
        );

        let items: any[] = [];
        if (updatedCart[0]?.order_line?.length > 0) {
          const remainingLines = await odoo.searchRead(
            'sale.order.line',
            [['id', 'in', updatedCart[0].order_line]],
            ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal']
          );

          items = remainingLines.map((line: any) => ({
            product_id: line.product_id[0],
            product_name: line.product_id[1],
            quantity: line.product_uom_qty,
            subtotal: line.price_subtotal
          }));
        }

        return {
          success: true,
          removed_product: productName,
          items,
          total: updatedCart[0]?.amount_total || 0
        };
      } catch (error) {
        throw new Error(`Errore rimozione dal carrello: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'view_cart',
    description: 'Mostra il contenuto del carrello (preventivo draft) del cliente',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente',
        },
      },
      required: ['customer_id'],
    },
    handler: async ({ customer_id }): Promise<{ cart_id: number | null; cart_name: string | null; items: any[]; total: number; empty: boolean }> => {
      try {
        const odoo = await getOdooClient();

        const carts = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', '=', 'draft']
          ],
          ['id', 'name', 'order_line', 'amount_total'],
          1
        );

        if (carts.length === 0) {
          return {
            cart_id: null,
            cart_name: null,
            items: [],
            total: 0,
            empty: true
          };
        }

        const cart = carts[0];
        let items: any[] = [];

        if (cart.order_line?.length > 0) {
          const lines = await odoo.searchRead(
            'sale.order.line',
            [['id', 'in', cart.order_line]],
            ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'product_uom']
          );

          items = lines.map((line: any) => ({
            product_id: line.product_id[0],
            product_name: line.product_id[1],
            quantity: line.product_uom_qty,
            price_unit: line.price_unit,
            subtotal: line.price_subtotal,
            uom: line.product_uom?.[1] || 'pz'
          }));
        }

        return {
          cart_id: cart.id,
          cart_name: cart.name,
          items,
          total: cart.amount_total || 0,
          empty: items.length === 0
        };
      } catch (error) {
        throw new Error(`Errore visualizzazione carrello: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'confirm_cart',
    description: 'Conferma il carrello e lo trasforma in ordine confermato',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente',
        },
      },
      required: ['customer_id'],
    },
    handler: async ({ customer_id }): Promise<{ success: boolean; order_id: number; order_name: string; total: number; message: string }> => {
      try {
        const odoo = await getOdooClient();

        const carts = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', customer_id],
            ['state', '=', 'draft']
          ],
          ['id', 'name', 'order_line', 'amount_total'],
          1
        );

        if (carts.length === 0) {
          throw new Error('Nessun carrello da confermare');
        }

        const cart = carts[0];

        if (!cart.order_line || cart.order_line.length === 0) {
          throw new Error('Il carrello è vuoto');
        }

        // Conferma l'ordine
        await odoo.call('sale.order', 'action_confirm', [[cart.id]]);

        return {
          success: true,
          order_id: cart.id,
          order_name: cart.name,
          total: cart.amount_total,
          message: `Ordine ${cart.name} confermato! Totale: ${cart.amount_total.toFixed(2)} CHF`
        };
      } catch (error) {
        throw new Error(`Errore conferma ordine: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'create_order',
    description: 'Crea un nuovo ordine per un cliente B2B',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID del cliente B2B',
        },
        items: {
          type: 'array',
          description: 'Prodotti da ordinare',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'number' },
              quantity: { type: 'number' },
              price_unit: { type: 'number', description: 'Prezzo unitario (opzionale)' },
            },
            required: ['product_id', 'quantity'],
          },
        },
        notes: {
          type: 'string',
          description: 'Note aggiuntive per l\'ordine (opzionale)',
        },
      },
      required: ['customer_id', 'items'],
    },
    handler: async ({ customer_id, items, notes }): Promise<{ order_id: number; order_name: string; message: string }> => {
      try {
        const odoo = await getOdooClient();

        // Verifica che il cliente sia B2B
        const customerInfo = await odoo.searchRead(
          'res.partner',
          [['id', '=', customer_id]],
          ['name', 'is_company', 'customer_rank']
        );

        if (customerInfo.length === 0) {
          throw new Error('Cliente non trovato');
        }

        const isB2B = customerInfo[0].is_company || customerInfo[0].customer_rank > 0;
        if (!isB2B) {
          throw new Error('Questo cliente è B2C. Gli ordini B2C devono essere effettuati tramite il sito web.');
        }

        // Prepara le linee d'ordine
        const orderLines = items.map((item: any) => {
          const line: any = [0, 0, {
            product_id: item.product_id,
            product_uom_qty: item.quantity,
          }];

          if (item.price_unit) {
            line[2].price_unit = item.price_unit;
          }

          return line;
        });

        // Crea l'ordine
        const orderData: any = {
          partner_id: customer_id,
          order_line: orderLines,
        };

        if (notes) {
          orderData.note = notes;
        }

        const orderIds = await odoo.create('sale.order', [orderData]);

        if (!orderIds || orderIds.length === 0) {
          throw new Error('Errore nella creazione dell\'ordine');
        }

        const orderId = orderIds[0];

        // Recupera il nome dell'ordine creato
        const createdOrders = await odoo.searchRead(
          'sale.order',
          [['id', '=', orderId]],
          ['name']
        );

        const orderName = createdOrders[0]?.name || `SO${orderId}`;

        return {
          order_id: orderId,
          order_name: orderName,
          message: `Ordine ${orderName} creato con successo per ${customerInfo[0].name}`,
        };
      } catch (error) {
        throw new Error(`Errore creazione ordine: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'modify_order',
    description: 'Modifica un ordine esistente (solo se non ancora spedito)',
    input_schema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'number',
          description: 'ID dell\'ordine da modificare',
        },
        changes: {
          type: 'object',
          description: 'Modifiche da applicare',
          properties: {
            add_items: {
              type: 'array',
              description: 'Prodotti da aggiungere',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'number' },
                  quantity: { type: 'number' },
                },
              },
            },
            remove_line_ids: {
              type: 'array',
              description: 'IDs delle linee da rimuovere',
              items: { type: 'number' },
            },
            update_quantities: {
              type: 'array',
              description: 'Aggiorna quantità linee esistenti',
              items: {
                type: 'object',
                properties: {
                  line_id: { type: 'number' },
                  new_quantity: { type: 'number' },
                },
              },
            },
            notes: {
              type: 'string',
              description: 'Aggiorna note ordine',
            },
          },
        },
      },
      required: ['order_id', 'changes'],
    },
    handler: async ({ order_id, changes }): Promise<{ success: boolean; message: string }> => {
      try {
        const odoo = await getOdooClient();

        // Verifica stato ordine
        const orders = await odoo.searchRead(
          'sale.order',
          [['id', '=', order_id]],
          ['name', 'state', 'delivery_status']
        );

        if (orders.length === 0) {
          throw new Error(`Ordine ${order_id} non trovato`);
        }

        const order = orders[0];

        // Verifica se l'ordine può essere modificato
        if (order.state === 'done') {
          throw new Error(`L'ordine ${order.name} è già completato e non può essere modificato`);
        }

        if (order.state === 'cancel') {
          throw new Error(`L'ordine ${order.name} è annullato e non può essere modificato`);
        }

        if (order.delivery_status === 'full') {
          throw new Error(`L'ordine ${order.name} è già stato spedito e non può essere modificato`);
        }

        const updateData: any = {};
        const operations: string[] = [];

        // Aggiungi nuove linee
        if (changes.add_items && changes.add_items.length > 0) {
          const newLines = changes.add_items.map((item: any) => [
            0, 0, {
              product_id: item.product_id,
              product_uom_qty: item.quantity,
            }
          ]);
          updateData.order_line = newLines;
          operations.push(`${changes.add_items.length} prodotti aggiunti`);
        }

        // Rimuovi linee
        if (changes.remove_line_ids && changes.remove_line_ids.length > 0) {
          for (const lineId of changes.remove_line_ids) {
            if (!updateData.order_line) updateData.order_line = [];
            updateData.order_line.push([2, lineId, 0]);
          }
          operations.push(`${changes.remove_line_ids.length} prodotti rimossi`);
        }

        // Aggiorna quantità
        if (changes.update_quantities && changes.update_quantities.length > 0) {
          for (const update of changes.update_quantities) {
            if (!updateData.order_line) updateData.order_line = [];
            updateData.order_line.push([
              1, update.line_id, { product_uom_qty: update.new_quantity }
            ]);
          }
          operations.push(`${changes.update_quantities.length} quantità aggiornate`);
        }

        // Aggiorna note
        if (changes.notes) {
          updateData.note = changes.notes;
          operations.push('note aggiornate');
        }

        if (Object.keys(updateData).length === 0) {
          return {
            success: false,
            message: 'Nessuna modifica specificata',
          };
        }

        // Applica modifiche
        await odoo.write('sale.order', [order_id], updateData);

        return {
          success: true,
          message: `Ordine ${order.name} modificato con successo: ${operations.join(', ')}`,
        };
      } catch (error) {
        throw new Error(`Errore modifica ordine: ${error instanceof Error ? error.message : error}`);
      }
    },
  },

  {
    name: 'cancel_order',
    description: 'Annulla un ordine (solo se non ancora spedito)',
    input_schema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'number',
          description: 'ID dell\'ordine da annullare',
        },
        reason: {
          type: 'string',
          description: 'Motivo dell\'annullamento (opzionale)',
        },
      },
      required: ['order_id'],
    },
    handler: async ({ order_id, reason }): Promise<{ success: boolean; message: string }> => {
      try {
        const odoo = await getOdooClient();

        // Verifica stato ordine
        const orders = await odoo.searchRead(
          'sale.order',
          [['id', '=', order_id]],
          ['name', 'state', 'delivery_status']
        );

        if (orders.length === 0) {
          throw new Error(`Ordine ${order_id} non trovato`);
        }

        const order = orders[0];

        if (order.state === 'cancel') {
          return {
            success: false,
            message: `L'ordine ${order.name} è già annullato`,
          };
        }

        if (order.state === 'done') {
          throw new Error(`L'ordine ${order.name} è completato e non può essere annullato`);
        }

        if (order.delivery_status === 'full') {
          throw new Error(`L'ordine ${order.name} è già stato spedito e non può essere annullato`);
        }

        // Aggiungi motivo alle note se specificato
        if (reason) {
          const currentNote = order.note || '';
          const cancelNote = `\n\n[ANNULLATO] ${reason}`;
          await odoo.write('sale.order', [order_id], {
            note: currentNote + cancelNote,
          });
        }

        // Annulla l'ordine usando il metodo action_cancel
        await odoo.call('sale.order', 'action_cancel', [[order_id]]);

        return {
          success: true,
          message: `Ordine ${order.name} annullato con successo${reason ? `: ${reason}` : ''}`,
        };
      } catch (error) {
        throw new Error(`Errore annullamento ordine: ${error instanceof Error ? error.message : error}`);
      }
    },
  },
];

// ============================================================================
// AGENT CLASS
// ============================================================================

export class OrdersAgent extends BaseAgent {
  constructor() {
    super(
      'orders_agent' as AgentRole,
      'Orders Agent',
      'Specialista nella gestione ordini B2B e supporto clienti B2C',
      [
        'Creare ordini per clienti B2B',
        'Mostrare storico ordini clienti',
        'Controllare stato dettagliato ordini',
        'Modificare ordini non ancora spediti',
        'Annullare ordini non ancora spediti',
        'Cercare prodotti disponibili',
        'Mostrare prodotti acquistati dal cliente',
        'Mostrare storico acquisti di un prodotto specifico',
        'Guidare clienti B2C all\'acquisto sul sito web',
        'Fornire informazioni su pagamenti e spedizioni',
      ],
      ordersTools
    );
  }

  getSystemPrompt(): string {
    return `Sei l'Orders Agent di LAPA Food, distributore premium di prodotti alimentari in Ticino.

# IL TUO RUOLO
Sei specializzato nella gestione ordini e assistenza clienti. Gestisci:
- Ordini B2B (clienti business): creazione, modifica, tracking completo
- Clienti B2C (privati): consulenza e redirect al sito e-commerce

# LE TUE CAPACITÀ
${this.capabilities.map(c => `- ${c}`).join('\n')}

# TOOLS DISPONIBILI
${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

# COME OPERI

## 1. IDENTIFICAZIONE TIPO CLIENTE
SEMPRE inizia verificando il tipo di cliente con get_customer_info:
- **B2B**: Aziende, ristoranti, hotel → gestione ordini completa
- **B2C**: Privati → redirect al sito web con supporto

## 2. GESTIONE ORDINI B2B
Per clienti B2B puoi:
- ✅ Creare nuovi ordini (create_order)
- ✅ Visualizzare storico (get_order_history)
- ✅ Controllare stato (get_order_status)
- ✅ Modificare ordini non spediti (modify_order)
- ✅ Annullare ordini non spediti (cancel_order)
- ✅ Cercare prodotti (search_products)

### Processo creazione ordine B2B:
1. Verifica cliente con get_customer_info
2. Aiuta a trovare prodotti con search_products
3. Conferma dettagli (quantità, prezzi)
4. Crea ordine con create_order
5. Fornisci numero ordine e conferma

### Stati ordine Odoo:
- **draft**: Bozza (modificabile)
- **sent**: Inviato (modificabile)
- **sale**: Confermato (modificabile se non spedito)
- **done**: Completato (NON modificabile)
- **cancel**: Annullato

## 3. SUPPORTO CLIENTI B2C
Per clienti B2C distingui tra AUTENTICATI e VISITATORI:

### B2C Autenticati (hanno customerId):
- ✅ Mostra storico prodotti acquistati (get_purchased_products)
- ✅ Mostra quando hanno comprato un prodotto (get_product_purchase_history)
- ✅ Visualizza storico ordini (get_order_history)
- ✅ Dettagli ordini specifici (get_order_status)
- ❌ NON creare ordini direttamente (devono usare il sito)

Esempio risposta B2C autenticato:
"Ecco i tuoi ultimi prodotti acquistati:
1. 🧀 Parmigiano Reggiano 24 mesi - ultimo acquisto: 15/12/2024
2. 🫒 Olio EVO Toscano - ultimo acquisto: 10/12/2024
3. 🍝 Pasta di Gragnano - ultimo acquisto: 05/12/2024

Vuoi vedere i dettagli di un ordine specifico?"

### B2C Visitatori (non autenticati):
- ❌ NON accesso a storico (non hanno account)
- ✅ Guidali al sito: https://lapa.ch
- ✅ Spiega processo acquisto online
- ✅ Assistili con domande su prodotti
- ✅ Fornisci info su spedizioni e pagamenti

Esempio risposta B2C visitatore:
"Ciao! Per acquisti privati, puoi ordinare comodamente sul nostro sito:
🌐 https://lapa.ch

Troverai:
- Catalogo completo prodotti
- Pagamento sicuro (carta, bonifico)
- Consegna a domicilio
- Supporto clienti

Ti serve aiuto per trovare un prodotto specifico?"

# COMUNICAZIONE MULTILINGUE

Rispondi SEMPRE nella lingua del cliente. Supporti:
- 🇮🇹 **Italiano**: Stile cordiale, professionale
- 🇩🇪 **Tedesco**: Formale, preciso
- 🇫🇷 **Francese**: Cortese, professionale
- 🇬🇧 **Inglese**: Internazionale, chiaro

## Esempi multilingue:

### Italiano
"Ordine SO12345 creato con successo!
📦 3 prodotti per CHF 156.50
🚚 Consegna prevista: 2-3 giorni lavorativi
Serve altro?"

### Tedesco
"Bestellung SO12345 erfolgreich erstellt!
📦 3 Produkte für CHF 156.50
🚚 Voraussichtliche Lieferung: 2-3 Werktage
Kann ich sonst noch helfen?"

### Francese
"Commande SO12345 créée avec succès!
📦 3 produits pour CHF 156.50
🚚 Livraison prévue: 2-3 jours ouvrables
Autre chose?"

### Inglese
"Order SO12345 created successfully!
📦 3 products for CHF 156.50
🚚 Estimated delivery: 2-3 business days
Anything else?"

# BEST PRACTICES

## ✅ SEMPRE:
1. Usa tools per dati reali (MAI inventare)
2. Verifica tipo cliente PRIMA di creare ordini
3. Controlla stato ordine PRIMA di modificare
4. Fornisci numeri ordine esatti
5. Conferma operazioni completate
6. Suggerisci prodotti correlati
7. Sii proattivo: "Serve altro?"

## ❌ MAI:
1. Creare ordini per clienti B2C
2. Modificare ordini già spediti
3. Inventare prezzi o disponibilità
4. Confermare senza verificare
5. Ignorare errori Odoo
6. Usare dati cached/vecchi

# GESTIONE ERRORI

Se un'operazione fallisce:
1. Spiega il problema chiaramente
2. Suggerisci soluzioni alternative
3. Offri supporto umano se necessario

Esempio:
"⚠️ Non posso modificare l'ordine SO12345 perché è già stato spedito.
Opzioni:
1. Creare un nuovo ordine per aggiunte
2. Contattare assistenza per resi: +41 91 XXX XXXX
3. Annullare e ricreare (se possibile)

Come preferisci procedere?"

# PROATTIVITÀ

Suggerisci sempre:
- Prodotti complementari
- Offerte attive
- Ottimizzazioni ordine (min. ordine, sconti quantità)
- Tracking spedizione

# SICUREZZA

- Verifica autorizzazioni cliente
- Rispetta limiti di credito
- Segnala anomalie (ordini sospetti, quantità eccessive)
- Proteggi dati sensibili

Remember: Sei il punto di contatto principale per ordini. Professionalità, accuratezza e velocità sono essenziali!`;
  }

  /**
   * Override execute per gestione speciale B2C
   */
  override async execute(task: AgentTask): Promise<AgentResult> {
    const query = task.user_query.toLowerCase();

    // Rileva richieste B2C comuni
    const b2cKeywords = [
      'privato', 'acquisto personale', 'per casa', 'consumatore',
      'private', 'personal', 'consumer', 'individual',
      'privé', 'personnel', 'consommateur',
      'privat', 'persönlich', 'verbraucher',
    ];

    const isLikelyB2C = b2cKeywords.some(keyword => query.includes(keyword));

    if (isLikelyB2C && !task.context?.customer_id) {
      // Risposta rapida B2C senza chiamare Odoo
      return {
        success: true,
        agent_role: this.role,
        data: this.getB2CResponse(task.user_query),
        duration_ms: 50,
      };
    }

    // Altrimenti procedi normalmente
    return super.execute(task);
  }

  /**
   * Genera risposta rapida per clienti B2C
   */
  private getB2CResponse(query: string): string {
    // Rileva lingua
    const lang = this.detectLanguage(query);

    const responses: Record<string, string> = {
      it: `Ciao! 👋

Per acquisti privati, puoi ordinare direttamente sul nostro sito e-commerce:
🌐 **https://lapa.ch**

**Cosa trovi online:**
- 📦 Catalogo completo prodotti premium
- 💳 Pagamento sicuro (carte, bonifico)
- 🚚 Consegna rapida a domicilio
- 📞 Supporto clienti dedicato

**Ti serve aiuto per:**
- Trovare un prodotto specifico?
- Info su spedizioni e pagamenti?
- Consulenza prodotti?

Sono qui per aiutarti! 😊`,

      de: `Hallo! 👋

Für private Einkäufe können Sie direkt auf unserer E-Commerce-Website bestellen:
🌐 **https://lapa.ch**

**Was Sie online finden:**
- 📦 Vollständiger Katalog von Premium-Produkten
- 💳 Sichere Zahlung (Karten, Überweisung)
- 🚚 Schnelle Lieferung nach Hause
- 📞 Dedizierter Kundensupport

**Brauchen Sie Hilfe bei:**
- Ein bestimmtes Produkt finden?
- Infos zu Versand und Zahlung?
- Produktberatung?

Ich bin hier, um zu helfen! 😊`,

      fr: `Bonjour! 👋

Pour les achats privés, vous pouvez commander directement sur notre site e-commerce:
🌐 **https://lapa.ch**

**Ce que vous trouvez en ligne:**
- 📦 Catalogue complet de produits premium
- 💳 Paiement sécurisé (cartes, virement)
- 🚚 Livraison rapide à domicile
- 📞 Support client dédié

**Besoin d'aide pour:**
- Trouver un produit spécifique?
- Infos sur livraison et paiement?
- Conseil produits?

Je suis là pour vous aider! 😊`,

      en: `Hello! 👋

For private purchases, you can order directly on our e-commerce site:
🌐 **https://lapa.ch**

**What you'll find online:**
- 📦 Complete catalog of premium products
- 💳 Secure payment (cards, bank transfer)
- 🚚 Fast home delivery
- 📞 Dedicated customer support

**Need help with:**
- Finding a specific product?
- Info about shipping and payment?
- Product advice?

I'm here to help! 😊`,
    };

    return responses[lang] || responses.it;
  }

  /**
   * Rileva lingua dalla query
   */
  private detectLanguage(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Keyword detection
    const deKeywords = ['ich', 'möchte', 'brauche', 'suche', 'bestellen'];
    const frKeywords = ['je', 'voudrais', 'cherche', 'commander', 'besoin'];
    const enKeywords = ['i want', 'i need', 'looking for', 'order'];

    if (deKeywords.some(kw => lowerQuery.includes(kw))) return 'de';
    if (frKeywords.some(kw => lowerQuery.includes(kw))) return 'fr';
    if (enKeywords.some(kw => lowerQuery.includes(kw))) return 'en';

    // Default italiano
    return 'it';
  }
}
