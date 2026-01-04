/**
 * LAPA AI - Avatar System Types
 *
 * Sistema Avatar a 2 livelli:
 * - CompanyAvatar: Dati aziendali (prodotti, ordini, info locale)
 * - ContactAvatar: Dati persona (comunicazione, personalità, note personali)
 *
 * @author Claude AI
 * @date 2026-01-04
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * 4 Stili di comunicazione (semplificazione Ologrammi Merenda)
 */
export type CommunicationStyle =
  | 'diretto'      // Dominante - Vai al punto, no chiacchiere
  | 'analitico'    // Dominante - Dammi dati, confronti, logica
  | 'relazionale'  // Gregario - Chiacchieriamo, come stai?
  | 'pratico';     // Gregario - Fammi facile, zero pensieri

/**
 * Categoria principale (Merenda)
 */
export type PersonalityCategory = 'dominante' | 'gregario';

/**
 * Tipo di azienda/locale
 */
export type BusinessType =
  | 'ristorante'
  | 'pizzeria'
  | 'ristorante_pizzeria'
  | 'bar_gelateria'
  | 'pasticceria'
  | 'hotel'
  | 'negozio_alimentare'
  | 'catering'
  | 'food_truck'
  | 'altro';

/**
 * Tipo di partner
 */
export type PartnerType = 'cliente' | 'fornitore';

/**
 * Ruoli comuni dei contatti
 */
export type ContactRole =
  | 'titolare'
  | 'direttore'
  | 'chef'
  | 'pizzaiolo'
  | 'pasticcere'
  | 'responsabile_ordini'
  | 'responsabile_cucina'
  | 'amministrazione'
  | 'commercialista'
  | 'cameriere'
  | 'altro';

// ============================================================================
// AVATAR AZIENDA (Company Avatar)
// ============================================================================

/**
 * Informazioni dal web scraping
 */
export interface WebEnrichment {
  // Sito web
  website_url?: string;
  menu_items?: string[];           // Piatti dal menu
  cuisine_style?: string;          // Es: "Napoletana", "Romana", "Fusion"
  price_range?: string;            // Es: "€", "€€", "€€€"
  specialties?: string[];          // Specialità del locale
  opening_hours?: string;

  // Google My Business / TripAdvisor
  google_rating?: number;          // 1-5
  google_reviews_count?: number;
  tripadvisor_rating?: number;
  tripadvisor_reviews_count?: number;
  top_praised?: string[];          // Es: ["pizza", "servizio", "atmosfera"]
  recent_sentiment?: 'positivo' | 'neutro' | 'negativo';

  // Social Media
  instagram_handle?: string;
  instagram_followers?: number;
  facebook_page?: string;
  facebook_followers?: number;

  // Metadata
  last_enrichment_date?: string;   // ISO date
  enrichment_source?: string[];    // Es: ["google", "instagram", "website"]
}

/**
 * Pattern di acquisto (da Odoo)
 */
export interface PurchasePatterns {
  // Frequenza
  order_frequency_days?: number;        // Media giorni tra ordini
  preferred_delivery_days?: string[];   // Es: ["martedì", "venerdì"]
  preferred_order_time?: string;        // Es: "mattina", "sera"

  // Prodotti
  top_products?: Array<{
    product_id: number;
    product_name: string;
    quantity_avg: number;
    last_ordered: string;
  }>;
  product_categories?: string[];        // Categorie più ordinate

  // Valori
  avg_order_value?: number;
  total_revenue?: number;
  total_orders?: number;

  // Date
  first_order_date?: string;
  last_order_date?: string;
  days_since_last_order?: number;
}

/**
 * Avatar Azienda - Dati del locale/business
 */
export interface CompanyAvatar {
  // Identificazione
  id: string;                      // UUID
  odoo_partner_id: number;         // ID Odoo
  partner_type: PartnerType;       // cliente o fornitore

  // Dati anagrafici (da Odoo)
  name: string;
  business_type: BusinessType;
  industry?: string;               // Industry da Odoo
  city?: string;
  address?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  vat?: string;

  // Categorizzazione Odoo
  odoo_tags?: number[];            // category_id da Odoo
  customer_rank?: number;
  supplier_rank?: number;

  // Arricchimento Web
  web_enrichment?: WebEnrichment;

  // Pattern acquisti/vendite
  purchase_patterns?: PurchasePatterns;

  // Note aziendali
  company_notes?: string[];        // Note generiche sull'azienda

  // Contatti collegati
  contact_ids?: string[];          // UUID dei ContactAvatar

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sync_odoo?: string;
}

// ============================================================================
// AVATAR CONTATTO (Contact Avatar)
// ============================================================================

/**
 * Guida comunicazione per l'AI
 */
export interface CommunicationGuide {
  // Stile principale
  style: CommunicationStyle;
  category: PersonalityCategory;

  // Dettagli comunicazione
  preferred_tone: 'formale' | 'informale' | 'amichevole';
  uses_emoji: boolean;
  preferred_language: 'it' | 'de' | 'fr' | 'en';
  message_length: 'corto' | 'medio' | 'dettagliato';

  // Keywords da usare/evitare
  keywords_to_use?: string[];
  keywords_to_avoid?: string[];

  // Approccio vendita
  sales_approach?: string;         // Descrizione libera

  // Esempio di apertura
  greeting_example?: string;       // Es: "Ciao Jason! Come va?"
}

/**
 * Date importanti
 */
export interface ImportantDate {
  date: string;                    // Formato MM-DD
  occasion: string;                // Es: "Compleanno", "Anniversario apertura"
  year?: number;                   // Anno se rilevante
}

/**
 * Follow-up da fare
 */
export interface FollowUp {
  id: string;
  action: string;                  // Es: "Chiedere come è andata la degustazione"
  created_at: string;
  due_date?: string;
  done: boolean;
  done_at?: string;
}

/**
 * Avatar Contatto - Dati della persona
 */
export interface ContactAvatar {
  // Identificazione
  id: string;                      // UUID
  odoo_partner_id: number;         // ID Odoo del contatto
  company_avatar_id: string;       // UUID dell'azienda madre

  // Dati anagrafici (da Odoo)
  name: string;
  role?: ContactRole;
  role_description?: string;       // Descrizione libera del ruolo
  email?: string;
  phone?: string;
  mobile?: string;

  // Comunicazione (4 stili)
  communication: CommunicationGuide;

  // Info personali
  birthday?: string;               // Formato MM-DD
  important_dates?: ImportantDate[];
  personal_notes?: string[];       // Es: ["Tifoso del Napoli", "Ha un figlio piccolo"]

  // Relazione
  relationship_notes?: string;     // Come è la relazione con noi
  decision_maker: boolean;         // Può decidere acquisti?
  best_contact_time?: string;      // Es: "mattina presto"

  // Follow-up
  followups?: FollowUp[];

  // Conversazioni
  conversation_summary?: string;   // Riassunto conversazioni passate
  last_interaction?: string;       // Data ultimo contatto
  total_interactions?: number;

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Input per creare/aggiornare Company Avatar
 */
export interface CompanyAvatarInput {
  odoo_partner_id: number;
  partner_type: PartnerType;
  name: string;
  business_type?: BusinessType;
  // ... altri campi opzionali
}

/**
 * Input per creare/aggiornare Contact Avatar
 */
export interface ContactAvatarInput {
  odoo_partner_id: number;
  company_avatar_id: string;
  name: string;
  role?: ContactRole;
  communication_style?: CommunicationStyle;
  // ... altri campi opzionali
}

/**
 * Contesto completo per l'AI (Company + Contact)
 */
export interface AvatarContext {
  company: CompanyAvatar;
  contact: ContactAvatar;

  // Contesto formattato per il prompt AI
  ai_context: string;
}

// ============================================================================
// COMMUNICATION STYLE GUIDES (per l'AI)
// ============================================================================

/**
 * Guide di comunicazione per ogni stile
 */
export const COMMUNICATION_STYLE_GUIDES: Record<CommunicationStyle, {
  description: string;
  category: PersonalityCategory;
  do: string[];
  dont: string[];
  keywords: string[];
  example_greeting: string;
  example_pitch: string;
}> = {
  diretto: {
    description: "Dominante - Vai dritto al punto, efficiente, risultati",
    category: "dominante",
    do: [
      "Vai subito al punto",
      "Proponi soluzioni concrete",
      "Rispetta il suo tempo",
      "Lascialo decidere velocemente",
      "Riconosci i suoi successi"
    ],
    dont: [
      "Non fare giri di parole",
      "Non sommergere di dettagli inutili",
      "Non farlo aspettare",
      "Non essere indeciso"
    ],
    keywords: ["subito", "risultato", "efficiente", "deciso", "migliore"],
    example_greeting: "Ciao! Ho quello che ti serve:",
    example_pitch: "Mozzarella Bufala DOP. 12 pezzi, CHF 89. Consegna domani. Confermo?"
  },

  analitico: {
    description: "Dominante - Dati, confronti, logica, precisione",
    category: "dominante",
    do: [
      "Fornisci dati precisi",
      "Fai confronti oggettivi",
      "Cita certificazioni e qualità",
      "Spiega il rapporto qualità-prezzo",
      "Lascia che analizzi"
    ],
    dont: [
      "Non essere vago",
      "Non dire 'fidati di me'",
      "Non saltare i dettagli tecnici",
      "Non pressare per decisioni immediate"
    ],
    keywords: ["dati", "confronto", "certificato", "qualità", "analisi", "rapporto"],
    example_greeting: "Buongiorno, ti mando i dettagli richiesti:",
    example_pitch: "Mozzarella A: CHF 6.90/kg, shelf life 48h. Mozzarella B: CHF 7.40/kg, shelf life 72h (+50%). Costo +7%, durata +50% = meno sprechi."
  },

  relazionale: {
    description: "Gregario - Relazione, chiacchiere, calore umano",
    category: "gregario",
    do: [
      "Chiedi come sta",
      "Ricorda dettagli personali",
      "Fai complimenti sinceri",
      "Mostra interesse genuino",
      "Crea connessione emotiva"
    ],
    dont: [
      "Non essere freddo o distaccato",
      "Non andare subito al business",
      "Non ignorare le sue emozioni",
      "Non essere troppo formale"
    ],
    keywords: ["come stai", "famiglia", "insieme", "contento", "grazie"],
    example_greeting: "Ciao Marco! Come va? Come è andato il weekend?",
    example_pitch: "Ho pensato a te quando è arrivata questa Burrata freschissima! I tuoi clienti impazziranno, vedrai che soddisfazione!"
  },

  pratico: {
    description: "Gregario - Semplicità, zero pensieri, comfort",
    category: "gregario",
    do: [
      "Rendi tutto semplice",
      "Offri soluzioni chiavi in mano",
      "Elimina la complessità",
      "Rassicura che pensi tu a tutto",
      "Proponi ordini automatici"
    ],
    dont: [
      "Non complicare",
      "Non dare troppe opzioni",
      "Non creare lavoro extra",
      "Non mettere fretta"
    ],
    keywords: ["semplice", "facile", "pensiamo noi", "come sempre", "zero pensieri"],
    example_greeting: "Ciao! Ho preparato tutto come al solito:",
    example_pitch: "Ecco il tuo ordine settimanale pronto. Stesse quantità di sempre. Confermi con 'ok' e domani è da te."
  }
};
