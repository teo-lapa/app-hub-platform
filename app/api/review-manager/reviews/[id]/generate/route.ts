import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;

    // Carica la recensione
    const reviewResult = await sql`
      SELECT r.*, b.name as business_name, b.response_tone, b.response_language
      FROM rm_reviews r
      JOIN rm_businesses b ON r.business_id = b.id
      WHERE r.id = ${reviewId}
    `;

    if (reviewResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Recensione non trovata'
      }, { status: 404 });
    }

    const review = reviewResult.rows[0];

    // Genera la risposta con Claude
    const toneInstructions = {
      friendly: 'amichevole e caloroso, come un amico',
      professional: 'professionale ma cordiale',
      elegant: 'elegante e sofisticato',
      casual: 'casual e informale'
    };

    const tone = toneInstructions[review.response_tone as keyof typeof toneInstructions] || toneInstructions.friendly;
    const language = review.response_language || 'italiano';

    const prompt = `Sei il proprietario del ristorante "${review.business_name}".

Un cliente ha lasciato questa recensione:
- Nome: ${review.reviewer_name}
- Rating: ${review.rating ? `${review.rating}/5 stelle` : 'N/A'}
- Piattaforma: ${review.platform}
- Testo: "${review.content}"

Scrivi una risposta in ${language} con tono ${tone}.

Regole:
- Ringrazia sempre il cliente per nome
- Se è positiva: mostra gratitudine genuina
- Se è negativa: scusati sinceramente, offri di rimediare
- Massimo 3-4 frasi, conciso ma personale
- NON usare frasi fatte o troppo generiche
- Firma come "Il team di ${review.business_name}"

Scrivi SOLO la risposta, senza introduzioni o spiegazioni.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const aiResponse = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : '';

    // Analizza sentiment
    let sentiment = 'neutral';
    if (review.rating) {
      if (review.rating >= 4) sentiment = 'positive';
      else if (review.rating <= 2) sentiment = 'negative';
    }

    // Salva la risposta
    await sql`
      UPDATE rm_reviews
      SET
        ai_suggested_response = ${aiResponse},
        sentiment_label = ${sentiment},
        response_status = 'ai_generated',
        updated_at = NOW()
      WHERE id = ${reviewId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        response: aiResponse,
        sentiment
      }
    });

  } catch (error) {
    console.error('Errore generazione risposta:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella generazione della risposta'
    }, { status: 500 });
  }
}
