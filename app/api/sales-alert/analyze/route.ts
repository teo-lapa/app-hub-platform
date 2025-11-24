import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * API: AI Analysis of customer sales decline
 *
 * Uses Claude to analyze customer data and provide insights
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      variationPercent,
      wasWeeklyRevenue,
      nowWeeklyRevenue,
      daysSinceLastOrder,
      lostProducts,
      historicalRevenue,
      recentRevenue
    } = body;

    if (!customerName) {
      return NextResponse.json({
        success: false,
        error: 'Dati cliente richiesti'
      }, { status: 400 });
    }

    // Build context for AI analysis
    const lostProductsList = (lostProducts || [])
      .map((p: any) => `- ${p.productName}: media ${p.avgQtyPerWeek} pz/sett, ultima settimana W${p.lastWeekBought}, perdita stimata CHF ${p.estimatedLoss}`)
      .join('\n');

    const prompt = `Sei un esperto analista di vendite per LAPA, un distributore di prodotti alimentari italiani in Svizzera. Analizza questa situazione di un cliente in calo e fornisci insights utili.

DATI CLIENTE:
- Nome: ${customerName}
- Variazione vendite: ${variationPercent}%
- Fatturato settimanale prima: CHF ${wasWeeklyRevenue}
- Fatturato settimanale ora: CHF ${nowWeeklyRevenue}
- Giorni dall'ultimo ordine: ${daysSinceLastOrder}
- Fatturato storico (4 sett): CHF ${historicalRevenue || 'N/A'}
- Fatturato recente (3 sett): CHF ${recentRevenue || 'N/A'}

PRODOTTI PERSI (non comprati nelle ultime 2 settimane):
${lostProductsList || 'Nessun prodotto specifico perso'}

Fornisci un'analisi strutturata con:

1. **DIAGNOSI** (2-3 frasi): Cosa sta succedendo con questo cliente?

2. **POSSIBILI CAUSE** (lista di 3-4 punti):
   - Considera stagionalità, concorrenza, problemi di qualità, cambio menu, problemi economici

3. **AZIONI SUGGERITE** (lista di 2-3 azioni concrete):
   - Cosa dovrebbe fare il venditore? Chiamare? Proporre promozioni? Visitare?

4. **URGENZA**: Bassa / Media / Alta / Critica

5. **SCRIPT CHIAMATA** (2-3 frasi suggerite per iniziare la conversazione telefonica)

Rispondi in italiano, in modo conciso e pratico per un venditore.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const analysis = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({
      success: true,
      analysis,
      model: 'claude-sonnet-4-20250514'
    });

  } catch (error: any) {
    console.error('Error in AI analysis:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
