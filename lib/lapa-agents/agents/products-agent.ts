/**
 * PRODUCTS AGENT - Gestione intelligente informazioni prodotti
 *
 * Funzionalità:
 * - Ricerca prodotti per nome/categoria/codice
 * - Verifica disponibilità in tempo reale
 * - Calcolo prezzi B2B vs B2C
 * - Suggerimenti prodotti simili
 * - Gestione promozioni e offerte
 *
 * INTEGRAZIONE ODOO - DATI REALI:
 * =================================
 *
 * searchProducts() - Cerca in product.product usando domain Odoo
 *   Campi: id, name, default_code, barcode, list_price, categ_id, qty_available
 *
 * getProductDetails() - Recupera singolo prodotto con tutti i campi
 *   Campi: id, name, default_code, barcode, list_price, standard_price,
 *          categ_id, type, image_1920, description, description_sale, uom_id
 *
 * checkAvailability() - Verifica stock REALE da product.product
 *   Campi: qty_available, virtual_available, outgoing_qty, incoming_qty, free_qty
 *   Plus: Dettaglio ubicazioni da stock.quant
 *
 * getPrice() - Calcola prezzo da listini REALI (product.pricelist)
 *   - Se partnerId fornito: usa property_product_pricelist del cliente
 *   - Altrimenti: cerca listino B2B o B2C per nome
 *   - Usa get_product_price_rule per calcolo automatico sconti
 *   - Considera regole di listino e quantità minime
 *
 * getProductSuppliers() - Info fornitori da product.supplierinfo
 *   Campi: partner_id, price, currency_id, min_qty, delay
 *
 * getCategories() - Lista categorie da product.category
 *
 * Integrazione: Odoo XML-RPC tramite createOdooRPCClient()
 */

import { createOdooRPCClient, OdooRPCClient } from '../../odoo/rpcClient';
import {
  findSimilarProducts,
  isEmbeddingsReady,
  SimilarProduct as SemanticMatch
} from '../product-embedding-service';

// ============= TYPES =============

export interface Product {
  id: number;
  name: string;
  default_code?: string;  // SKU/Codice prodotto
  barcode?: string;
  categ_id: [number, string];  // [id, nome categoria]
  list_price: number;  // Prezzo listino
  standard_price: number;  // Costo
  type: 'product' | 'consu' | 'service';
  description?: string;
  description_sale?: string;
  uom_id: [number, string];  // Unità di misura
  image_1920?: string;  // Immagine base64
  active: boolean;
}

export interface ProductAvailability {
  productId: number;
  productName: string;
  qty_available: number;  // Quantità disponibile
  virtual_available: number;  // Quantità prevista (considerando ordini in arrivo)
  outgoing_qty: number;  // Quantità in uscita (ordini da evadere)
  incoming_qty: number;  // Quantità in arrivo (ordini da fornitori)
  free_qty: number;  // Quantità libera (disponibile - impegnata)
  warehouse?: string;
  locations?: LocationStock[];
}

export interface LocationStock {
  locationId: number;
  locationName: string;
  quantity: number;
}

export interface ProductPrice {
  productId: number;
  productName: string;
  customerType: 'B2B' | 'B2C';
  basePrice: number;
  discountPercent?: number;
  finalPrice: number;
  currency: string;
  pricelistName?: string;
  taxIncluded: boolean;
  minQuantity?: number;
}

export interface SimilarProduct {
  product: Product;
  similarityScore: number;  // 0-100
  reason: string;  // Perché è simile
}

export interface Promotion {
  id: number;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  product_ids?: number[];
  category_ids?: number[];
  min_quantity?: number;
  active: boolean;
}

export interface SearchFilters {
  query?: string;
  category_id?: number;
  barcode?: string;
  default_code?: string;  // SKU
  min_price?: number;
  max_price?: number;
  available_only?: boolean;
  active_only?: boolean;
}

export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  timestamp: Date;
  language: 'it' | 'en' | 'fr' | 'de';
}

// ============= MESSAGES MULTILINGUA =============

const MESSAGES = {
  it: {
    product_found: (count: number) => `Trovati ${count} prodotti`,
    product_not_found: 'Nessun prodotto trovato',
    availability_checked: 'Disponibilità verificata',
    price_calculated: 'Prezzo calcolato',
    similar_found: (count: number) => `Trovati ${count} prodotti simili`,
    promotions_active: (count: number) => `${count} promozioni attive`,
    error_search: 'Errore durante la ricerca prodotti',
    error_availability: 'Errore verifica disponibilità',
    error_price: 'Errore calcolo prezzo',
    in_stock: 'Disponibile',
    out_of_stock: 'Non disponibile',
    low_stock: 'Scorte limitate',
  },
  en: {
    product_found: (count: number) => `Found ${count} products`,
    product_not_found: 'No products found',
    availability_checked: 'Availability checked',
    price_calculated: 'Price calculated',
    similar_found: (count: number) => `Found ${count} similar products`,
    promotions_active: (count: number) => `${count} active promotions`,
    error_search: 'Error searching products',
    error_availability: 'Error checking availability',
    error_price: 'Error calculating price',
    in_stock: 'In stock',
    out_of_stock: 'Out of stock',
    low_stock: 'Low stock',
  },
  fr: {
    product_found: (count: number) => `${count} produits trouvés`,
    product_not_found: 'Aucun produit trouvé',
    availability_checked: 'Disponibilité vérifiée',
    price_calculated: 'Prix calculé',
    similar_found: (count: number) => `${count} produits similaires trouvés`,
    promotions_active: (count: number) => `${count} promotions actives`,
    error_search: 'Erreur lors de la recherche de produits',
    error_availability: 'Erreur vérification disponibilité',
    error_price: 'Erreur calcul prix',
    in_stock: 'En stock',
    out_of_stock: 'Rupture de stock',
    low_stock: 'Stock limité',
  },
  de: {
    product_found: (count: number) => `${count} Produkte gefunden`,
    product_not_found: 'Keine Produkte gefunden',
    availability_checked: 'Verfügbarkeit geprüft',
    price_calculated: 'Preis berechnet',
    similar_found: (count: number) => `${count} ähnliche Produkte gefunden`,
    promotions_active: (count: number) => `${count} aktive Aktionen`,
    error_search: 'Fehler bei der Produktsuche',
    error_availability: 'Fehler Verfügbarkeitsprüfung',
    error_price: 'Fehler Preisberechnung',
    in_stock: 'Auf Lager',
    out_of_stock: 'Nicht verfügbar',
    low_stock: 'Geringer Bestand',
  },
};

// ============= PRODUCTS AGENT =============

export class ProductsAgent {
  private odoo: OdooRPCClient;
  private language: 'it' | 'en' | 'fr' | 'de' = 'it';

  constructor(language: 'it' | 'en' | 'fr' | 'de' = 'it') {
    this.odoo = createOdooRPCClient();
    this.language = language;
  }

  /**
   * Imposta la lingua per le risposte
   * Permette di cambiare lingua dinamicamente basandosi sul context
   */
  setLanguage(language: 'it' | 'en' | 'fr' | 'de'): void {
    this.language = language;
  }

  /**
   * Ottiene la lingua corrente
   */
  getLanguage(): 'it' | 'en' | 'fr' | 'de' {
    return this.language;
  }

  // Helper per messaggi multilingua
  private msg(key: keyof typeof MESSAGES.it, ...args: number[]): string {
    const message = MESSAGES[this.language][key];
    if (typeof message === 'function') {
      return (message as (count: number) => string)(args[0]);
    }
    return message as string;
  }

  /**
   * RICERCA PRODOTTI
   * Cerca prodotti per nome, categoria, codice, barcode, etc.
   */
  async searchProducts(
    filters: SearchFilters,
    limit: number = 50
  ): Promise<AgentResponse<Product[]>> {
    try {
      console.log('🔍 Ricerca prodotti:', filters);

      // ========================================
      // RAG SEMANTIC SEARCH - Prova prima ricerca semantica
      // NOTA: Non usiamo isEmbeddingsReady() perché in serverless la cache
      // in-memory è vuota ad ogni cold start. findSimilarProducts va direttamente
      // al database PostgreSQL (pgvector) che ha sempre gli embeddings.
      // ========================================
      if (filters.query) {
        console.log('🧠 RAG: Tentativo ricerca semantica per:', filters.query);

        try {
          const semanticMatches = await findSimilarProducts({
            query: filters.query,
            matchThreshold: 0.35,
            matchCount: limit
          });

          if (semanticMatches.length > 0) {
            console.log(`🧠 RAG: Trovati ${semanticMatches.length} prodotti semanticamente simili`);

            // Recupera i dettagli completi da Odoo usando gli ID trovati
            const productIds = semanticMatches.map(m => m.productId);

            const products = await this.odoo.searchRead(
              'product.product',
              [
                ['id', 'in', productIds],
                ['active', '=', true],
                ['sale_ok', '=', true]
              ],
              [
                'id', 'name', 'default_code', 'barcode', 'categ_id',
                'list_price', 'qty_available', 'uom_id', 'product_tmpl_id',
                'description_sale'
              ],
              limit
            );

            if (products.length > 0) {
              console.log(`🧠 RAG: Dettagli recuperati per ${products.length} prodotti`);

              // Ordina per similarity score
              const productMap = new Map(products.map((p: any) => [p.id, p]));
              const sortedProducts = semanticMatches
                .filter(m => productMap.has(m.productId))
                .map(m => productMap.get(m.productId));

              return {
                success: true,
                message: this.msg('product_found', sortedProducts.length),
                data: sortedProducts as Product[],
                timestamp: new Date(),
                language: this.language
              };
            }
          }
        } catch (semanticError) {
          console.warn('🧠 RAG: Ricerca semantica fallita, uso fallback keyword:', semanticError);
        }
      }

      // ========================================
      // FALLBACK: Ricerca keyword tradizionale
      // ========================================

      // Costruisci dominio Odoo
      const domain: any[] = [];

      // Filtro attivi E vendibili
      // IMPORTANTE: sale_ok = true significa che il prodotto può essere venduto ai clienti
      if (filters.active_only !== false) {
        domain.push(['active', '=', true]);
        domain.push(['sale_ok', '=', true]);  // Solo prodotti vendibili!
      }

      // Mappa sinonimi/alias per espandere ricerche comuni
      // Se l'utente cerca "spaghetti" ma in Odoo sono catalogati come "SPAGHETTO", trova comunque
      const synonymsMap: Record<string, string[]> = {
        'spaghetti': ['spaghetto', 'spaghettini', 'spaghettoni', 'spaghet'],
        'spaghetto': ['spaghetti', 'spaghettini', 'spaghettoni'],
        'pasta': ['penne', 'rigatoni', 'fusilli', 'linguine', 'tagliatelle', 'paccheri'],
        'prosciutto': ['prosciut'],
        'mozzarella': ['mozzarel', 'fior di latte'],
        'parmigiano': ['parmigian', 'grana'],
        'pecorino': ['pecorin'],
        'guanciale': ['guancial', 'pancetta'],
        'pancetta': ['pancett', 'guanciale'],
        'pomodoro': ['pomodor', 'pelati', 'passata'],
        'olio': ['extravergine', 'evo'],
        'aceto': ['balsamico'],
        // Frutti di mare - IMPORTANTE per ricerche astice/coda
        'astice': ['hummer', 'lobster', 'aragosta'],
        'coda': ['hummerschwaenze', 'schwanz', 'tail', 'code'],
        'aragosta': ['astice', 'lobster', 'hummer'],
        'polpo': ['octopus', 'poulpe', 'krake', 'tentacoli'],
        'gamberi': ['gamber', 'shrimp', 'garnelen', 'crevettes'],
        'scampi': ['scampo', 'langoustine'],
        'seppia': ['sepia', 'cuttlefish', 'seppie'],
        'calamari': ['calamar', 'squid', 'totani'],
        'vongole': ['vongola', 'clams', 'muscheln'],
        'cozze': ['cozza', 'mussels', 'miesmuscheln'],
      };

      // Ricerca testuale intelligente
      // Se la query ha più parole, cerca prodotti che contengono TUTTE le parole SIGNIFICATIVE
      // Es: "mozzarella di bufala" cerca prodotti con "mozzarella" E "bufala" nel nome
      // Stop words italiane vengono filtrate per evitare match troppo generici
      if (filters.query) {
        // Stop words italiane comuni da ignorare nella ricerca
        const italianStopWords = new Set([
          'di', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
          'il', 'la', 'lo', 'i', 'gli', 'le', 'un', 'una', 'uno',
          'a', 'al', 'alla', 'allo', 'ai', 'agli', 'alle',
          'in', 'nel', 'nella', 'nello', 'nei', 'negli', 'nelle',
          'con', 'su', 'per', 'tra', 'fra', 'e', 'o', 'ma', 'che', 'non',
          'kg', 'gr', 'lt', 'ml', 'pz', 'conf'
        ]);

        const allWords = filters.query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
        // Filtra stop words - mantieni solo parole significative
        const significantWords = allWords.filter(w => !italianStopWords.has(w));

        // Se non rimangono parole significative, usa tutte le parole originali
        const queryWords = significantWords.length > 0 ? significantWords : allWords;

        if (queryWords.length > 1) {
          // Ricerca multi-parola CON SINONIMI: per ogni parola, cerca anche i sinonimi
          // Es: "coda di astice" → (coda OR hummerschwaenze OR tail) AND (astice OR hummer OR lobster)
          for (const word of queryWords) {
            const wordSynonyms = synonymsMap[word.toLowerCase()] || [];
            const allTermsForWord = [word, ...wordSynonyms];

            if (allTermsForWord.length > 1) {
              // Più termini per questa parola - crea OR tra di loro
              for (let i = 0; i < allTermsForWord.length - 1; i++) {
                domain.push('|');
              }
              for (const term of allTermsForWord) {
                domain.push(['name', 'ilike', term]);
              }
            } else {
              // Solo una parola - cerca direttamente
              domain.push(['name', 'ilike', word]);
            }
          }
          console.log(`🔍 Ricerca multi-parola con sinonimi: ${queryWords.map(w => {
            const syns = synonymsMap[w.toLowerCase()] || [];
            return syns.length > 0 ? `(${w}|${syns.join('|')})` : w;
          }).join(' + ')}`);
        } else if (queryWords.length === 1) {
          // Ricerca singola parola: espandi con sinonimi se disponibili
          const searchWord = queryWords[0].toLowerCase();
          const synonyms = synonymsMap[searchWord] || [];
          const allTerms = [searchWord, ...synonyms];

          // Costruisci OR per tutti i termini (inclusi sinonimi)
          // Es: spaghetti -> cerca "spaghetti" OR "spaghetto" OR "spaghettini" OR "spaghettoni"
          if (allTerms.length > 1) {
            // Aggiungi N-1 operatori '|' per l'OR
            for (let i = 0; i < allTerms.length - 1; i++) {
              domain.push('|');
            }
            for (const term of allTerms) {
              domain.push(['name', 'ilike', term]);
            }
            console.log(`🔍 Ricerca con sinonimi: ${allTerms.join(' | ')}`);
          } else {
            // Nessun sinonimo - cerca in tutti i campi
            domain.push('|', '|', '|');
            domain.push(['name', 'ilike', searchWord]);
            domain.push(['default_code', 'ilike', searchWord]);
            domain.push(['barcode', 'ilike', searchWord]);
            domain.push(['description_sale', 'ilike', searchWord]);
          }
        } else {
          // Fallback: ricerca con query originale
          domain.push('|', '|', '|');
          domain.push(['name', 'ilike', filters.query]);
          domain.push(['default_code', 'ilike', filters.query]);
          domain.push(['barcode', 'ilike', filters.query]);
          domain.push(['description_sale', 'ilike', filters.query]);
        }
      }

      // Filtro categoria
      if (filters.category_id) {
        domain.push(['categ_id', '=', filters.category_id]);
      }

      // Filtro barcode esatto
      if (filters.barcode) {
        domain.push(['barcode', '=', filters.barcode]);
      }

      // Filtro codice prodotto esatto
      if (filters.default_code) {
        domain.push(['default_code', '=', filters.default_code]);
      }

      // Filtro range prezzi
      if (filters.min_price !== undefined) {
        domain.push(['list_price', '>=', filters.min_price]);
      }
      if (filters.max_price !== undefined) {
        domain.push(['list_price', '<=', filters.max_price]);
      }

      // Esegui ricerca
      const products = await this.odoo.searchRead(
        'product.product',
        domain,
        [
          'id', 'name', 'default_code', 'barcode', 'categ_id',
          'list_price', 'standard_price', 'type', 'description',
          'description_sale', 'uom_id', 'active',
          'qty_available', 'virtual_available',
          'product_tmpl_id'  // ID del template per URL sito web
        ],
        limit,
        'name asc'
      );

      // Filtro disponibilità (se richiesto)
      let filteredProducts = products;
      if (filters.available_only) {
        const availableProducts: Product[] = [];
        for (const product of products) {
          const availability = await this.checkAvailability(product.id);
          if (availability.data && availability.data.qty_available > 0) {
            availableProducts.push(product);
          }
        }
        filteredProducts = availableProducts;
      }

      console.log(`✅ Trovati ${filteredProducts.length} prodotti`);

      return {
        success: true,
        data: filteredProducts,
        message: this.msg('product_found', filteredProducts.length),
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore ricerca prodotti:', error);
      return {
        success: false,
        message: this.msg('error_search'),
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  /**
   * DETTAGLI PRODOTTO
   * Recupera informazioni complete su un prodotto specifico
   */
  async getProductDetails(productId: number): Promise<AgentResponse<Product>> {
    try {
      console.log('📦 Recupero dettagli prodotto:', productId);

      const products = await this.odoo.searchRead(
        'product.product',
        [['id', '=', productId]],
        [
          'id', 'name', 'default_code', 'barcode', 'categ_id',
          'list_price', 'standard_price', 'type', 'description',
          'description_sale', 'uom_id', 'active', 'image_1920'
        ],
        1
      );

      if (products.length === 0) {
        return {
          success: false,
          message: this.msg('product_not_found'),
          timestamp: new Date(),
          language: this.language,
        };
      }

      return {
        success: true,
        data: products[0],
        message: `${products[0].name}`,
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore dettagli prodotto:', error);
      return {
        success: false,
        message: this.msg('error_search'),
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  /**
   * VERIFICA DISPONIBILITÀ
   * Controlla disponibilità in magazzino con dettaglio ubicazioni
   */
  async checkAvailability(productId: number): Promise<AgentResponse<ProductAvailability>> {
    try {
      console.log('📊 Verifica disponibilità prodotto:', productId);

      // Recupera informazioni stock del prodotto
      const stockData = await this.odoo.searchRead(
        'product.product',
        [['id', '=', productId]],
        [
          'id', 'name', 'qty_available', 'virtual_available',
          'outgoing_qty', 'incoming_qty', 'free_qty'
        ],
        1
      );

      if (stockData.length === 0) {
        return {
          success: false,
          message: this.msg('product_not_found'),
          timestamp: new Date(),
          language: this.language,
        };
      }

      const product = stockData[0];

      // Recupera stock per ubicazione (opzionale - più dettagliato)
      const locationStocks: LocationStock[] = [];
      try {
        const quants = await this.odoo.searchRead(
          'stock.quant',
          [
            ['product_id', '=', productId],
            ['quantity', '>', 0],
            ['location_id.usage', '=', 'internal']
          ],
          ['location_id', 'quantity'],
          20,
          'quantity desc'
        );

        for (const quant of quants) {
          locationStocks.push({
            locationId: quant.location_id[0],
            locationName: quant.location_id[1],
            quantity: quant.quantity,
          });
        }
      } catch (error) {
        console.warn('⚠️ Impossibile recuperare dettagli ubicazioni:', error);
      }

      const availability: ProductAvailability = {
        productId: product.id,
        productName: product.name,
        qty_available: product.qty_available || 0,
        virtual_available: product.virtual_available || 0,
        outgoing_qty: product.outgoing_qty || 0,
        incoming_qty: product.incoming_qty || 0,
        free_qty: product.free_qty || 0,
        locations: locationStocks,
      };

      // Determina stato stock
      let stockStatus = this.msg('in_stock');
      if (availability.qty_available <= 0) {
        stockStatus = this.msg('out_of_stock');
      } else if (availability.qty_available < 10) {
        stockStatus = this.msg('low_stock');
      }

      return {
        success: true,
        data: availability,
        message: `${this.msg('availability_checked')} - ${stockStatus}`,
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore verifica disponibilità:', error);
      return {
        success: false,
        message: this.msg('error_availability'),
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  /**
   * CALCOLO PREZZO
   * Calcola prezzo per cliente B2B o B2C considerando listini e promozioni
   */
  async getPrice(
    productId: number,
    customerType: 'B2B' | 'B2C',
    quantity: number = 1,
    partnerId?: number
  ): Promise<AgentResponse<ProductPrice>> {
    try {
      console.log('💰 Calcolo prezzo:', { productId, customerType, quantity, partnerId });

      // Recupera prodotto
      const products = await this.odoo.searchRead(
        'product.product',
        [['id', '=', productId]],
        ['id', 'name', 'list_price', 'standard_price'],
        1
      );

      if (products.length === 0) {
        return {
          success: false,
          message: this.msg('product_not_found'),
          timestamp: new Date(),
          language: this.language,
        };
      }

      const product = products[0];
      let pricelistId: number | null = null;
      let pricelistName = 'Listino standard';
      let currency = 'EUR';
      let finalPrice = product.list_price;
      let discountPercent = 0;

      // Se c'è un partner specifico, usa il suo listino
      if (partnerId) {
        try {
          const partners = await this.odoo.searchRead(
            'res.partner',
            [['id', '=', partnerId]],
            ['property_product_pricelist'],
            1
          );

          if (partners.length > 0 && partners[0].property_product_pricelist) {
            pricelistId = partners[0].property_product_pricelist[0];
            pricelistName = partners[0].property_product_pricelist[1];
            console.log(`   📋 Listino cliente: ${pricelistName} (ID: ${pricelistId})`);
          }
        } catch (error) {
          console.warn('⚠️ Impossibile recuperare listino del partner');
        }
      }

      // Altrimenti cerca listino in base al tipo cliente
      if (!pricelistId) {
        let pricelistDomain: any[] = [['active', '=', true]];

        if (customerType === 'B2B') {
          // Listino B2B (business)
          pricelistDomain.push(['name', 'ilike', 'B2B']);
        } else {
          // Listino B2C (retail/pubblico)
          pricelistDomain.push(['name', 'ilike', 'B2C']);
        }

        const pricelists = await this.odoo.searchRead(
          'product.pricelist',
          pricelistDomain,
          ['id', 'name', 'currency_id'],
          1
        );

        if (pricelists.length > 0) {
          pricelistId = pricelists[0].id;
          pricelistName = pricelists[0].name;
          currency = pricelists[0].currency_id ? pricelists[0].currency_id[1] : 'EUR';
        }
      }

      // Calcola prezzo dal listino usando il metodo REALE di Odoo
      if (pricelistId) {
        try {
          // Usa get_product_price_rule per ottenere prezzo, sconto e regola applicata
          const priceResult = await this.odoo.callKw(
            'product.pricelist',
            'get_product_price_rule',
            [[pricelistId], productId, quantity, partnerId || false]
          );

          // Formato risposta: { product_id: [prezzo, regola_id] }
          if (priceResult && priceResult[productId]) {
            const [calculatedPrice, ruleId] = priceResult[productId];

            if (calculatedPrice && typeof calculatedPrice === 'number') {
              finalPrice = calculatedPrice;

              // Calcola sconto percentuale rispetto al prezzo di listino
              if (product.list_price > 0) {
                discountPercent = ((product.list_price - calculatedPrice) / product.list_price) * 100;
              }

              console.log(`   💰 Prezzo da listino: ${calculatedPrice.toFixed(2)} (sconto: ${discountPercent.toFixed(1)}%)`);

              // Se c'è una regola, recupera i dettagli
              if (ruleId) {
                try {
                  const rules = await this.odoo.searchRead(
                    'product.pricelist.item',
                    [['id', '=', ruleId]],
                    ['name', 'min_quantity'],
                    1
                  );
                  if (rules.length > 0) {
                    console.log(`   📏 Regola applicata: ${rules[0].name || 'N/A'}`);
                  }
                } catch (error) {
                  // Ignora errori nel recupero regola
                }
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Impossibile calcolare prezzo da listino, uso list_price:', error);
          finalPrice = product.list_price;
        }
      } else {
        // Nessun listino trovato, usa prezzo standard
        finalPrice = product.list_price;
        console.log('   ℹ️ Nessun listino trovato, uso list_price');
      }

      const priceData: ProductPrice = {
        productId: product.id,
        productName: product.name,
        customerType,
        basePrice: product.list_price,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
        finalPrice: finalPrice,
        currency: currency,
        pricelistName: pricelistName,
        taxIncluded: customerType === 'B2C', // B2C = IVA inclusa
        minQuantity: quantity,
      };

      return {
        success: true,
        data: priceData,
        message: `${this.msg('price_calculated')}: ${finalPrice.toFixed(2)} ${currency}`,
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore calcolo prezzo:', error);
      return {
        success: false,
        message: this.msg('error_price'),
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  /**
   * PRODOTTI SIMILI
   * Suggerisce prodotti simili basandosi su categoria, prezzo, e attributi
   */
  async getSimilarProducts(
    productId: number,
    limit: number = 10
  ): Promise<AgentResponse<SimilarProduct[]>> {
    try {
      console.log('🔗 Ricerca prodotti simili a:', productId);

      // Recupera prodotto di riferimento
      const refProducts = await this.odoo.searchRead(
        'product.product',
        [['id', '=', productId]],
        ['id', 'name', 'categ_id', 'list_price', 'default_code'],
        1
      );

      if (refProducts.length === 0) {
        return {
          success: false,
          message: this.msg('product_not_found'),
          timestamp: new Date(),
          language: this.language,
        };
      }

      const refProduct = refProducts[0];
      const similarProducts: SimilarProduct[] = [];

      // 1. Stessa categoria
      const sameCategoryProducts = await this.odoo.searchRead(
        'product.product',
        [
          ['categ_id', '=', refProduct.categ_id[0]],
          ['id', '!=', productId],
          ['active', '=', true]
        ],
        ['id', 'name', 'default_code', 'barcode', 'categ_id', 'list_price', 'standard_price', 'type', 'uom_id', 'active'],
        limit,
        'list_price asc'
      );

      for (const product of sameCategoryProducts) {
        let score = 60; // Base score per stessa categoria
        let reason = `Categoria: ${refProduct.categ_id[1]}`;

        // Prezzo simile (+20 punti)
        const priceDiff = Math.abs(product.list_price - refProduct.list_price);
        const pricePercent = (priceDiff / refProduct.list_price) * 100;
        if (pricePercent < 20) {
          score += 20;
          reason += `, Prezzo simile`;
        }

        // Nome simile (+20 punti)
        const nameSimilarity = this.calculateStringSimilarity(
          product.name.toLowerCase(),
          refProduct.name.toLowerCase()
        );
        if (nameSimilarity > 0.3) {
          score += 20;
          reason += `, Nome correlato`;
        }

        similarProducts.push({
          product,
          similarityScore: Math.min(100, score),
          reason,
        });
      }

      // 2. Prezzo simile (anche altre categorie)
      const priceRangeProducts = await this.odoo.searchRead(
        'product.product',
        [
          ['list_price', '>=', refProduct.list_price * 0.7],
          ['list_price', '<=', refProduct.list_price * 1.3],
          ['id', '!=', productId],
          ['categ_id', '!=', refProduct.categ_id[0]],
          ['active', '=', true]
        ],
        ['id', 'name', 'default_code', 'barcode', 'categ_id', 'list_price', 'standard_price', 'type', 'uom_id', 'active'],
        5
      );

      for (const product of priceRangeProducts) {
        // Evita duplicati
        if (similarProducts.some(sp => sp.product.id === product.id)) {
          continue;
        }

        let score = 40; // Base score per prezzo simile
        let reason = `Prezzo simile (${product.list_price.toFixed(2)} EUR)`;

        similarProducts.push({
          product,
          similarityScore: score,
          reason,
        });
      }

      // Ordina per similarity score (più alto prima)
      const sortedProducts = similarProducts
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);

      return {
        success: true,
        data: sortedProducts,
        message: this.msg('similar_found', sortedProducts.length),
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore ricerca prodotti simili:', error);
      return {
        success: false,
        message: this.msg('error_search'),
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  /**
   * PROMOZIONI ATTIVE
   * Recupera tutte le promozioni attive (sale coupons, sconti, etc.)
   */
  async getPromotions(
    productId?: number,
    categoryId?: number
  ): Promise<AgentResponse<Promotion[]>> {
    try {
      console.log('🎁 Recupero promozioni attive');

      const today = new Date().toISOString().split('T')[0];

      // Domain per promozioni attive
      const domain: any[] = [
        ['active', '=', true],
        '|',
        ['start_date', '<=', today],
        ['start_date', '=', false],
        '|',
        ['end_date', '>=', today],
        ['end_date', '=', false],
      ];

      // Filtra per prodotto specifico
      if (productId) {
        domain.push(['product_ids', 'in', [productId]]);
      }

      // Filtra per categoria
      if (categoryId) {
        domain.push(['category_ids', 'in', [categoryId]]);
      }

      // Cerca in sale.coupon.program (Odoo 14+) o loyalty.program (Odoo 16+)
      let promotions: any[] = [];

      try {
        // Prova prima loyalty.program (Odoo 16+)
        promotions = await this.odoo.searchRead(
          'loyalty.program',
          domain,
          [
            'id', 'name', 'program_type', 'trigger', 'reward_ids',
            'rule_ids', 'active', 'date_from', 'date_to'
          ],
          20,
          'name'
        );
      } catch (error) {
        console.log('⚠️ loyalty.program non disponibile, provo sale.coupon.program');

        // Fallback a sale.coupon.program
        try {
          promotions = await this.odoo.searchRead(
            'sale.coupon.program',
            domain,
            [
              'id', 'name', 'discount_type', 'discount_percentage',
              'discount_fixed_amount', 'active', 'rule_date_from', 'rule_date_to',
              'rule_products_domain', 'promo_code'
            ],
            20
          );
        } catch (error2) {
          console.warn('⚠️ Nessun modulo promozioni disponibile');
          promotions = [];
        }
      }

      // Formatta risultati
      const formattedPromotions: Promotion[] = promotions.map(promo => ({
        id: promo.id,
        name: promo.name,
        description: promo.promo_code || undefined,
        discount_type: promo.discount_type || 'percentage',
        discount_value: promo.discount_percentage || promo.discount_fixed_amount || 0,
        start_date: promo.date_from || promo.rule_date_from || today,
        end_date: promo.date_to || promo.rule_date_to || today,
        active: promo.active,
      }));

      return {
        success: true,
        data: formattedPromotions,
        message: this.msg('promotions_active', formattedPromotions.length),
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore recupero promozioni:', error);
      return {
        success: false,
        message: this.msg('error_search'),
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  // ============= UTILITY METHODS =============

  /**
   * Calcola similarità tra due stringhe (Levenshtein-like semplificato)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    // Calcola quanti caratteri in comune
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        matches++;
      }
    }

    return matches / longer.length;
  }

  /**
   * Cambia lingua dell'agente
   */
  setLanguage(language: 'it' | 'en' | 'fr' | 'de'): void {
    this.language = language;
  }

  /**
   * Test connessione Odoo
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.odoo.searchRead(
        'product.product',
        [['active', '=', true]],
        ['id'],
        1
      );
      return result.length > 0;
    } catch (error) {
      console.error('❌ Test connessione fallito:', error);
      return false;
    }
  }

  /**
   * CATEGORIE PRODOTTI
   * Recupera tutte le categorie disponibili in Odoo
   */
  async getCategories(parentId?: number): Promise<AgentResponse<any[]>> {
    try {
      console.log('📂 Recupero categorie prodotti', parentId ? `(parent: ${parentId})` : '');

      const domain: any[] = [];

      // Se specificato, filtra per categoria padre
      if (parentId) {
        domain.push(['parent_id', '=', parentId]);
      }

      const categories = await this.odoo.searchRead(
        'product.category',
        domain,
        ['id', 'name', 'parent_id', 'complete_name', 'product_count'],
        50,
        'name asc'
      );

      console.log(`✅ Trovate ${categories.length} categorie`);

      return {
        success: true,
        data: categories,
        message: `Trovate ${categories.length} categorie`,
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore recupero categorie:', error);
      return {
        success: false,
        message: 'Errore recupero categorie',
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }

  /**
   * DETTAGLI FORNITORE PRODOTTO
   * Recupera informazioni sui fornitori del prodotto con prezzi di acquisto
   */
  async getProductSuppliers(productId: number): Promise<AgentResponse<any[]>> {
    try {
      console.log('🏪 Recupero fornitori prodotto:', productId);

      // Recupera product.supplierinfo del prodotto
      const suppliers = await this.odoo.searchRead(
        'product.supplierinfo',
        [['product_id', '=', productId]],
        [
          'id', 'partner_id', 'product_name', 'product_code',
          'price', 'currency_id', 'min_qty', 'delay'
        ],
        10,
        'sequence,min_qty'
      );

      console.log(`✅ Trovati ${suppliers.length} fornitori`);

      return {
        success: true,
        data: suppliers,
        message: `Trovati ${suppliers.length} fornitori`,
        timestamp: new Date(),
        language: this.language,
      };

    } catch (error: any) {
      console.error('❌ Errore recupero fornitori:', error);
      return {
        success: false,
        message: 'Errore recupero fornitori',
        error: error.message,
        timestamp: new Date(),
        language: this.language,
      };
    }
  }
}

// ============= SINGLETON EXPORT =============

export const productsAgent = new ProductsAgent('it');

// Export anche costruttore per istanze personalizzate
export default ProductsAgent;
