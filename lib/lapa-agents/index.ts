/**
 * LAPA AI AGENTS - Index
 *
 * Esporta tutti gli agenti e l'orchestratore per facile importazione
 */

// Orchestratore
export { LapaAiOrchestrator, getOrchestrator, createOrchestrator } from './orchestrator';

// Agenti specializzati
export { OrdersAgent } from './agents/orders-agent';
export { InvoicesAgent, getInvoicesAgent } from './agents/invoices-agent';
export { ShippingAgent, getShippingAgent } from './agents/shipping-agent';
export { ProductsAgent, getProductsAgent } from './agents/products-agent';
export { HelpdeskAgent, createHelpdeskAgent } from './agents/helpdesk-agent';

// Types
export type {
  CustomerContext,
  Intent,
  AgentResponse,
  IntentType,
  Message,
  AgentConfig,
} from './orchestrator';

export type {
  Invoice,
  InvoiceLine,
  InvoiceDetails,
  CustomerBalance,
  DueInvoice,
} from './agents/invoices-agent';

export type {
  HelpdeskTicket,
  TicketComment,
  CreateTicketParams,
  TicketListFilters,
} from './agents/helpdesk-agent';
