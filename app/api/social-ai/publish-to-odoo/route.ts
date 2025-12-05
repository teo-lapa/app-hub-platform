import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';

// Funzione per convertire PNG a JPEG (compatibile con Vercel - no binari nativi)
async function convertToJpeg(imageBuffer: ArrayBuffer): Promise<{ buffer: Buffer; mimetype: string; extension: string }> {
  const buffer = Buffer.from(imageBuffer);

  // Verifica se è già JPEG controllando i magic bytes (FF D8 FF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    console.log('✅ [PUBLISH-ODOO] Immagine già in formato JPEG');
    return { buffer, mimetype: 'image/jpeg', extension: 'jpg' };
  }

  // Verifica se è PNG controllando i magic bytes (89 50 4E 47)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    console.log('🔄 [PUBLISH-ODOO] Conversione PNG -> JPEG...');

    try {
      // Decodifica PNG
      const png = PNG.sync.read(buffer);

      // Prepara i dati RGBA per jpeg-js
      const rawImageData = {
        data: png.data,
        width: png.width,
        height: png.height
      };

      // Codifica in JPEG (qualità 90%)
      const jpegImageData = jpeg.encode(rawImageData, 90);

      console.log(`✅ [PUBLISH-ODOO] Convertito in JPEG: ${png.width}x${png.height} (${Math.round(jpegImageData.data.length / 1024)}KB)`);

      return {
        buffer: jpegImageData.data,
        mimetype: 'image/jpeg',
        extension: 'jpg'
      };
    } catch (conversionError: any) {
      console.error('⚠️ [PUBLISH-ODOO] Errore conversione PNG->JPEG:', conversionError.message);
      // Fallback: usa PNG originale (Instagram potrebbe rifiutarlo)
      return { buffer, mimetype: 'image/png', extension: 'png' };
    }
  }

  // Per altri formati, restituisci come-è
  console.warn('⚠️ [PUBLISH-ODOO] Formato immagine non riconosciuto, uso originale');
  return { buffer, mimetype: 'image/png', extension: 'png' };
}

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/social-ai/publish-to-odoo
 *
 * Pubblica un post generato dall'AI Studio direttamente su Odoo Social Marketing.
 * IMPORTANTE: Usa la sessione dell'utente loggato nell'app (non l'utente admin generico).
 *
 * Account disponibili in Odoo:
 * - [2] Facebook - LAPA - finest italian food
 * - [4] Instagram - lapa_finest_italian_food
 * - [6] LinkedIn - LAPA - finest italian food GmbH
 * - [7] YouTube - lapa-zero-pensieri
 * - [13] Twitter - FoodLapa
 *
 * Campi REQUIRED per social.post:
 * - post_method: "now" | "scheduled"
 * - message: testo del post
 * - account_ids: array di ID account social
 */

interface PublishToOdooRequest {
  caption: string;
  hashtags: string[];
  cta: string;
  imageUrl?: string;
  videoUrl?: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
  accountIds?: number[];
  scheduledDate?: string;
}

// Account social fissi disponibili in Odoo LAPA
const ODOO_SOCIAL_ACCOUNTS = {
  facebook: { id: 2, name: 'LAPA - finest italian food' },
  instagram: { id: 4, name: 'lapa_finest_italian_food' },
  linkedin: { id: 6, name: 'LAPA - finest italian food GmbH' },
  youtube: { id: 7, name: 'lapa-zero-pensieri' },
  twitter: { id: 13, name: 'FoodLapa' }
};

// Account da pubblicare di default (Facebook, Instagram, LinkedIn)
const DEFAULT_ACCOUNT_IDS = [2, 4, 6];

export async function POST(req: NextRequest) {
  try {
    // IMPORTANTE: Prendi i cookies dalla request per usare la sessione dell'utente loggato
    const userCookies = req.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        success: false,
        error: 'Devi essere loggato per pubblicare su Odoo. Effettua il login.'
      }, { status: 401 });
    }

    // Ottieni la sessione Odoo dell'utente loggato
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);

    if (!odooCookies) {
      return NextResponse.json({
        success: false,
        error: 'Sessione Odoo non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log(`📝 [PUBLISH-ODOO] Utente UID: ${uid} sta pubblicando un post`);

    const body: PublishToOdooRequest = await req.json();
    const { caption, hashtags, cta, imageUrl, scheduledDate } = body;

    // Validazione
    if (!caption) {
      return NextResponse.json({ error: 'Caption è richiesto' }, { status: 400 });
    }

    // Costruisci il testo completo del post
    const fullPostText = `${caption}\n\n${hashtags.join(' ')}\n\n${cta}`;

    // Usa gli account specificati oppure quelli di default (Facebook, Instagram, LinkedIn)
    const accountIds = body.accountIds && body.accountIds.length > 0
      ? body.accountIds
      : DEFAULT_ACCOUNT_IDS;

    console.log(`📱 [PUBLISH-ODOO] Account selezionati: ${accountIds.join(', ')}`);

    // Prepara i valori per social.post
    const postValues: Record<string, any> = {
      message: fullPostText,
      account_ids: [[6, 0, accountIds]], // Comando Many2many: set con questi ID
      post_method: scheduledDate ? 'scheduled' : 'now',
    };

    // Aggiungi data programmata se presente
    if (scheduledDate) {
      postValues.scheduled_date = scheduledDate;
    }

    // Aggiungi immagine se presente - IMPORTANTE: Instagram richiede JPEG!
    let attachmentId: number | null = null;
    if (imageUrl) {
      try {
        console.log(`🖼️ [PUBLISH-ODOO] Caricamento immagine...`);

        // Scarica l'immagine
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();

        // IMPORTANTE: Converti in JPEG per compatibilità Instagram
        const { buffer: finalBuffer, mimetype, extension } = await convertToJpeg(imageBuffer);
        const imageBase64 = finalBuffer.toString('base64');

        console.log(`📦 [PUBLISH-ODOO] Immagine pronta: ${mimetype} (${Math.round(finalBuffer.length / 1024)}KB)`);

        // Crea attachment in Odoo
        const attachmentResult = await callOdoo(
          odooCookies,
          'ir.attachment',
          'create',
          [{
            name: `social-ai-${Date.now()}.${extension}`,
            type: 'binary',
            datas: imageBase64,
            mimetype: mimetype,
          }]
        );

        if (attachmentResult) {
          attachmentId = attachmentResult;
          postValues.image_ids = [[6, 0, [attachmentId]]];
          console.log(`✅ [PUBLISH-ODOO] Immagine caricata: attachment ID ${attachmentId}`);
        }
      } catch (imgError: any) {
        console.error('⚠️ [PUBLISH-ODOO] Errore upload immagine:', imgError.message);
        // Continua senza immagine ma avvisa l'utente
      }
    }

    console.log(`📤 [PUBLISH-ODOO] Creazione post con valori:`, {
      message: fullPostText.substring(0, 50) + '...',
      account_ids: accountIds,
      post_method: postValues.post_method,
      has_image: !!attachmentId
    });

    // Crea il post in Odoo
    const postId = await callOdoo(
      odooCookies,
      'social.post',
      'create',
      [postValues]
    );

    if (!postId) {
      return NextResponse.json({
        success: false,
        error: 'Errore durante la creazione del post in Odoo'
      }, { status: 500 });
    }

    console.log(`✅ [PUBLISH-ODOO] Post creato con ID: ${postId}`);

    // Se pubblicazione immediata, avvia il post
    if (!scheduledDate) {
      try {
        console.log(`🚀 [PUBLISH-ODOO] Avvio pubblicazione immediata...`);
        await callOdoo(
          odooCookies,
          'social.post',
          'action_post',
          [[postId]]
        );
        console.log(`✅ [PUBLISH-ODOO] Pubblicazione avviata!`);
      } catch (postError: any) {
        console.error('⚠️ [PUBLISH-ODOO] Errore action_post:', postError.message);
        // Il post è stato creato, potrebbe essere in draft
      }
    }

    // Recupera il post creato per conferma
    const createdPosts = await callOdoo(
      odooCookies,
      'social.post',
      'search_read',
      [[['id', '=', postId]]],
      {
        fields: ['id', 'message', 'state', 'scheduled_date', 'account_ids', 'image_ids', 'create_uid']
      }
    );

    const createdPost = createdPosts?.[0];

    // Mappa account IDs a nomi
    const accountNames = accountIds.map(id => {
      const account = Object.values(ODOO_SOCIAL_ACCOUNTS).find(a => a.id === id);
      return account?.name || `Account ${id}`;
    });

    return NextResponse.json({
      success: true,
      message: scheduledDate
        ? `Post programmato per ${scheduledDate}`
        : `Post pubblicato su ${accountNames.join(', ')}`,
      odooPostId: postId,
      post: {
        id: createdPost?.id,
        message: createdPost?.message?.substring(0, 100) + '...',
        state: createdPost?.state,
        scheduledDate: createdPost?.scheduled_date,
        hasImage: createdPost?.image_ids?.length > 0,
        createdBy: createdPost?.create_uid?.[1] || 'Unknown',
        accounts: accountNames
      }
    });

  } catch (error: any) {
    console.error('❌ [PUBLISH-ODOO] Errore:', error);

    // Gestisci errori specifici di Odoo
    if (error.message?.includes('Access Denied') || error.message?.includes('access')) {
      return NextResponse.json({
        success: false,
        error: 'Permessi insufficienti. Verifica che il tuo utente Odoo abbia accesso al modulo Social Marketing.'
      }, { status: 403 });
    }

    if (error.message?.includes('Session') || error.message?.includes('session')) {
      return NextResponse.json({
        success: false,
        error: 'Sessione scaduta. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la pubblicazione su Odoo'
    }, { status: 500 });
  }
}

/**
 * GET /api/social-ai/publish-to-odoo
 *
 * Restituisce gli account social disponibili in Odoo per la pubblicazione
 */
export async function GET(req: NextRequest) {
  try {
    const userCookies = req.headers.get('cookie');
    const { cookies: odooCookies } = await getOdooSession(userCookies || undefined);

    // Cerca tutti gli account social connessi
    const accounts = await callOdoo(
      odooCookies,
      'social.account',
      'search_read',
      [[['is_media_disconnected', '=', false]]],
      {
        fields: ['id', 'name', 'media_type', 'social_account_handle', 'is_media_disconnected']
      }
    );

    // Raggruppa per piattaforma
    const accountsByPlatform: Record<string, any[]> = {};

    accounts.forEach((account: any) => {
      const type = account.media_type || 'other';
      if (!accountsByPlatform[type]) {
        accountsByPlatform[type] = [];
      }
      accountsByPlatform[type].push({
        id: account.id,
        name: account.name,
        handle: account.social_account_handle,
        connected: !account.is_media_disconnected
      });
    });

    return NextResponse.json({
      success: true,
      accounts: accountsByPlatform,
      totalAccounts: accounts.length,
      defaultAccountIds: DEFAULT_ACCOUNT_IDS
    });

  } catch (error: any) {
    console.error('❌ [PUBLISH-ODOO] Errore get accounts:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero degli account'
    }, { status: 500 });
  }
}
