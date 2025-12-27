/**
 * LAPA AI AGENTS - Chat API
 *
 * Endpoint per comunicare con gli agenti LAPA AI
 * Riceve messaggi dal chatbot e li smista agli agenti appropriati
 * Usa l'orchestratore per routing intelligente basato su Claude AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/lapa-agents/orchestrator';
import { getOdooClient } from '@/lib/odoo-client';
import { recordRequest, recordEscalation } from '@/lib/lapa-agents/stats';

// Tipi
interface ChatRequest {
  message: string;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  sessionId: string;
  language?: string;
}

// Flag per usare orchestratore AI vs fallback semplice
const USE_AI_ORCHESTRATOR = process.env.LAPA_AI_ENABLED !== 'false';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, customerType, customerId, customerName, customerEmail, sessionId, language = 'it' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`\n📨 LAPA AI Chat: "${message.substring(0, 100)}..."`);
    console.log(`   Customer: ${customerType}, customerId: ${customerId} (type: ${typeof customerId}), Session: ${sessionId}`);
    console.log('   Full body received:', JSON.stringify(body));

    const startTime = Date.now();

    // Se AI abilitata, usa l'orchestratore
    if (USE_AI_ORCHESTRATOR && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log('🔄 Inizializzazione Odoo client...');
        const odooClient = await getOdooClient();
        console.log('✅ Odoo client ottenuto');

        console.log('🔄 Inizializzazione orchestratore...');
        const orchestrator = getOrchestrator(odooClient);
        console.log('✅ Orchestratore ottenuto');

        console.log('🔄 Processamento messaggio...');
        const response = await orchestrator.processMessage(message, sessionId, {
          customerType,
          customerId,
          customerName,
          customerEmail,
          metadata: { language }
        });
        console.log('✅ Risposta ottenuta');

        const duration = Date.now() - startTime;
        console.log(`✅ AI Response generated in ${duration}ms by agent: ${response.agentId}`);

        // Registra statistiche
        recordRequest(response.agentId, duration, response.success !== false, sessionId);
        if (response.requiresHumanEscalation) {
          recordEscalation();
        }

        return NextResponse.json({
          ...response,
          metadata: {
            duration,
            timestamp: new Date().toISOString(),
            sessionId,
            aiEnabled: true
          }
        });
      } catch (aiError) {
        console.error('⚠️ AI Orchestrator error details:', {
          name: aiError instanceof Error ? aiError.name : 'Unknown',
          message: aiError instanceof Error ? aiError.message : String(aiError),
          stack: aiError instanceof Error ? aiError.stack : undefined
        });

        // Registra errore
        const errorDuration = Date.now() - startTime;
        recordRequest('error', errorDuration, false, sessionId);

        // Ritorna errore dettagliato invece di fallback silenzioso
        return NextResponse.json({
          success: false,
          message: `Errore AI: ${aiError instanceof Error ? aiError.message : 'Errore sconosciuto'}`,
          error: aiError instanceof Error ? aiError.message : String(aiError),
          agentId: 'error',
          metadata: {
            duration: errorDuration,
            timestamp: new Date().toISOString(),
            sessionId,
            aiEnabled: true,
            errorType: aiError instanceof Error ? aiError.name : 'Unknown'
          }
        }, { status: 500 });
      }
    }

    // Fallback: analisi intento semplice basata su keyword
    const intent = analyzeIntent(message.toLowerCase());
    const response = generateFallbackResponse(intent, message, customerType, language);

    const duration = Date.now() - startTime;
    console.log(`✅ Fallback response generated in ${duration}ms by agent: ${response.agentId}`);

    // Registra statistiche fallback
    recordRequest(response.agentId, duration, true, sessionId);

    return NextResponse.json({
      ...response,
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
        sessionId,
        aiEnabled: false
      }
    });

  } catch (error) {
    console.error('❌ LAPA AI Chat error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Genera risposta fallback quando AI non è disponibile
 */
function generateFallbackResponse(
  intent: string,
  message: string,
  customerType: string,
  language: string
) {
  switch (intent) {
    case 'order':
      return {
        success: true,
        message: getOrderResponse(message, customerType, language),
        agentId: 'orders',
        suggestedActions: ['Vedi storico ordini', 'Crea nuovo ordine', 'Contatta supporto']
      };

    case 'invoice':
      return {
        success: true,
        message: getInvoiceResponse(message, language),
        agentId: 'invoices',
        suggestedActions: ['Vedi fatture aperte', 'Scarica fattura', 'Paga online']
      };

    case 'shipping':
      return {
        success: true,
        message: getShippingResponse(message, language),
        agentId: 'shipping',
        suggestedActions: ['Traccia spedizione', 'Orario consegna', 'Contatta autista']
      };

    case 'product':
      return {
        success: true,
        message: getProductResponse(message, language),
        agentId: 'products',
        suggestedActions: ['Vedi catalogo', 'Controlla disponibilità', 'Vedi offerte']
      };

    case 'help':
      return {
        success: true,
        message: getHelpResponse(message, language),
        agentId: 'helpdesk',
        requiresHumanEscalation: true,
        suggestedActions: ['Crea ticket', 'Parla con operatore', 'FAQ']
      };

    default:
      return {
        success: true,
        message: getGenericResponse(language),
        agentId: 'orchestrator',
        suggestedActions: ['Ordini', 'Fatture', 'Spedizioni', 'Prodotti', 'Assistenza']
      };
  }
}

// Analizza l'intento del messaggio
function analyzeIntent(message: string): string {
  const orderKeywords = ['ordine', 'ordinare', 'comprare', 'acquistare', 'order', 'bestellen', 'commander'];
  const invoiceKeywords = ['fattura', 'fatture', 'pagare', 'pagamento', 'invoice', 'rechnung', 'facture'];
  const shippingKeywords = ['spedizione', 'consegna', 'tracking', 'dove', 'arriva', 'delivery', 'lieferung', 'livraison'];
  const productKeywords = ['prodotto', 'disponibile', 'prezzo', 'catalogo', 'product', 'produkt', 'produit', 'mozzarella', 'burrata', 'prosciutto'];
  const helpKeywords = ['aiuto', 'help', 'problema', 'supporto', 'operatore', 'umano', 'hilfe', 'aide'];

  if (orderKeywords.some(k => message.includes(k))) return 'order';
  if (invoiceKeywords.some(k => message.includes(k))) return 'invoice';
  if (shippingKeywords.some(k => message.includes(k))) return 'shipping';
  if (productKeywords.some(k => message.includes(k))) return 'product';
  if (helpKeywords.some(k => message.includes(k))) return 'help';

  return 'generic';
}

// Risposte per tipo
function getOrderResponse(message: string, customerType: string, lang: string): string {
  const responses: Record<string, string> = {
    it: customerType === 'b2b'
      ? '📦 Certo! Come cliente B2B puoi creare ordini direttamente. Vuoi vedere il tuo storico ordini o creare un nuovo ordine?'
      : '📦 Per effettuare un ordine, puoi navigare nel nostro catalogo online. Vuoi che ti aiuti a trovare un prodotto specifico?',
    de: customerType === 'b2b'
      ? '📦 Natürlich! Als B2B-Kunde können Sie Bestellungen direkt aufgeben. Möchten Sie Ihre Bestellhistorie sehen oder eine neue Bestellung erstellen?'
      : '📦 Um eine Bestellung aufzugeben, können Sie unseren Online-Katalog durchsuchen. Soll ich Ihnen helfen, ein bestimmtes Produkt zu finden?',
    fr: customerType === 'b2b'
      ? '📦 Bien sûr! En tant que client B2B, vous pouvez créer des commandes directement. Voulez-vous voir votre historique de commandes ou créer une nouvelle commande?'
      : '📦 Pour passer une commande, vous pouvez parcourir notre catalogue en ligne. Voulez-vous que je vous aide à trouver un produit spécifique?',
    en: customerType === 'b2b'
      ? '📦 Sure! As a B2B customer, you can create orders directly. Would you like to see your order history or create a new order?'
      : '📦 To place an order, you can browse our online catalog. Would you like me to help you find a specific product?'
  };
  return responses[lang] || responses['it'];
}

function getInvoiceResponse(message: string, lang: string): string {
  const responses: Record<string, string> = {
    it: '📄 Posso aiutarti con le tue fatture. Vuoi vedere le fatture aperte, lo storico dei pagamenti, o hai bisogno di un link per pagare online?',
    de: '📄 Ich kann Ihnen bei Ihren Rechnungen helfen. Möchten Sie offene Rechnungen sehen, die Zahlungshistorie, oder brauchen Sie einen Link zur Online-Zahlung?',
    fr: '📄 Je peux vous aider avec vos factures. Voulez-vous voir les factures ouvertes, l\'historique des paiements, ou avez-vous besoin d\'un lien pour payer en ligne?',
    en: '📄 I can help you with your invoices. Would you like to see open invoices, payment history, or do you need a link to pay online?'
  };
  return responses[lang] || responses['it'];
}

function getShippingResponse(message: string, lang: string): string {
  const responses: Record<string, string> = {
    it: '🚚 Posso tracciare le tue spedizioni! Dimmi il numero d\'ordine e ti darò lo stato aggiornato, l\'orario stimato di arrivo e le info sull\'autista.',
    de: '🚚 Ich kann Ihre Sendungen verfolgen! Nennen Sie mir die Bestellnummer und ich gebe Ihnen den aktuellen Status, die geschätzte Ankunftszeit und Informationen zum Fahrer.',
    fr: '🚚 Je peux suivre vos expéditions! Donnez-moi le numéro de commande et je vous donnerai le statut mis à jour, l\'heure d\'arrivée estimée et les informations sur le chauffeur.',
    en: '🚚 I can track your shipments! Tell me the order number and I\'ll give you the updated status, estimated arrival time, and driver info.'
  };
  return responses[lang] || responses['it'];
}

function getProductResponse(message: string, lang: string): string {
  const responses: Record<string, string> = {
    it: '🧀 Ottimo! Abbiamo un\'ampia selezione di prodotti italiani. Posso cercare disponibilità, prezzi e mostrarti le offerte del momento. Cosa stai cercando?',
    de: '🧀 Großartig! Wir haben eine große Auswahl an italienischen Produkten. Ich kann Verfügbarkeit, Preise prüfen und Ihnen aktuelle Angebote zeigen. Was suchen Sie?',
    fr: '🧀 Excellent! Nous avons une large sélection de produits italiens. Je peux vérifier la disponibilité, les prix et vous montrer les offres actuelles. Que cherchez-vous?',
    en: '🧀 Great! We have a wide selection of Italian products. I can check availability, prices and show you current offers. What are you looking for?'
  };
  return responses[lang] || responses['it'];
}

function getHelpResponse(message: string, lang: string): string {
  const responses: Record<string, string> = {
    it: '🎧 Capisco che hai bisogno di assistenza. Posso creare un ticket per te e un membro del nostro team ti contatterà al più presto. Vuoi procedere?',
    de: '🎧 Ich verstehe, dass Sie Hilfe benötigen. Ich kann ein Ticket für Sie erstellen und ein Teammitglied wird Sie so schnell wie möglich kontaktieren. Möchten Sie fortfahren?',
    fr: '🎧 Je comprends que vous avez besoin d\'aide. Je peux créer un ticket pour vous et un membre de notre équipe vous contactera dès que possible. Voulez-vous continuer?',
    en: '🎧 I understand you need assistance. I can create a ticket for you and a team member will contact you as soon as possible. Would you like to proceed?'
  };
  return responses[lang] || responses['it'];
}

function getGenericResponse(lang: string): string {
  const responses: Record<string, string> = {
    it: '👋 Ciao! Sono l\'assistente AI di LAPA. Posso aiutarti con:\n\n• 📦 Ordini - creare, modificare, stato\n• 📄 Fatture - visualizzare, pagare\n• 🚚 Spedizioni - tracking, ETA\n• 🧀 Prodotti - disponibilità, prezzi\n• 🎧 Supporto - assistenza dedicata\n\nCome posso aiutarti oggi?',
    de: '👋 Hallo! Ich bin der KI-Assistent von LAPA. Ich kann Ihnen helfen mit:\n\n• 📦 Bestellungen - erstellen, ändern, Status\n• 📄 Rechnungen - anzeigen, bezahlen\n• 🚚 Lieferungen - Tracking, ETA\n• 🧀 Produkte - Verfügbarkeit, Preise\n• 🎧 Support - dedizierte Unterstützung\n\nWie kann ich Ihnen heute helfen?',
    fr: '👋 Bonjour! Je suis l\'assistant IA de LAPA. Je peux vous aider avec:\n\n• 📦 Commandes - créer, modifier, statut\n• 📄 Factures - visualiser, payer\n• 🚚 Livraisons - suivi, ETA\n• 🧀 Produits - disponibilité, prix\n• 🎧 Support - assistance dédiée\n\nComment puis-je vous aider aujourd\'hui?',
    en: '👋 Hello! I\'m LAPA\'s AI assistant. I can help you with:\n\n• 📦 Orders - create, modify, status\n• 📄 Invoices - view, pay\n• 🚚 Shipping - tracking, ETA\n• 🧀 Products - availability, prices\n• 🎧 Support - dedicated assistance\n\nHow can I help you today?'
  };
  return responses[lang] || responses['it'];
}

// GET: Status degli agenti
export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: 'v5-detailed-error',  // Per verificare deploy
    agents: [
      { id: 'orchestrator', status: 'active' },
      { id: 'orders', status: 'active' },
      { id: 'invoices', status: 'active' },
      { id: 'shipping', status: 'active' },
      { id: 'products', status: 'active' },
      { id: 'helpdesk', status: 'active' }
    ],
    timestamp: new Date().toISOString()
  });
}
