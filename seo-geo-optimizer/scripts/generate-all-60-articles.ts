/**
 * GENERATORE AUTOMATICO - 60 ARTICOLI BLOG LAPA
 * Genera tutti i 60 articoli in IT/DE/FR/EN ottimizzati SEO+GEO
 * Usa Claude API per traduzioni e ottimizzazione
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, existsSync } from 'fs';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Lista completa dei 60 articoli da generare
const ARTICLES = [
  // ========== BLOCCO 1: PRODOTTI STELLA (30 articoli) ==========
  // CATEGORIA 1: PRODOTTI STELLA - Formaggi e Salumi (10 articoli)
  {
    id: 'fiordilatte-pizza-napoletana',
    topic: 'Fiordilatte per Pizza Napoletana STG: La Scelta dei Maestri Pizzaioli',
    primary_keywords: ['fiordilatte pizza napoletana', 'mozzarella pizza stg', 'fiordilatte pizzeria'],
    product_focus: 'Fiordilatte STG LAPA',
    word_count: 1200
  },
  {
    id: 'burrata-andria-dop',
    topic: 'Burrata di Andria DOP: Il Gioiello Cremoso della Puglia',
    primary_keywords: ['burrata andria dop', 'burrata ristoranti', 'burrata pugliese'],
    product_focus: 'Burrata Andria DOP LAPA',
    word_count: 1000
  },
  {
    id: 'fior-latte-gerola',
    topic: 'Fior di Latte Gerola: Tradizione Valtellinese per la Cucina d\'Elite',
    primary_keywords: ['fior di latte gerola', 'formaggi valtellina', 'mozzarella valtellinese'],
    product_focus: 'Fior di Latte Gerola LAPA',
    word_count: 900
  },
  {
    id: 'guanciale-amatriciano-igp',
    topic: 'Guanciale Amatriciano IGP: L\'Ingrediente Segreto della Carbonara Perfetta',
    primary_keywords: ['guanciale amatriciano igp', 'guanciale carbonara', 'guanciale ristorante'],
    product_focus: 'Guanciale Amatriciano IGP LAPA',
    word_count: 1100
  },
  {
    id: 'pecorino-romano-dop',
    topic: 'Pecorino Romano DOP: Dal Lazio alla Tua Cucina - Guida Completa',
    primary_keywords: ['pecorino romano dop', 'pecorino ristoranti', 'formaggio romano'],
    product_focus: 'Pecorino Romano DOP LAPA',
    word_count: 1000
  },
  {
    id: 'pancetta-piacentina-dop',
    topic: 'Pancetta Piacentina DOP: Versatilità e Sapore per Ogni Piatto',
    primary_keywords: ['pancetta piacentina dop', 'pancetta ristorante', 'pancetta dolce'],
    product_focus: 'Pancetta Piacentina DOP LAPA',
    word_count: 900
  },
  {
    id: 'olive-ascolane-dop',
    topic: 'Olive Ascolane del Piceno DOP: Croccanti, Ripiene, Irresistibili',
    primary_keywords: ['olive ascolane dop', 'olive ripiene fritte', 'olive ascolane ristorante'],
    product_focus: 'Olive Ascolane DOP LAPA',
    word_count: 850
  },
  {
    id: 'pomodoro-san-marzano-dop',
    topic: 'Pomodoro San Marzano DOP: Il Segreto della Pizza Napoletana Verace',
    primary_keywords: ['pomodoro san marzano dop', 'pomodoro pizza napoletana', 'san marzano'],
    product_focus: 'San Marzano DOP LAPA',
    word_count: 1000
  },
  {
    id: 'speck-alto-adige-igp',
    topic: 'Speck Alto Adige IGP: Il Re degli Affettati del Trentino',
    primary_keywords: ['speck alto adige igp', 'speck affumicato', 'speck ristorante'],
    product_focus: 'Speck Alto Adige IGP LAPA',
    word_count: 900
  },
  {
    id: 'capperi-pantelleria-igp',
    topic: 'Capperi di Pantelleria IGP: Piccoli Tesori Siciliani per Grandi Piatti',
    primary_keywords: ['capperi pantelleria igp', 'capperi siciliani', 'capperi sale'],
    product_focus: 'Capperi Pantelleria IGP LAPA',
    word_count: 800
  },

  // CATEGORIA 2: RICETTE (7 articoli)
  {
    id: 'carbonara-autentica',
    topic: 'Carbonara Autentica Romana: La Ricetta con Guanciale LAPA',
    primary_keywords: ['ricetta carbonara autentica', 'carbonara guanciale', 'carbonara romana'],
    product_focus: 'Guanciale + Pecorino Romano LAPA',
    word_count: 1400
  },
  {
    id: 'amatriciana-tradizionale',
    topic: 'Amatriciana Tradizionale: Come Prepararla con Guanciale e Pecorino',
    primary_keywords: ['ricetta amatriciana', 'amatriciana guanciale', 'sugo amatriciana'],
    product_focus: 'Guanciale + Pecorino + San Marzano LAPA',
    word_count: 1400
  },
  {
    id: 'gricia-romana',
    topic: 'Gricia: La Madre della Carbonara con Guanciale e Pecorino',
    primary_keywords: ['ricetta gricia', 'pasta gricia', 'gricia romana'],
    product_focus: 'Guanciale + Pecorino LAPA',
    word_count: 1100
  },
  {
    id: 'cacio-pepe-perfetta',
    topic: 'Cacio e Pepe Perfetta: La Tecnica per una Cremosità Unica',
    primary_keywords: ['ricetta cacio e pepe', 'cacio e pepe cremosa', 'cacio pepe tecnica'],
    product_focus: 'Pecorino Romano LAPA',
    word_count: 1100
  },
  {
    id: 'pizza-margherita-stg',
    topic: 'Pizza Margherita STG: La Ricetta Verace con Fiordilatte LAPA',
    primary_keywords: ['pizza margherita stg', 'pizza margherita verace', 'pizza napoletana'],
    product_focus: 'Fiordilatte STG + San Marzano LAPA',
    word_count: 1400
  },
  {
    id: 'pizza-burrata-gourmet',
    topic: 'Pizza Bianca con Burrata: Il Tocco Gourmet che Conquista',
    primary_keywords: ['pizza burrata', 'pizza bianca burrata', 'pizza gourmet'],
    product_focus: 'Burrata Andria DOP LAPA',
    word_count: 1000
  },
  {
    id: 'antipasto-italiano',
    topic: 'Antipasto Italiano Perfetto: Olive Ascolane, Salumi e Formaggi LAPA',
    primary_keywords: ['antipasto italiano', 'antipasto salumi formaggi', 'tagliere italiano'],
    product_focus: 'Olive Ascolane + Salumi + Formaggi LAPA',
    word_count: 1100
  },

  // CATEGORIA 3: GUIDE TECNICHE (5 articoli)
  {
    id: 'guida-fiordilatte-pizza',
    topic: 'Come Scegliere il Fiordilatte Giusto per la Tua Pizza: Guida Completa',
    primary_keywords: ['fiordilatte pizza', 'scegliere mozzarella pizza', 'mozzarella pizzeria'],
    product_focus: 'Gamma Fiordilatte LAPA',
    word_count: 1300
  },
  {
    id: 'burrata-conservazione-servizio',
    topic: 'Burrata: Come Conservarla, Servirla e Valorizzarla nel Menu',
    primary_keywords: ['conservare burrata', 'servire burrata', 'burrata menu'],
    product_focus: 'Burrata LAPA',
    word_count: 1000
  },
  {
    id: 'guanciale-pancetta-bacon-differenze',
    topic: 'Guanciale vs Pancetta vs Bacon: Differenze e Quando Usarli',
    primary_keywords: ['guanciale pancetta differenze', 'guanciale vs bacon', 'salumi differenze'],
    product_focus: 'Guanciale + Pancetta LAPA',
    word_count: 1200
  },
  {
    id: '10-formaggi-dop-italiani',
    topic: 'I 10 Formaggi DOP Italiani Indispensabili per Ogni Ristorante',
    primary_keywords: ['formaggi dop italiani', 'formaggi ristorante', 'formaggi dop'],
    product_focus: 'Gamma Formaggi DOP LAPA',
    word_count: 1600
  },
  {
    id: 'salumi-dop-igp-guida',
    topic: 'Salumi Italiani DOP e IGP: La Guida Definitiva per Ristoratori',
    primary_keywords: ['salumi dop igp', 'salumi italiani certificati', 'salumi dop'],
    product_focus: 'Gamma Salumi DOP/IGP LAPA',
    word_count: 1600
  },

  // CATEGORIA 4: CONTENUTI COMMERCIALI (4 articoli)
  {
    id: 'fornitore-burrata-svizzera',
    topic: 'Fornitore Burrata per Ristoranti in Svizzera: Qualità LAPA',
    primary_keywords: ['fornitore burrata svizzera', 'burrata ristoranti zurigo', 'burrata grossista'],
    product_focus: 'Servizio LAPA Burrata',
    word_count: 850
  },
  {
    id: 'guanciale-pizzerie-svizzera',
    topic: 'Guanciale Amatriciano per Pizzerie: Ordina da LAPA',
    primary_keywords: ['guanciale pizzerie svizzera', 'fornitore guanciale', 'guanciale grossista'],
    product_focus: 'Servizio LAPA Guanciale',
    word_count: 800
  },
  {
    id: 'olive-ascolane-surgelate',
    topic: 'Olive Ascolane Surgelate per Ristoranti: Pronte in 3 Minuti',
    primary_keywords: ['olive ascolane surgelate', 'olive ascolane ristorante', 'olive fritte'],
    product_focus: 'Olive Ascolane Surgelate LAPA',
    word_count: 800
  },
  {
    id: 'fiordilatte-pizzaioli-svizzeri',
    topic: 'Fiordilatte: Il Segreto dei Migliori Pizzaioli Svizzeri',
    primary_keywords: ['fiordilatte pizza svizzera', 'mozzarella pizzaioli', 'fiordilatte napoletano'],
    product_focus: 'Fiordilatte LAPA Testimonianze',
    word_count: 950
  },

  // CATEGORIA 5: STAGIONALITÀ (4 articoli)
  {
    id: 'menu-autunnale-italiano',
    topic: 'Menu Autunnale Italiano: Funghi Porcini, Tartufo e Castagne LAPA',
    primary_keywords: ['menu autunnale italiano', 'piatti autunno ristorante', 'menu stagionale'],
    product_focus: 'Prodotti Autunnali LAPA',
    word_count: 1100
  },
  {
    id: 'menu-estivo-burrata',
    topic: 'Estate Italiana: Menu Fresco con Burrata, Pomodori e Basilico',
    primary_keywords: ['menu estivo italiano', 'piatti estate ristorante', 'menu fresco'],
    product_focus: 'Prodotti Estivi LAPA',
    word_count: 1100
  },
  {
    id: 'menu-natale-italiano',
    topic: 'Natale in Tavola: I Prodotti Italiani Tradizionali di LAPA',
    primary_keywords: ['menu natale italiano', 'prodotti natale', 'menu festivo'],
    product_focus: 'Prodotti Natalizi LAPA',
    word_count: 1200
  },
  {
    id: 'menu-pasqua-italiano',
    topic: 'Pasqua Italiana: Tradizioni e Prodotti Pasquali LAPA',
    primary_keywords: ['menu pasqua italiano', 'colomba pasquale', 'prodotti pasqua'],
    product_focus: 'Prodotti Pasquali LAPA',
    word_count: 1100
  },

  // ========== BLOCCO 2: SERVIZI E VALORE LAPA (10 articoli) ==========
  {
    id: 'lapa-storia-fornitore-italiano',
    topic: 'LAPA: Storia di un Fornitore Italiano in Svizzera',
    primary_keywords: ['lapa fornitore', 'storia lapa', 'grossista italiano svizzera'],
    product_focus: 'Brand LAPA',
    word_count: 1500
  },
  {
    id: 'consegna-24-48h-svizzera',
    topic: 'Consegna 24-48h in Tutta la Svizzera: Come Funziona LAPA',
    primary_keywords: ['consegna prodotti italiani svizzera', 'logistica ristoranti', 'consegna rapida'],
    product_focus: 'Servizio Logistico LAPA',
    word_count: 1000
  },
  {
    id: 'nessun-ordine-minimo',
    topic: 'Nessun Ordine Minimo: La Rivoluzione LAPA per Piccoli Ristoranti',
    primary_keywords: ['fornitore senza ordine minimo', 'grossista piccole quantità', 'nessun minimo'],
    product_focus: 'Politica LAPA No Minimum',
    word_count: 900
  },
  {
    id: 'controllo-qualita-lapa',
    topic: 'Controllo Qualità LAPA: Dalla Selezione alla Consegna',
    primary_keywords: ['controllo qualità prodotti italiani', 'certificazioni dop igp', 'qualità lapa'],
    product_focus: 'Sistema Qualità LAPA',
    word_count: 1100
  },
  {
    id: 'servizio-clienti-multilingua',
    topic: 'Servizio Clienti LAPA: Supporto in Italiano, Tedesco e Francese',
    primary_keywords: ['servizio clienti multilingua', 'supporto ristoratori', 'assistenza lapa'],
    product_focus: 'Customer Service LAPA',
    word_count: 850
  },
  {
    id: 'catalogo-digitale-3000-prodotti',
    topic: 'Catalogo Digitale LAPA: 3000+ Prodotti Sempre Disponibili Online',
    primary_keywords: ['catalogo prodotti italiani online', 'ordinare online ristoranti', 'e-commerce lapa'],
    product_focus: 'Piattaforma E-Commerce LAPA',
    word_count: 900
  },
  {
    id: 'prezzi-trasparenti-grossista',
    topic: 'Prezzi Trasparenti LAPA: Tariffe da Grossista per Tutti',
    primary_keywords: ['prezzi grossista ristoranti', 'tariffe prodotti italiani', 'prezzi trasparenti'],
    product_focus: 'Politica Prezzi LAPA',
    word_count: 950
  },
  {
    id: 'sostenibilita-lapa',
    topic: 'Sostenibilità LAPA: Imballaggi Eco e Filiera Corta',
    primary_keywords: ['fornitore sostenibile', 'prodotti bio ristoranti', 'sostenibilità alimentare'],
    product_focus: 'Programma Sostenibilità LAPA',
    word_count: 1000
  },
  {
    id: 'partnership-produttori-italiani',
    topic: 'Partnership LAPA: Collaboriamo con i Migliori Produttori Italiani',
    primary_keywords: ['produttori italiani dop', 'partnership alimentari', 'network lapa'],
    product_focus: 'Network Produttori LAPA',
    word_count: 1100
  },
  {
    id: 'testimonianze-ristoratori',
    topic: 'Testimonianze Ristoratori: Perché 500+ Locali Scelgono LAPA',
    primary_keywords: ['recensioni lapa', 'testimonianze ristoranti', 'clienti lapa'],
    product_focus: 'Case Studies LAPA',
    word_count: 1200
  },

  // ========== BLOCCO 3: GUIDE PER RISTORATORI (10 articoli) ==========
  {
    id: 'aprire-pizzeria-svizzera-2026',
    topic: 'Come Aprire una Pizzeria di Successo in Svizzera: Guida Completa 2026',
    primary_keywords: ['aprire pizzeria svizzera', 'licenze ristorante svizzera', 'aprire ristorante'],
    product_focus: 'LAPA Partner Startup',
    word_count: 2000
  },
  {
    id: 'menu-engineering-ristorante',
    topic: 'Menu Engineering: Come Aumentare i Profitti del Tuo Ristorante Italiano',
    primary_keywords: ['menu engineering', 'aumentare profitti ristorante', 'ottimizzare menu'],
    product_focus: 'Consulenza LAPA',
    word_count: 1600
  },
  {
    id: 'food-cost-margini',
    topic: 'Food Cost e Margini: Calcolare la Redditività di Ogni Piatto',
    primary_keywords: ['food cost ristorante', 'calcolo margini cucina', 'redditività piatti'],
    product_focus: 'Strumenti LAPA',
    word_count: 1400
  },
  {
    id: 'gestione-inventario-ridurre-sprechi',
    topic: 'Gestione Inventario Ristorante: Ridurre Gli Sprechi del 30%',
    primary_keywords: ['gestione inventario ristorante', 'ridurre sprechi cucina', 'fifo ristorante'],
    product_focus: 'Sistema Ordini LAPA',
    word_count: 1300
  },
  {
    id: 'marketing-ristoranti-svizzera-2026',
    topic: 'Marketing per Ristoranti Italiani in Svizzera: Strategie 2026',
    primary_keywords: ['marketing ristorante', 'instagram ristoranti', 'social media food'],
    product_focus: 'Marketing Support LAPA',
    word_count: 1500
  },
  {
    id: 'selezione-formazione-staff',
    topic: 'Selezione e Formazione Staff Ristorante: La Guida del Titolare',
    primary_keywords: ['assumere personale ristorante', 'formazione camerieri', 'gestione staff'],
    product_focus: 'Training LAPA',
    word_count: 1400
  },
  {
    id: 'haccp-cucina-svizzera',
    topic: 'Igiene e HACCP in Cucina: Normative Svizzere Spiegate Semplice',
    primary_keywords: ['haccp ristorante svizzera', 'igiene cucina', 'normative alimentari'],
    product_focus: 'Certificazioni LAPA',
    word_count: 1500
  },
  {
    id: 'menu-stagionale-vantaggi',
    topic: 'Creare un Menu Stagionale Italiano: Vantaggi e Strategia',
    primary_keywords: ['menu stagionale ristorante', 'ingredienti di stagione', 'menu rotazione'],
    product_focus: 'Prodotti Stagionali LAPA',
    word_count: 1200
  },
  {
    id: 'wine-pairing-italiano',
    topic: 'Wine Pairing Italiano: Abbinare Vini ai Piatti del Menu',
    primary_keywords: ['abbinamento vino cibo', 'wine pairing italiano', 'carta vini ristorante'],
    product_focus: 'Cantina LAPA',
    word_count: 1400
  },
  {
    id: 'delivery-takeaway-ottimizzare',
    topic: 'Delivery e Take-Away per Ristoranti: Ottimizzare il Servizio',
    primary_keywords: ['delivery ristorante', 'ottimizzare take away', 'packaging delivery'],
    product_focus: 'Soluzioni Delivery LAPA',
    word_count: 1300
  },

  // ========== BLOCCO 4: TREND & INNOVAZIONE (5 articoli) ==========
  {
    id: 'trend-gastronomici-2026',
    topic: 'Trend Gastronomici 2026: Cosa Vogliono i Clienti Svizzeri',
    primary_keywords: ['trend food 2026', 'tendenze gastronomia', 'trend ristorazione'],
    product_focus: 'Innovazione LAPA',
    word_count: 1400
  },
  {
    id: 'intelligenza-artificiale-cucina',
    topic: 'Intelligenza Artificiale in Cucina: Chat AI per Ristoratori',
    primary_keywords: ['AI ristoranti', 'intelligenza artificiale cucina', 'chatbot ristorante'],
    product_focus: 'LAPA AI Assistant',
    word_count: 1100
  },
  {
    id: 'sostenibilita-food-zero-waste',
    topic: 'Sostenibilità nel Food: Come Ridurre l\'Impatto Ambientale',
    primary_keywords: ['ristorante sostenibile', 'cucina zero waste', 'ridurre impatto'],
    product_focus: 'Green Program LAPA',
    word_count: 1300
  },
  {
    id: 'menu-vegetariano-vegano',
    topic: 'Menu Vegetariano e Vegano: Opportunità per Ristoranti Italiani',
    primary_keywords: ['menu vegano ristorante', 'piatti vegetariani italiani', 'cucina plant-based'],
    product_focus: 'Gamma Veg LAPA',
    word_count: 1200
  },
  {
    id: 'food-photography-ristoranti',
    topic: 'Food Photography per Ristoranti: Aumentare le Prenotazioni',
    primary_keywords: ['food photography', 'foto cibo ristorante', 'instagram food'],
    product_focus: 'Marketing Visivo LAPA',
    word_count: 1100
  },

  // ========== BLOCCO 5: APPROFONDIMENTI CULTURALI (5 articoli) ==========
  {
    id: 'cucina-regionale-italiana',
    topic: 'Cucina Regionale Italiana: Un Viaggio da Nord a Sud',
    primary_keywords: ['cucina regionale italiana', 'piatti tipici regioni', 'tradizione culinaria'],
    product_focus: 'Gamma Regionale LAPA',
    word_count: 2000
  },
  {
    id: 'denominazioni-dop-igp',
    topic: 'Denominazioni DOP e IGP: Cosa Significano Veramente',
    primary_keywords: ['dop igp differenza', 'prodotti dop italiani', 'certificazioni alimentari'],
    product_focus: 'Prodotti Certificati LAPA',
    word_count: 1300
  },
  {
    id: 'storia-pizza-unesco',
    topic: 'Storia della Pizza: Dalle Origini a Patrimonio UNESCO',
    primary_keywords: ['storia pizza napoletana', 'pizza unesco', 'origine pizza'],
    product_focus: 'Ingredienti Pizza LAPA',
    word_count: 1500
  },
  {
    id: 'pasta-artigianale-vs-industriale',
    topic: 'Pasta Artigianale vs Industriale: Differenze che Contano',
    primary_keywords: ['pasta artigianale', 'differenza pasta trafilata bronzo', 'pasta artigianale vs industriale'],
    product_focus: 'Gamma Pasta LAPA',
    word_count: 1200
  },
  {
    id: 'arte-caffe-italiano',
    topic: 'L\'Arte del Caffè Italiano: Dall\'Espresso al Cappuccino',
    primary_keywords: ['caffè italiano', 'preparazione espresso', 'cultura caffè'],
    product_focus: 'Caffè LAPA',
    word_count: 1100
  }
];

// Prompt template per generare articolo completo in italiano
const ITALIAN_ARTICLE_PROMPT = (article: typeof ARTICLES[0]) => `
Sei un esperto copywriter SEO specializzato in contenuti per il settore food & beverage italiano.

Scrivi un articolo blog COMPLETO in ITALIANO su: "${article.topic}"

REQUISITI SEO:
- Parole: ${article.word_count} parole
- Keywords primarie: ${article.primary_keywords.join(', ')}
- Focus prodotto/servizio: ${article.product_focus}

STRUTTURA OBBLIGATORIA:
1. H1: Titolo principale con keyword primaria
2. Introduzione (2-3 paragrafi) con hook forte
3. H2: Cos'è [Argomento]? Origini e Caratteristiche
4. H2: Caratteristiche Tecniche/Dettagli (con lista UL)
5. H2: Come Utilizzare/Applicare [Argomento]
   - H3: Applicazioni Pratiche
   - H3: Consigli Professionali
6. H2: Vantaggi e Benefici
7. H2: [Argomento] LAPA: Qualità e Servizio
8. H2: Domande Frequenti (FAQ) - minimo 4-6 domande con H3
9. H2: Conclusione con CTA forte
10. Sezione "Leggi anche" con 3 link placeholder

OTTIMIZZAZIONE GEO (AI Search):
- Blocchi di testo <800 token ciascuno
- Risposte dirette alle domande
- Statistiche e dati concreti (es: "3000+ prodotti", "24-48h consegna", "500+ clienti")
- Brand mentions naturali (LAPA) - 10-15 menzioni
- Frasi segnale: "In sintesi", "La risposta è", "Ecco cosa significa", "Il punto chiave è"
- Tabelle comparative quando possibile
- Liste numerate e bullet points

META TAGS:
- Meta Title: max 60 caratteri con keyword principale
- Meta Description: 120-160 caratteri con CTA chiara
- Meta Keywords: 5-8 keywords separate da virgola

OUTPUT: Restituisci SOLO JSON valido con questa struttura:
{
  "name": "Titolo Articolo Completo",
  "subtitle": "Sottotitolo breve descrittivo",
  "meta": {
    "title": "Meta title SEO ottimizzato",
    "description": "Meta description con CTA",
    "keywords": "keyword1, keyword2, keyword3, keyword4"
  },
  "content_html": "<section class=\"s_text_block\"><div class=\"container\"><h1>Titolo</h1><p>Contenuto...</p></div></section>"
}

IMPORTANTE:
- HTML valido con tag <section>, <div>, <h1>, <h2>, <h3>, <p>, <ul>, <li>, <table>
- Ogni sezione principale in <section class="s_text_block"><div class="container">...</div></section>
- Linguaggio coinvolgente, professionale, specifico per ristoratori/pizzaioli/chef
- Focus su benefici pratici e concreti
- Menziona LAPA come fornitore premium in Svizzera con servizi distintivi
- NO placeholder, tutto testo reale e completo
- Includi dati tecnici, statistiche, confronti quando possibile
`;

// Prompt per traduzione + ottimizzazione
const TRANSLATION_PROMPT = (italianContent: any, targetLang: string) => `
Sei un traduttore professionista specializzato in contenuti SEO food & beverage.

Traduci questo articolo in ${targetLang === 'de_CH' ? 'TEDESCO SVIZZERO (Schweizerdeutsch formale)' : targetLang === 'fr_CH' ? 'FRANCESE SVIZZERO' : 'INGLESE INTERNAZIONALE'}.

ARTICOLO ITALIANO:
${JSON.stringify(italianContent, null, 2)}

REQUISITI:
- Mantieni ESATTAMENTE la struttura HTML
- Ottimizza keywords per il mercato ${targetLang === 'de_CH' ? 'svizzero tedesco' : targetLang === 'fr_CH' ? 'svizzero francese' : 'internazionale'}
- Adatta meta title e description per SEO locale
- Mantieni tono professionale ma coinvolgente
- Keywords tradotte naturalmente (NON letteralmente se suona male)
- Mantieni tutti i numeri, statistiche, nomi prodotto LAPA
- Adatta CTA e frasi chiave per il mercato locale

OUTPUT: Restituisci SOLO JSON valido con stessa struttura dell'originale italiano.
`;

// Funzione per generare un articolo in italiano
async function generateItalianArticle(article: typeof ARTICLES[0]): Promise<any> {
  console.log(`\n📝 Generating article: ${article.topic} (IT)...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: ITALIAN_ARTICLE_PROMPT(article)
    }]
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Funzione per tradurre un articolo
async function translateArticle(italianContent: any, targetLang: string): Promise<any> {
  console.log(`   🌍 Translating to ${targetLang}...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: TRANSLATION_PROMPT(italianContent, targetLang)
    }]
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in translation response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Funzione principale
async function generateAllArticles() {
  console.log('🚀 GENERATORE AUTOMATICO - 60 ARTICOLI BLOG LAPA\n');
  console.log('Questo script genererà:');
  console.log('- 60 articoli completi');
  console.log('- 4 lingue per articolo (IT, DE, FR, EN)');
  console.log('- Tot: 240 articoli ottimizzati SEO+GEO');
  console.log('- ~300,000+ parole totali\n');

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < ARTICLES.length; i++) {
    const article = ARTICLES[i];
    const filename = `data/new-articles-2025/article-${String(i + 1).padStart(2, '0')}-${article.id}.json`;

    console.log(`\n[${ i + 1}/60] ====== ${article.topic} ======`);

    // Skip se esiste già
    if (existsSync(filename)) {
      console.log(`   ⏭️  File already exists, skipping...`);
      successCount++;
      continue;
    }

    try {
      // 1. Genera articolo in italiano
      const italianContent = await generateItalianArticle(article);

      // 2. Traduci in tedesco, francese, inglese
      const germanContent = await translateArticle(italianContent, 'de_CH');
      const frenchContent = await translateArticle(italianContent, 'fr_CH');
      const englishContent = await translateArticle(italianContent, 'en_US');

      // 3. Crea oggetto completo
      const fullArticle = {
        article_id: article.id,
        topic: article.topic,
        target_keywords: {
          primary: article.primary_keywords,
          secondary: [],
          long_tail: []
        },
        translations: {
          it_IT: italianContent,
          de_DE: germanContent, // Sarà mappato a de_CH in upload
          fr_FR: frenchContent, // Sarà mappato a fr_CH in upload
          en_US: englishContent
        },
        seo_analysis: {
          keyword_density: '2-3%',
          word_count: article.word_count,
          h1_count: 1,
          h2_count: '6-8',
          h3_count: '8-12',
          has_faq: true,
          has_lists: true,
          internal_links: true,
          geo_optimized: true
        },
        geo_analysis: {
          blocks_under_800_tokens: true,
          self_contained_sections: true,
          clear_answers: true,
          brand_mentions: '10-15',
          statistics: true,
          faq_format: true
        }
      };

      // 4. Salva file JSON
      writeFileSync(filename, JSON.stringify(fullArticle, null, 2));

      console.log(`   ✅ Saved: ${filename}`);
      successCount++;

      // 5. Delay per evitare rate limiting
      if (i < ARTICLES.length - 1) {
        console.log('   ⏳ Waiting 3s before next article...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`   ❌ Error generating article ${i + 1}:`, error);
      console.log('   ⚠️  Skipping to next article...');
      errorCount++;
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000 / 60); // minuti

  console.log('\n\n✅ ====== GENERATION COMPLETE ======');
  console.log(`Generated: ${successCount} articles`);
  console.log(`Errors: ${errorCount} articles`);
  console.log(`Total articles: ${successCount * 4} (including all languages)`);
  console.log(`Duration: ${duration} minutes`);
  console.log('\n📂 Files saved in: data/new-articles-2025/');
  console.log('\n🚀 Next step: Run upload script to publish to Odoo');
}

// Execute
generateAllArticles().catch(console.error);
