/**
 * API per estrarre il netto da un PDF di busta paga usando AI
 *
 * POST /api/hr-payslip/extract-pdf
 * Body: FormData con file PDF
 * Returns: { netAmount: number, rawText?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

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

    // Usa Gemini per estrarre il netto
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analizza questa busta paga PDF e trova l'importo NETTO da pagare al dipendente.

ISTRUZIONI:
1. Cerca voci come "Netto", "Netto da pagare", "Totale netto", "Net Salary", "Salario netto", "A pagare"
2. L'importo netto è solitamente l'ultimo importo grande, quello che il dipendente riceve effettivamente
3. Ignora il lordo, le deduzioni, i contributi
4. L'importo è in CHF (Franchi Svizzeri)

RISPONDI SOLO con il numero (senza CHF, senza virgolette, senza testo):
Esempio corretto: 5234.50
Esempio sbagliato: CHF 5'234.50 o "5234.50"

Se non riesci a trovare il netto, rispondi: ERROR`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
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

    if (responseText === 'ERROR' || !responseText) {
      return NextResponse.json({
        success: false,
        error: 'Non riesco a estrarre il netto dal PDF'
      }, { status: 400 });
    }

    // Pulisci il numero
    const cleanNumber = responseText
      .replace(/[^\d.,]/g, '') // Rimuovi tutto tranne numeri, punto e virgola
      .replace(/'/g, '')       // Rimuovi apostrofi svizzeri (5'234)
      .replace(',', '.');      // Converti virgola in punto

    const netAmount = parseFloat(cleanNumber);

    if (isNaN(netAmount)) {
      return NextResponse.json({
        success: false,
        error: `Valore non valido: ${responseText}`
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      netAmount: netAmount,
      rawResponse: responseText
    });

  } catch (error: any) {
    console.error('❌ [HR-PAYSLIP] Extract PDF Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
