/**
 * API per estrarre dati da un PDF di busta paga usando AI
 *
 * POST /api/hr-payslip/extract-pdf
 * Body: FormData con file PDF
 * Returns: { netAmount: number, auszahlung: number, pauschalspesen: number, rawResponse?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

function cleanAmount(value: string): number {
  const cleaned = value
    .replace(/[^\d.,'"-]/g, '')
    .replace(/'/g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📊 [HR-PAYSLIP] Extract PDF');

    if (!apiKey) {
      return NextResponse.json({ error: 'API key AI non configurata' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File PDF richiesto' }, { status: 400 });
    }

    // Converti file in base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Usa Gemini per estrarre AUSZAHLUNG (900) e Pauschalspesen (715)
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analizza questa busta paga svizzera (PDF) e trova ESATTAMENTE questi due importi:

1. **AUSZAHLUNG** (riga 900): L'importo finale pagato al dipendente. Può anche essere chiamato "Auszahlung", "A pagare", "Totale da pagare", "Net Pay", "Versamento". È l'ultimo importo grande in fondo alla busta paga.

2. **PAUSCHALSPESEN** (riga 715): Le spese forfettarie / indennità. Può anche essere chiamato "Pauschalspesen", "Spese forfettarie", "Pauschale", "Spesen". Se non presente, rispondi 0.

RISPONDI in questo formato ESATTO (solo numeri, un valore per riga):
AUSZAHLUNG: [numero]
PAUSCHALSPESEN: [numero]

Esempio corretto:
AUSZAHLUNG: 6116.13
PAUSCHALSPESEN: 101.03

Esempio se non c'è Pauschalspesen:
AUSZAHLUNG: 5234.50
PAUSCHALSPESEN: 0

IMPORTANTE: Gli importi sono in CHF. Non includere "CHF", apostrofi o altri caratteri. Usa il punto come separatore decimale.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64
              }
            }
          ]
        }
      ]
    });

    const responseText = result.text?.trim() || '';
    console.log('[Extract PDF] AI response:', responseText);

    if (!responseText) {
      return NextResponse.json({
        success: false,
        error: 'Non riesco a leggere il PDF'
      }, { status: 400 });
    }

    // Parse della risposta strutturata
    const auszahlungMatch = responseText.match(/AUSZAHLUNG:\s*([\d.,'-]+)/i);
    const pauschalspesenMatch = responseText.match(/PAUSCHALSPESEN:\s*([\d.,'-]+)/i);

    const auszahlung = auszahlungMatch ? cleanAmount(auszahlungMatch[1]) : 0;
    const pauschalspesen = pauschalspesenMatch ? cleanAmount(pauschalspesenMatch[1]) : 0;

    if (auszahlung === 0) {
      return NextResponse.json({
        success: false,
        error: `Non riesco a trovare l'importo AUSZAHLUNG nel PDF. Risposta AI: ${responseText}`
      }, { status: 400 });
    }

    // Il totale busta paga deve essere = AUSZAHLUNG (900)
    // PAUSCHALSPESEN è già incluso nella 900, va estratto come riga BONUS separata
    // NET = AUSZAHLUNG - PAUSCHALSPESEN (così NET + BONUS = AUSZAHLUNG)
    const netAmount = auszahlung - pauschalspesen;

    return NextResponse.json({
      success: true,
      auszahlung: auszahlung,
      pauschalspesen: pauschalspesen,
      netAmount: netAmount,
      rawResponse: responseText
    });

  } catch (error: any) {
    console.error('❌ [HR-PAYSLIP] Extract PDF Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
