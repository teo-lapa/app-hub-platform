import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per upload video

/**
 * POST /api/social-ai/publish-youtube
 *
 * PUBBLICAZIONE AUTOMATICA VIDEO SU YOUTUBE
 * USA LA SESSIONE DELL'UTENTE LOGGATO (come tutte le altre app)
 *
 * Carica video generato su YouTube tramite Odoo con:
 * - Titolo ottimizzato automaticamente
 * - Descrizione completa con link a www.lapa.ch
 * - Upload automatico su canale LAPA YouTube
 *
 * Body:
 * - videoDataUrl: string - Video MP4 in base64 (data:video/mp4;base64,...)
 * - productName: string - Nome prodotto
 * - productDescription?: string - Descrizione prodotto
 * - caption: string - Caption social media generata
 * - hashtags: string[] - Hashtags generati
 */

interface PublishYouTubeRequest {
  videoDataUrl: string;
  productName: string;
  productDescription?: string;
  caption: string;
  hashtags: string[];
}

interface PublishYouTubeResult {
  success: boolean;
  data?: {
    youtubeTitle: string;
    youtubeDescription: string;
    videoUrl?: string;
    postId: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PublishYouTubeResult>> {
  try {
    const {
      videoDataUrl,
      productName,
      productDescription,
      caption,
      hashtags
    } = await request.json() as PublishYouTubeRequest;

    if (!videoDataUrl || !productName) {
      return NextResponse.json(
        { success: false, error: 'Video e nome prodotto richiesti' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    console.log(`[Publish YouTube] Starting for product: ${productName}`);

    // ==========================================
    // FASE 0: AUTENTICAZIONE ODOO CON UTENTE LOGGATO
    // ==========================================

    console.log('[Publish YouTube] Getting Odoo session from logged-in user...');

    // Estrai cookies dalla request (utente loggato nell'app)
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        success: false,
        error: 'Devi essere loggato per pubblicare. Effettua il login.'
      }, { status: 401 });
    }

    // Ottieni sessione Odoo dell'utente loggato
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);

    if (!odooCookies) {
      return NextResponse.json({
        success: false,
        error: 'Sessione Odoo non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log(`[Publish YouTube] Odoo session obtained! User UID: ${uid}`);

    const ai = new GoogleGenAI({ apiKey });

    // ==========================================
    // FASE 1: GENERA TITOLO YOUTUBE OTTIMIZZATO
    // ==========================================

    console.log('[Publish YouTube] Generating YouTube title...');

    const titlePrompt = `Sei un esperto di YouTube SEO e video marketing.

PRODOTTO: ${productName}
${productDescription ? `DESCRIZIONE: ${productDescription}` : ''}

COMPITO:
Crea un TITOLO YouTube ottimizzato per massimizzare:
- Click-through rate (CTR)
- Searchability (SEO YouTube)
- Engagement

REQUISITI TITOLO:
- Massimo 60 caratteri (visibili su mobile)
- Keyword principale all'inizio
- Emotivamente coinvolgente
- Include emoji strategico (1-2 max)
- Chiaro valore o beneficio
- NON clickbait
- Italiano perfetto

ESEMPI BUONI:
"🍝 Pappardelle all'Uovo Fatte in Casa - Ricetta Tradizionale Italiana"
"🧀 Parmigiano Reggiano DOP: Il Re dei Formaggi Italiani"
"🍅 Pomodoro San Marzano: L'Oro Rosso della Campania"

Rispondi SOLO con il titolo (no spiegazioni, no markdown):`;

    const titleResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: titlePrompt }]
    });

    const rawTitle = titleResponse.text;
    if (!rawTitle) {
      throw new Error('Titolo YouTube non generato');
    }

    const youtubeTitle = rawTitle.trim().replace(/^["']|["']$/g, ''); // Rimuovi quote
    console.log(`[Publish YouTube] Title: ${youtubeTitle}`);

    // ==========================================
    // FASE 2: GENERA DESCRIZIONE YOUTUBE
    // ==========================================

    console.log('[Publish YouTube] Generating YouTube description...');

    const descriptionPrompt = `Sei un esperto di YouTube content marketing.

PRODOTTO: ${productName}
${productDescription ? `DESCRIZIONE: ${productDescription}` : ''}
CAPTION SOCIAL: ${caption}
HASHTAGS: ${hashtags.join(' ')}

COMPITO:
Crea una DESCRIZIONE YouTube completa e ottimizzata.

STRUTTURA OBBLIGATORIA:
1. Hook iniziale (1-2 righe che catturano attenzione)
2. Descrizione prodotto e benefici (3-4 righe)
3. Sezione "Scopri di più" con link a www.lapa.ch
4. Call-to-Action (iscriviti al canale)
5. Hashtags rilevanti (max 5)
6. Footer con info LAPA

TEMPLATE:
[Hook emotivo sul prodotto]

[Descrizione dettagliata prodotto e benefici]

🌐 Scopri di più su www.lapa.ch
📦 Ordina ora: www.lapa.ch

👉 Iscriviti al canale per scoprire tutti i prodotti italiani autentici!

${hashtags.slice(0, 5).join(' ')}

---
LAPA - Finest Italian Food
Portare l'eccellenza italiana nel mondo
www.lapa.ch

Rispondi SOLO con la descrizione (no markdown, no code blocks):`;

    const descriptionResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: descriptionPrompt }]
    });

    const rawDescription = descriptionResponse.text;
    if (!rawDescription) {
      throw new Error('Descrizione YouTube non generata');
    }

    const youtubeDescription = rawDescription.trim();
    console.log(`[Publish YouTube] Description generated (${youtubeDescription.length} chars)`);

    // ==========================================
    // FASE 3: UPLOAD VIDEO SU ODOO
    // ==========================================

    console.log('[Publish YouTube] Uploading video to Odoo...');

    // Estrai base64 dal dataUrl
    const base64Match = videoDataUrl.match(/^data:video\/mp4;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Video format non valido - richiesto data:video/mp4;base64,...');
    }

    const videoBase64 = base64Match[1];

    // Crea attachment video con nome file corretto per YouTube
    const videoFilename = `${productName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;

    // STEP 1: Carica video come attachment (come per le foto)
    console.log('[Publish YouTube] Uploading video attachment...');

    const videoAttachmentId = await callOdoo(
      odooCookies,
      'ir.attachment',
      'create',
      [{
        name: videoFilename,
        type: 'binary',
        datas: videoBase64,
        res_model: 'social.post',
        mimetype: 'video/mp4',
        public: true
      }]
    );

    if (!videoAttachmentId) {
      throw new Error('Upload video fallito');
    }
    console.log(`[Publish YouTube] Video uploaded! Attachment ID: ${videoAttachmentId}`);

    // STEP 2: Crea post YouTube con video in image_ids (come per le foto!)
    console.log('[Publish YouTube] Creating YouTube post...');

    // Account YouTube LAPA (ID: 7)
    const youtubeAccountId = 7;

    const postId = await callOdoo(
      odooCookies,
      'social.post',
      'create',
      [{
        message: caption,
        account_ids: [[6, 0, [youtubeAccountId]]],
        image_ids: [[6, 0, [videoAttachmentId]]], // Video va in image_ids come le foto!
        youtube_title: youtubeTitle,
        youtube_description: youtubeDescription,
        youtube_video_category_id: 22 // People & Blogs category
      }]
    );

    if (!postId) {
      throw new Error('Creazione post YouTube fallita');
    }
    console.log(`[Publish YouTube] Post created! ID: ${postId}`);

    // ==========================================
    // FASE 4: PUBBLICA POST (trigger upload YouTube)
    // ==========================================

    console.log('[Publish YouTube] Publishing to YouTube...');

    // Delay helper
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Aspetta che Odoo processi il video prima di pubblicare
      console.log('[Publish YouTube] Waiting 5s for video processing...');
      await delay(5000);

      // Chiama il metodo action_post() su social.post per pubblicare
      await callOdoo(
        odooCookies,
        'social.post',
        'action_post',
        [[postId]]
      );
      console.log('[Publish YouTube] Published successfully!');
    } catch (publishError: any) {
      console.warn('[Publish YouTube] Auto-publish might have failed:', publishError.message);
      // Non bloccare - potrebbe richiedere pubblicazione manuale
    }

    // ==========================================
    // RISULTATO FINALE
    // ==========================================

    return NextResponse.json({
      success: true,
      data: {
        youtubeTitle,
        youtubeDescription,
        postId,
        videoUrl: `https://www.youtube.com/@lapa-zero-pensieri` // Channel URL
      }
    });

  } catch (error: any) {
    console.error('[Publish YouTube] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante pubblicazione YouTube'
      },
      { status: 500 }
    );
  }
}
