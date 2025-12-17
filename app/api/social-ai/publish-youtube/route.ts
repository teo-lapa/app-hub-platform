import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per upload video

/**
 * POST /api/social-ai/publish-youtube
 *
 * PUBBLICAZIONE AUTOMATICA VIDEO SU YOUTUBE
 *
 * COME FUNZIONA (scoperto analizzando post funzionanti):
 * 1. Il video viene caricato DIRETTAMENTE su YouTube usando l'API YouTube
 * 2. Il token OAuth viene preso da social.account (account YouTube collegato in Odoo)
 * 3. Dopo l'upload su YouTube, si crea il post Odoo con youtube_video_id
 * 4. action_post() finalizza il post (non fa l'upload, registra solo)
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
    youtubeVideoId?: string;
    postId: number;
  };
  error?: string;
}

/**
 * Carica un video direttamente su YouTube usando l'API YouTube v3
 * Questo e' esattamente quello che fa il widget youtube_upload di Odoo!
 */
async function uploadToYouTube(
  accessToken: string,
  videoBuffer: Buffer,
  title: string,
  description: string,
  categoryId: string = '22',
  privacy: string = 'public'
): Promise<string> {
  console.log('[YouTube API] Starting resumable upload...');
  console.log('[YouTube API] Video size:', videoBuffer.length, 'bytes');

  // Step 1: Inizia il resumable upload session
  const metadata = {
    snippet: {
      title: title,
      description: description,
      categoryId: categoryId,
      tags: ['LAPA', 'Italian Food', 'Gourmet', 'Made in Italy']
    },
    status: {
      privacyStatus: privacy,
      selfDeclaredMadeForKids: false
    }
  };

  console.log('[YouTube API] Requesting upload URL...');

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.length)
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    console.error('[YouTube API] Init failed:', errorText);
    throw new Error(`YouTube API init failed: ${initResponse.status} - ${errorText}`);
  }

  const uploadUrl = initResponse.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube API did not return upload URL');
  }

  console.log('[YouTube API] Got upload URL, uploading video...');

  // Step 2: Carica il video
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.length)
    },
    body: videoBuffer
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('[YouTube API] Upload failed:', errorText);
    throw new Error(`YouTube upload failed: ${uploadResponse.status} - ${errorText}`);
  }

  const result = await uploadResponse.json() as { id: string; snippet?: { title: string } };
  console.log('[YouTube API] Upload successful! Video ID:', result.id);

  return result.id;
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
    // FASE 0: AUTENTICAZIONE ODOO
    // ==========================================

    console.log('[Publish YouTube] Getting Odoo session...');

    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        success: false,
        error: 'Devi essere loggato per pubblicare. Effettua il login.'
      }, { status: 401 });
    }

    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);

    if (!odooCookies) {
      return NextResponse.json({
        success: false,
        error: 'Sessione Odoo non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log(`[Publish YouTube] Odoo session OK! UID: ${uid}`);

    // ==========================================
    // FASE 1: OTTIENI YOUTUBE ACCESS TOKEN DA ODOO
    // ==========================================

    console.log('[Publish YouTube] Getting YouTube access token from Odoo...');

    // Account YouTube LAPA (ID: 7)
    const youtubeAccountId = 7;

    const accounts = await callOdoo(
      odooCookies,
      'social.account',
      'search_read',
      [[['id', '=', youtubeAccountId]], ['youtube_access_token', 'name']]
    );

    if (!accounts || accounts.length === 0 || !accounts[0].youtube_access_token) {
      return NextResponse.json({
        success: false,
        error: 'Account YouTube non configurato o token mancante. Verifica la connessione YouTube in Odoo.'
      }, { status: 500 });
    }

    const youtubeAccessToken = accounts[0].youtube_access_token;
    console.log(`[Publish YouTube] YouTube access token obtained from account: ${accounts[0].name}`);

    const ai = new GoogleGenAI({ apiKey });

    // ==========================================
    // FASE 2: GENERA TITOLO YOUTUBE OTTIMIZZATO
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
"Pappardelle all Uovo Fatte in Casa - Ricetta Tradizionale Italiana"
"Parmigiano Reggiano DOP: Il Re dei Formaggi Italiani"
"Pomodoro San Marzano: L Oro Rosso della Campania"

Rispondi SOLO con il titolo (no spiegazioni, no markdown):`;

    const titleResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: titlePrompt }]
    });

    const rawTitle = titleResponse.text;
    if (!rawTitle) {
      throw new Error('Titolo YouTube non generato');
    }

    const youtubeTitle = rawTitle.trim().replace(/^["']|["']$/g, '');
    console.log(`[Publish YouTube] Title: ${youtubeTitle}`);

    // ==========================================
    // FASE 3: GENERA DESCRIZIONE YOUTUBE
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
3. Sezione "Scopri di piu" con link a www.lapa.ch
4. Call-to-Action (iscriviti al canale)
5. Hashtags rilevanti (max 5)
6. Footer con info LAPA

TEMPLATE:
[Hook emotivo sul prodotto]

[Descrizione dettagliata prodotto e benefici]

Scopri di piu su www.lapa.ch
Ordina ora: www.lapa.ch

Iscriviti al canale per scoprire tutti i prodotti italiani autentici!

${hashtags.slice(0, 5).join(' ')}

---
LAPA - Finest Italian Food
Portare l eccellenza italiana nel mondo
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
    // FASE 4: UPLOAD VIDEO DIRETTAMENTE SU YOUTUBE
    // ==========================================

    console.log('[Publish YouTube] Uploading video directly to YouTube API...');

    // Estrai base64 dal dataUrl
    const base64Match = videoDataUrl.match(/^data:video\/mp4;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Video format non valido - richiesto data:video/mp4;base64,...');
    }

    const videoBase64 = base64Match[1];
    const videoBuffer = Buffer.from(videoBase64, 'base64');
    const videoFilename = `${productName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;

    console.log(`[Publish YouTube] Video size: ${videoBuffer.length} bytes (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // UPLOAD DIRETTO SU YOUTUBE!
    const youtubeVideoId = await uploadToYouTube(
      youtubeAccessToken,
      videoBuffer,
      youtubeTitle,
      youtubeDescription,
      '22',  // People & Blogs category
      'public'
    );

    console.log(`[Publish YouTube] Video uploaded to YouTube! ID: ${youtubeVideoId}`);

    // ==========================================
    // FASE 5: CREA POST ODOO CON VIDEO ID
    // ==========================================

    console.log('[Publish YouTube] Creating Odoo social post...');

    const postId = await callOdoo(
      odooCookies,
      'social.post',
      'create',
      [{
        message: caption,
        account_ids: [[6, 0, [youtubeAccountId]]],
        youtube_title: youtubeTitle,
        youtube_description: youtubeDescription,
        youtube_video_category_id: '22',
        youtube_video_privacy: 'public',
        youtube_video: videoFilename,
        youtube_video_id: youtubeVideoId,  // L'ID del video gia' caricato su YouTube!
        youtube_access_token: youtubeAccessToken
      }]
    );

    if (!postId) {
      throw new Error('Creazione post Odoo fallita');
    }
    console.log(`[Publish YouTube] Odoo post created! ID: ${postId}`);

    // ==========================================
    // FASE 6: PUBBLICA POST
    // ==========================================

    console.log('[Publish YouTube] Publishing post...');

    try {
      await callOdoo(
        odooCookies,
        'social.post',
        'action_post',
        [[postId]]
      );
      console.log('[Publish YouTube] Post published successfully!');
    } catch (publishError: any) {
      console.warn('[Publish YouTube] action_post warning:', publishError.message);
      // Non bloccare - il video e' gia' su YouTube
    }

    // ==========================================
    // RISULTATO FINALE
    // ==========================================

    const videoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;

    return NextResponse.json({
      success: true,
      data: {
        youtubeTitle,
        youtubeDescription,
        youtubeVideoId,
        postId,
        videoUrl
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
