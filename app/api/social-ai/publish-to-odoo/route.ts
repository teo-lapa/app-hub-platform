import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';

/**
 * Converte un'immagine in JPEG se necessario
 * Instagram accetta SOLO JPEG, quindi convertiamo sempre per sicurezza
 */
function convertToJpeg(buffer: Buffer): { buffer: Buffer; mimetype: string; extension: string } {
  // Se è già JPEG, restituisci così com'è
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    console.log('✅ [PUBLISH-ODOO] Immagine già JPEG');
    return { buffer, mimetype: 'image/jpeg', extension: 'jpg' };
  }

  // Se è PNG, converti in JPEG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    console.log('🔄 [PUBLISH-ODOO] Conversione PNG → JPEG...');
    try {
      const png = PNG.sync.read(buffer);
      const jpegData = jpeg.encode({
        data: png.data,
        width: png.width,
        height: png.height
      }, 90);
      console.log(`✅ [PUBLISH-ODOO] Convertito: ${png.width}x${png.height} (${Math.round(jpegData.data.length / 1024)}KB)`);
      return { buffer: jpegData.data, mimetype: 'image/jpeg', extension: 'jpg' };
    } catch (e: any) {
      console.error('⚠️ [PUBLISH-ODOO] Errore conversione:', e.message);
      // Fallback: restituisci originale
      return { buffer, mimetype: 'image/png', extension: 'png' };
    }
  }

  // Altri formati: restituisci come JPEG (potrebbe non funzionare)
  console.warn('⚠️ [PUBLISH-ODOO] Formato non riconosciuto, uso originale');
  return { buffer, mimetype: 'image/jpeg', extension: 'jpg' };
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
  imageUrl?: string;         // URL HTTP (dallo studio manuale)
  imageDataUrl?: string;     // Data URL base64 (dall'autopilot)
  videoUrl?: string;
  videoDataUrl?: string;
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

// Account da pubblicare di default (Facebook, Instagram, LinkedIn, YouTube, Twitter)
const DEFAULT_ACCOUNT_IDS = [2, 4, 6, 7, 13];

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
    const { caption, hashtags, cta, imageUrl, imageDataUrl, scheduledDate } = body;

    // Validazione
    if (!caption) {
      return NextResponse.json({ error: 'Caption è richiesto' }, { status: 400 });
    }

    // Costruisci il testo completo del post (per Facebook, LinkedIn)
    const fullPostText = `${caption}\n\n${hashtags.join(' ')}\n\n${cta}`;

    // Instagram: rimuovi QUALSIASI URL lapa.ch da tutto il testo (caption, hashtags, cta)
    // Instagram blocca/penalizza post con link esterni nel caption
    const stripLapaUrl = (text: string) => text
      .replace(/https?:\/\/(www\.)?lapa\.ch\S*/gi, '')
      .replace(/www\.lapa\.ch\S*/gi, '')
      .replace(/lapa\.ch\S*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const igCaption = stripLapaUrl(caption);
    const igHashtags = hashtags.join(' ');
    const igCta = stripLapaUrl(cta);
    const instagramPostText = `${igCaption}\n\n${igHashtags}${igCta ? `\n\n${igCta}` : ''}`;

    // Costruisci il messaggio abbreviato per Twitter (max 280 caratteri)
    const twitterPostText = createTwitterMessage(caption, hashtags, cta);

    console.log(`📝 [PUBLISH-ODOO] Messaggio completo: ${fullPostText.length} caratteri`);
    console.log(`📸 [PUBLISH-ODOO] Messaggio Instagram (no URL): ${instagramPostText.length} caratteri`);
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

    // Prepara i dati dell'immagine - due versioni:
    // 1. Originale per Facebook, Twitter, LinkedIn (accettano PNG)
    // 2. JPEG per Instagram (accetta SOLO JPEG)
    let originalImageBase64: string | null = null;
    let originalImageName: string | null = null;
    let originalImageMimetype: string | null = null;

    let jpegImageBase64: string | null = null;
    let jpegImageName: string | null = null;

    // Supporta sia imageUrl (HTTP, dallo studio manuale) che imageDataUrl (base64, dall'autopilot)
    const hasImage = imageUrl || imageDataUrl;

    if (hasImage) {
      try {
        let buffer: Buffer;

        if (imageDataUrl) {
          // Data URL base64 dall'autopilot (formato: "data:image/png;base64,iVBOR...")
          console.log(`🖼️ [PUBLISH-ODOO] Decodifica immagine da data URL...`);
          const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          // URL HTTP dallo studio manuale
          console.log(`🖼️ [PUBLISH-ODOO] Scaricamento immagine da URL...`);
          const imageResponse = await fetch(imageUrl!);
          if (!imageResponse.ok) {
            throw new Error(`HTTP ${imageResponse.status}`);
          }
          const imageBuffer = await imageResponse.arrayBuffer();
          buffer = Buffer.from(imageBuffer);
        }

        // Determina formato originale
        let origMimetype = 'image/png';
        let origExtension = 'png';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          origMimetype = 'image/jpeg';
          origExtension = 'jpg';
        }

        // Salva versione originale per Facebook, Twitter, LinkedIn
        originalImageBase64 = buffer.toString('base64');
        originalImageName = `social-ai-${Date.now()}.${origExtension}`;
        originalImageMimetype = origMimetype;

        console.log(`📦 [PUBLISH-ODOO] Immagine originale: ${origMimetype} (${Math.round(buffer.length / 1024)}KB)`);

        // Converti in JPEG per Instagram (solo se necessario)
        const { buffer: jpegBuffer, mimetype: jpegMimetype, extension: jpegExt } = convertToJpeg(buffer);
        jpegImageBase64 = jpegBuffer.toString('base64');
        jpegImageName = `social-ai-${Date.now()}.${jpegExt}`;

        if (origMimetype !== 'image/jpeg') {
          console.log(`📦 [PUBLISH-ODOO] Versione JPEG per Instagram: ${jpegMimetype} (${Math.round(jpegBuffer.length / 1024)}KB)`);
        }

      } catch (imgError: any) {
        console.error('⚠️ [PUBLISH-ODOO] Errore preparazione immagine:', imgError.message);
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

      // IMPORTANTE: Passa l'immagine INLINE - Odoo creerà l'attachment con res_model/res_id corretti
      // Sintassi: [(0, 0, {campo1: valore1, ...})] crea un nuovo record collegato
      // Instagram richiede JPEG, gli altri accettano il formato originale
      const isInstagram = platformLabel.toLowerCase().includes('instagram');

      if (isInstagram && jpegImageBase64 && jpegImageName) {
        // Instagram: usa JPEG e DEVE essere pubblico per permettere a Meta di scaricarlo
        postValues.image_ids = [[0, 0, {
          name: jpegImageName,
          datas: jpegImageBase64,
          mimetype: 'image/jpeg',
          public: true,  // CRITICO: Instagram richiede accesso pubblico all'immagine
        }]];
        console.log(`📎 [PUBLISH-ODOO] ${platformLabel}: JPEG allegato (public) - ${jpegImageName}`);
      } else if (originalImageBase64 && originalImageName && originalImageMimetype) {
        // Altri: usa formato originale, pubblico per sicurezza
        postValues.image_ids = [[0, 0, {
          name: originalImageName,
          datas: originalImageBase64,
          mimetype: originalImageMimetype,
          public: true,  // Anche per altri social, meglio essere pubblico
        }]];
        console.log(`📎 [PUBLISH-ODOO] ${platformLabel}: ${originalImageMimetype} allegato (public) - ${originalImageName}`);
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
          // Breve pausa per dare tempo a Odoo di processare l'attachment
          await new Promise(resolve => setTimeout(resolve, 3000));

          try {
            console.log(`🔄 [PUBLISH-ODOO] ${platformLabel}: Pubblicazione post ${postId}...`);
            await callOdoo(odooCookies, 'social.post', 'action_post', [[postId]]);
            console.log(`✅ [PUBLISH-ODOO] Post ${postId} action_post chiamato su ${platformLabel}`);
          } catch (e: any) {
            // Non bloccare: il post resta in Odoo e può essere ripubblicato manualmente
            console.warn(`⚠️ [PUBLISH-ODOO] ${platformLabel} action_post fallito:`, e.message);
          }
        }

        return { success: true, postId };
      } catch (e: any) {
        console.error(`❌ [PUBLISH-ODOO] Errore ${platformLabel}:`, e.message);
        return { success: false };
      }
    };

    // ========================================
    // ORDINE: Prima i social veloci (FB, LI, TW), poi Instagram per ultimo
    // Instagram è lento e può fallire - non deve bloccare gli altri
    // ========================================

    // 1. FACEBOOK (messaggio completo)
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.facebook.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.facebook.id,
        ODOO_SOCIAL_ACCOUNTS.facebook.name,
        fullPostText,
        'Facebook'
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 2. LINKEDIN (messaggio completo)
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.linkedin.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.linkedin.id,
        ODOO_SOCIAL_ACCOUNTS.linkedin.name,
        fullPostText,
        'LinkedIn'
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. YOUTUBE (messaggio completo)
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.youtube.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.youtube.id,
        ODOO_SOCIAL_ACCOUNTS.youtube.name,
        fullPostText,
        'YouTube'
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4. TWITTER (messaggio abbreviato max 280 char)
    if (hasTwitter) {
      await publishSingleAccount(
        TWITTER_ACCOUNT_ID,
        ODOO_SOCIAL_ACCOUNTS.twitter.name,
        twitterPostText,
        'Twitter'
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 5. INSTAGRAM (per ultimo, senza URL, un solo tentativo)
    // Instagram è inaffidabile: a volte non riesce a scaricare l'immagine da Odoo
    // Non facciamo retry bloccanti - se fallisce, il post resta in Odoo per retry manuale
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.instagram.id)) {
      await publishSingleAccount(
        ODOO_SOCIAL_ACCOUNTS.instagram.id,
        ODOO_SOCIAL_ACCOUNTS.instagram.name,
        instagramPostText,
        'Instagram'
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
        hasImage: !!originalImageBase64,
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
