/**
 * LAPA AGENTS - Export centrale
 *
 * Questo file esporta tutti gli agenti disponibili nel sistema
 */

// Products Agent
export {
  ProductsAgent,
  productsAgent,
  type Product,
  type ProductAvailability,
  type ProductPrice,
  type SimilarProduct,
  type Promotion,
  type SearchFilters,
  type AgentResponse,
  type LocationStock,
} from './products-agent';

// Aggiungi qui altri agenti quando verranno creati
// export { CustomerAgent, customerAgent } from './customer-agent';
// export { OrdersAgent, ordersAgent } from './orders-agent';
// export { InventoryAgent, inventoryAgent } from './inventory-agent';
