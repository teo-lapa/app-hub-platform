import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/gemini/generate-menu
 *
 * Genera un menu strutturato usando Google Gemini (Nano Banana)
 * Supporta input multipli: testo, immagini (OCR), audio
 *
 * Body:
 * - textInput?: string - Testo del menu scritto dall'utente
 * - imageInput?: string - Base64 di foto del menu (per OCR)
 * - audioInput?: string - Base64 di audio da trascrivere (future)
 * - menuStyle?: string - Stile del menu (classico, moderno, elegante)
 * - restaurantName?: string - Nome del ristorante
 */
export async function POST(request: NextRequest) {
  try {
    const {
      textInput,
      imageInput,
      audioInput,
      menuStyle = 'classico',
      restaurantName = 'Il Mio Ristorante'
    } = await request.json();

    // Validazione: almeno un input deve essere presente
    if (!textInput && !imageInput && !audioInput) {
      return NextResponse.json(
        { error: 'Devi fornire almeno un input: testo, foto o audio' },
        { status: 400 }
      );
    }

    // Verifica API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ [GEMINI-MENU] API key non configurata');
      return NextResponse.json(
        { error: 'API key Gemini non configurata sul server' },
        { status: 500 }
      );
    }

    console.log('📋 [GEMINI-MENU] Generazione menu:', {
      hasText: !!textInput,
      hasImage: !!imageInput,
      hasAudio: !!audioInput,
      style: menuStyle,
      restaurant: restaurantName
    });

    // Inizializza client Gemini
    const ai = new GoogleGenAI({ apiKey });

    // Costruisci il prompt per strutturare il menu
    const systemPrompt = `Sei un esperto designer di menu per ristoranti in Svizzera.
Il tuo compito è analizzare le informazioni fornite e creare un menu strutturato in formato JSON.

Regole IMPORTANTI:
1. Organizza i piatti in categorie (Antipasti, Primi, Secondi, Contorni, Dessert, Bevande)
2. Per ogni piatto estrai: nome, descrizione, prezzo (se presente), allergeni (se menzionati)
3. I prezzi devono essere in FRANCHI SVIZZERI (CHF), non in Euro
4. Se vedi prezzi in Euro (€), convertili in CHF moltiplicando per ~1.05
5. Se mancano informazioni, usa la tua conoscenza culinaria per suggerire descrizioni appetitose
6. Mantieni lo stile ${menuStyle} richiesto
7. Rispondi SOLO con JSON valido, senza testo aggiuntivo

Formato JSON richiesto:
{
  "restaurantName": "${restaurantName}",
  "categories": [
    {
      "name": "Nome Categoria",
      "items": [
        {
          "name": "Nome Piatto",
          "description": "Descrizione appetitosa",
          "price": "18.50",
          "allergens": ["glutine", "lattosio"]
        }
      ]
    }
  ]
}

IMPORTANTE: I prezzi nel JSON devono essere SOLO NUMERI senza simboli di valuta (es: "18.50" non "CHF 18.50")`;

    // Prepara il contenuto per Gemini
    const contents: any[] = [];
    const userParts: any[] = [];

    // Se c'è un'immagine (foto del menu), aggiungila per OCR
    if (imageInput) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      userParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
      userParts.push({
        text: 'Questa è una foto del menu. Estraimi tutti i piatti, prezzi e descrizioni che vedi.'
      });
    }

    // Se c'è testo, aggiungilo
    if (textInput) {
      userParts.push({
        text: `Ecco il contenuto del menu:\n${textInput}`
      });
    }

    // Aggiungi il prompt di sistema
    userParts.push({
      text: systemPrompt
    });

    contents.push({
      role: 'user',
      parts: userParts
    });

    // Genera il menu strutturato con Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents
    });

    // Estrai il testo della risposta
    const generatedText = response.text || '';

    if (!generatedText) {
      console.error('❌ [GEMINI-MENU] Nessun testo generato');
      return NextResponse.json(
        { error: 'Gemini non ha generato un menu. Riprova.' },
        { status: 500 }
      );
    }

    console.log('📋 [GEMINI-MENU] Testo generato:', generatedText.substring(0, 200));

    // Estrai JSON dalla risposta (rimuovi markdown code blocks se presenti)
    let menuData;
    try {
      const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) ||
                       generatedText.match(/```\n([\s\S]*?)\n```/);

      const jsonString = jsonMatch ? jsonMatch[1] : generatedText;
      menuData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ [GEMINI-MENU] Errore parsing JSON:', parseError);
      console.error('Testo ricevuto:', generatedText);
      return NextResponse.json(
        {
          error: 'Errore nel formato del menu generato',
          details: 'Il formato della risposta non è valido'
        },
        { status: 500 }
      );
    }

    console.log('✅ [GEMINI-MENU] Menu strutturato con successo');

    return NextResponse.json({
      success: true,
      menu: menuData,
      style: menuStyle
    });

  } catch (error: any) {
    console.error('❌ [GEMINI-MENU] Errore:', error);

    let errorMessage = 'Errore durante la generazione del menu';

    if (error.message?.includes('API key')) {
      errorMessage = 'Chiave API Gemini non valida';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'Quota API Gemini esaurita';
    } else if (error.message?.includes('safety')) {
      errorMessage = 'Il contenuto è stato bloccato dai filtri di sicurezza';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message
      },
      { status: 500 }
    );
  }
}
