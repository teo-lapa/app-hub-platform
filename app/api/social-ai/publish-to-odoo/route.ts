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

// Account da pubblicare di default (Facebook, Instagram, LinkedIn, Twitter)
const DEFAULT_ACCOUNT_IDS = [2, 4, 6, 13];

// Twitter ha limite di 280 caratteri - ID account Twitter
const TWITTER_ACCOUNT_ID = 13;
const TWITTER_MAX_CHARS = 280;

/**
 * Crea un messaggio abbreviato per Twitter (max 280 caratteri)
 * Priorità: caption corta + hashtags principali + link
 */
function createTwitterMessage(caption: string, hashtags: string[], cta: string): string {
  const link = 'lapa.ch';

  // Prendi solo i primi 3-4 hashtags più corti
  const shortHashtags = hashtags
    .filter(h => h.length <= 20)
    .slice(0, 4)
    .join(' ');

  // Calcola spazio disponibile per la caption
  // Riserva spazio per: hashtags + link + spazi
  const reservedSpace = shortHashtags.length + link.length + 10;
  const captionMaxLength = TWITTER_MAX_CHARS - reservedSpace;

  // Tronca la caption se necessario
  let shortCaption = caption;
  if (shortCaption.length > captionMaxLength) {
    shortCaption = shortCaption.substring(0, captionMaxLength - 3) + '...';
  }

  // Componi il messaggio Twitter
  const twitterMessage = `${shortCaption}\n\n${shortHashtags}\n\n${link}`;

  // Verifica finale e tronca se ancora troppo lungo
  if (twitterMessage.length > TWITTER_MAX_CHARS) {
    return twitterMessage.substring(0, TWITTER_MAX_CHARS - 3) + '...';
  }

  return twitterMessage;
}

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

    // Costruisci il testo completo del post (per Facebook, Instagram, LinkedIn)
    const fullPostText = `${caption}\n\n${hashtags.join(' ')}\n\n${cta}`;

    // Costruisci il messaggio abbreviato per Twitter (max 280 caratteri)
    const twitterPostText = createTwitterMessage(caption, hashtags, cta);

    console.log(`📝 [PUBLISH-ODOO] Messaggio completo: ${fullPostText.length} caratteri`);
    console.log(`🐦 [PUBLISH-ODOO] Messaggio Twitter: ${twitterPostText.length} caratteri`);

    // Usa gli account specificati oppure quelli di default
    const requestedAccountIds = body.accountIds && body.accountIds.length > 0
      ? body.accountIds
      : DEFAULT_ACCOUNT_IDS;

    // Separa gli account: Twitter vs Altri (Facebook, Instagram, LinkedIn)
    const hasTwitter = requestedAccountIds.includes(TWITTER_ACCOUNT_ID);
    const otherAccountIds = requestedAccountIds.filter(id => id !== TWITTER_ACCOUNT_ID);

    console.log(`📱 [PUBLISH-ODOO] Account altri: ${otherAccountIds.join(', ')}`);
    console.log(`🐦 [PUBLISH-ODOO] Twitter incluso: ${hasTwitter}`);

    // Array per tracciare i post creati
    const createdPostIds: number[] = [];
    const allAccountNames: string[] = [];

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
          console.log(`✅ [PUBLISH-ODOO] Immagine caricata: attachment ID ${attachmentId}`);
        }
      } catch (imgError: any) {
        console.error('⚠️ [PUBLISH-ODOO] Errore upload immagine:', imgError.message);
        // Continua senza immagine ma avvisa l'utente
      }
    }

    // ========================================
    // PUBBLICAZIONE SEPARATA PER OGNI PIATTAFORMA
    // Creiamo un post separato per ogni account e lo pubblichiamo individualmente
    // Questo evita conflitti tra le API diverse (es. Instagram vs Facebook)
    // ========================================

    // Helper per pubblicare un singolo account con retry
    const publishSingleAccount = async (
      accountId: number,
      accountName: string,
      message: string,
      platformLabel: string
    ): Promise<{ success: boolean; postId?: number }> => {
      console.log(`📤 [PUBLISH-ODOO] Creazione post per ${platformLabel} (account ${accountId})...`);

      const postValues: Record<string, any> = {
        message: message,
        account_ids: [[6, 0, [accountId]]],
        post_method: scheduledDate ? 'scheduled' : 'now',
      };

      if (scheduledDate) {
        postValues.scheduled_date = scheduledDate;
      }

      if (attachmentId) {
        postValues.image_ids = [[6, 0, [attachmentId]]];
      }

      try {
        const postId = await callOdoo(
          odooCookies,
          'social.post',
          'create',
          [postValues]
        );

        if (!postId) {
          console.error(`❌ [PUBLISH-ODOO] Creazione post fallita per ${platformLabel}`);
          return { success: false };
        }

        createdPostIds.push(postId);
        allAccountNames.push(accountName);

        // Pubblica immediatamente se non programmato
        if (!scheduledDate) {
          // Riprova fino a 3 volte con pausa tra i tentativi
          let published = false;
          for (let attempt = 1; attempt <= 3 && !published; attempt++) {
            try {
              console.log(`🔄 [PUBLISH-ODOO] ${platformLabel}: Tentativo ${attempt}/3 per post ${postId}...`);
              await callOdoo(odooCookies, 'social.post', 'action_post', [[postId]]);
              console.log(`✅ [PUBLISH-ODOO] Post ${postId} pubblicato su ${platformLabel}`);
              published = true;
            } catch (e: any) {
              console.warn(`⚠️ [PUBLISH-ODOO] ${platformLabel} tentativo ${attempt} fallito:`, e.message);
              if (attempt < 3) {
                // Aspetta 2 secondi prima di riprovare
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
        }

        return { success: true, postId };
      } catch (e: any) {
        console.error(`❌ [PUBLISH-ODOO] Errore ${platformLabel}:`, e.message);
        return { success: false };
      }
    };

    // ========================================
    // 1. FACEBOOK (messaggio completo)
    // ========================================
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.facebook.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.facebook.id,
        ODOO_SOCIAL_ACCOUNTS.facebook.name,
        fullPostText,
        'Facebook'
      );
      // Piccola pausa tra le piattaforme
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ========================================
    // 2. INSTAGRAM (messaggio completo) - Pubblicato separatamente!
    // ========================================
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.instagram.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.instagram.id,
        ODOO_SOCIAL_ACCOUNTS.instagram.name,
        fullPostText,
        'Instagram'
      );
      // Piccola pausa tra le piattaforme
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ========================================
    // 3. LINKEDIN (messaggio completo)
    // ========================================
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.linkedin.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.linkedin.id,
        ODOO_SOCIAL_ACCOUNTS.linkedin.name,
        fullPostText,
        'LinkedIn'
      );
      // Piccola pausa tra le piattaforme
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ========================================
    // 4. TWITTER (messaggio abbreviato max 280 char)
    // ========================================
    if (hasTwitter) {
      await publishSingleAccount(
        TWITTER_ACCOUNT_ID,
        ODOO_SOCIAL_ACCOUNTS.twitter.name,
        twitterPostText,
        'Twitter'
      );
    }

    // Verifica che almeno un post sia stato creato
    if (createdPostIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Errore durante la creazione dei post in Odoo'
      }, { status: 500 });
    }

    console.log(`✅ [PUBLISH-ODOO] ${createdPostIds.length} post creati: ${createdPostIds.join(', ')}`);
    console.log(`✅ [PUBLISH-ODOO] Account: ${allAccountNames.join(', ')}`);

    return NextResponse.json({
      success: true,
      message: scheduledDate
        ? `Post programmati per ${scheduledDate} su ${allAccountNames.length} account`
        : `Post pubblicati su ${allAccountNames.join(', ')}`,
      odooPostIds: createdPostIds,
      post: {
        ids: createdPostIds,
        hasImage: !!attachmentId,
        accounts: allAccountNames,
        twitterMessageLength: hasTwitter ? twitterPostText.length : null
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
