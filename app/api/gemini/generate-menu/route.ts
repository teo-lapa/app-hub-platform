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
      restaurantName = 'Il Mio Ristorante',
      menuLanguage = 'it'
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
      restaurant: restaurantName,
      language: menuLanguage
    });

    // Inizializza client Gemini
    const ai = new GoogleGenAI({ apiKey });

    // Map language codes to full names
    const languageMap: Record<string, string> = {
      'it': 'Italiano',
      'de': 'Tedesco',
      'fr': 'Francese',
      'en': 'Inglese'
    };

    const languageName = languageMap[menuLanguage] || 'Italiano';
    const languageInstructions = menuLanguage === 'it'
      ? 'Tutti i nomi, descrizioni e categorie devono essere in ITALIANO.'
      : menuLanguage === 'de'
      ? 'Tutti i nomi, descrizioni e categorie devono essere in TEDESCO (Deutsch).'
      : menuLanguage === 'fr'
      ? 'Tutti i nomi, descrizioni e categorie devono essere in FRANCESE (Français).'
      : 'Tutti i nomi, descrizioni e categorie devono essere in INGLESE (English).';

    // Costruisci il prompt per strutturare il menu
    const systemPrompt = `Sei un esperto designer di menu per ristoranti in Svizzera.
Il tuo compito è analizzare le informazioni fornite e creare un menu strutturato in formato JSON.

LINGUA DEL MENU: ${languageName}
${languageInstructions}

Regole IMPORTANTI:
1. Organizza i piatti in categorie appropriate per la lingua selezionata
   - IT: Antipasti, Primi, Secondi, Contorni, Dessert, Bevande
   - DE: Vorspeisen, Erste Gänge, Hauptgerichte, Beilagen, Desserts, Getränke
   - FR: Entrées, Premiers Plats, Plats Principaux, Accompagnements, Desserts, Boissons
   - EN: Appetizers, First Courses, Main Courses, Side Dishes, Desserts, Beverages

2. Per ogni piatto estrai: nome, descrizione, prezzo (se presente), allergeni (se menzionati)
3. I prezzi devono essere in FRANCHI SVIZZERI (CHF), non in Euro
4. Se vedi prezzi in Euro (€), convertili in CHF moltiplicando per ~1.05
5. Se mancano informazioni, usa la tua conoscenza culinaria per suggerire descrizioni appetitose NELLA LINGUA SELEZIONATA
6. Mantieni lo stile ${menuStyle} richiesto
7. TRADUCI automaticamente tutto nella lingua ${languageName}
8. Rispondi SOLO con JSON valido, senza testo aggiuntivo

Formato JSON richiesto:
{
  "restaurantName": "${restaurantName}",
  "categories": [
    {
      "name": "Nome Categoria nella lingua ${languageName}",
      "items": [
        {
          "name": "Nome Piatto in ${languageName}",
          "description": "Descrizione appetitosa in ${languageName}",
          "price": "18.50",
          "allergens": ["allergene1", "allergene2"]
        }
      ]
    }
  ]
}

IMPORTANTE:
- I prezzi nel JSON devono essere SOLO NUMERI senza simboli di valuta (es: "18.50" non "CHF 18.50")
- TUTTO il testo (nomi piatti, descrizioni, categorie, allergeni) deve essere in ${languageName}`;

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
