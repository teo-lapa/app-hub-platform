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

    // Prepara i dati dell'immagine - due versioni:
    // 1. Originale per Facebook, Twitter, LinkedIn (accettano PNG)
    // 2. JPEG per Instagram (accetta SOLO JPEG)
    let originalImageBase64: string | null = null;
    let originalImageName: string | null = null;
    let originalImageMimetype: string | null = null;

    let jpegImageBase64: string | null = null;
    let jpegImageName: string | null = null;

    if (imageUrl) {
      try {
        console.log(`🖼️ [PUBLISH-ODOO] Scaricamento immagine...`);

        // Scarica l'immagine
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(imageBuffer);

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
        // Instagram: usa JPEG
        postValues.image_ids = [[0, 0, {
          name: jpegImageName,
          datas: jpegImageBase64,
          mimetype: 'image/jpeg',
        }]];
        console.log(`📎 [PUBLISH-ODOO] ${platformLabel}: JPEG allegato - ${jpegImageName}`);
      } else if (originalImageBase64 && originalImageName && originalImageMimetype) {
        // Altri: usa formato originale
        postValues.image_ids = [[0, 0, {
          name: originalImageName,
          datas: originalImageBase64,
          mimetype: originalImageMimetype,
        }]];
        console.log(`📎 [PUBLISH-ODOO] ${platformLabel}: ${originalImageMimetype} allegato - ${originalImageName}`);
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
          // INSTAGRAM FIX: Instagram richiede più tempo per processare i media container
          // Il problema: Odoo chiama action_post che crea il container e prova a pubblicare subito
          // Ma Instagram API ha bisogno di ~3-10 secondi per avere il container in stato "FINISHED"
          // Errori comuni: "Media ID is not available", "Only photo or video can be accepted"
          const isInstagram = platformLabel.toLowerCase().includes('instagram');

          // Per Instagram: aspetta 12s prima del primo tentativo (aumentato da 8s)
          // Per altri: 3s è sufficiente
          const initialDelay = isInstagram ? 12000 : 3000;

          console.log(`⏳ [PUBLISH-ODOO] ${platformLabel}: Waiting ${initialDelay/1000}s for media processing...`);
          await new Promise(resolve => setTimeout(resolve, initialDelay));

          // Riprova fino a 3 volte con pausa crescente tra i tentativi
          let published = false;
          for (let attempt = 1; attempt <= 3 && !published; attempt++) {
            try {
              console.log(`🔄 [PUBLISH-ODOO] ${platformLabel}: Tentativo ${attempt}/3 per post ${postId}...`);

              // INSTAGRAM FIX: Prima di ogni retry, resetta lo stato del live_post a "ready"
              // Questo è necessario perché quando action_post fallisce, Odoo segna il live_post come "failed"
              // e non riprova automaticamente. Dobbiamo resettare lo stato manualmente.
              if (isInstagram && attempt > 1) {
                try {
                  // Trova il live_post per questo social.post e account Instagram
                  const livePosts = await callOdoo(
                    odooCookies,
                    'social.live.post',
                    'search_read',
                    [[['post_id', '=', postId], ['account_id', '=', accountId]]],
                    { fields: ['id', 'state'] }
                  );

                  if (livePosts && livePosts.length > 0 && livePosts[0].state === 'failed') {
                    console.log(`🔧 [PUBLISH-ODOO] ${platformLabel}: Resetto live_post ${livePosts[0].id} da "failed" a "ready"...`);
                    await callOdoo(
                      odooCookies,
                      'social.live.post',
                      'write',
                      [[livePosts[0].id], { state: 'ready', failure_reason: false }]
                    );
                  }
                } catch (resetError: any) {
                  console.warn(`⚠️ [PUBLISH-ODOO] ${platformLabel}: Errore reset live_post:`, resetError.message);
                }
              }

              await callOdoo(odooCookies, 'social.post', 'action_post', [[postId]]);

              // Verifica se la pubblicazione è riuscita controllando lo stato del live_post
              if (isInstagram) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Attendi che Odoo aggiorni lo stato
                const livePostsAfter = await callOdoo(
                  odooCookies,
                  'social.live.post',
                  'search_read',
                  [[['post_id', '=', postId], ['account_id', '=', accountId]]],
                  { fields: ['id', 'state', 'instagram_post_id'] }
                );

                if (livePostsAfter && livePostsAfter.length > 0) {
                  if (livePostsAfter[0].state === 'posted' && livePostsAfter[0].instagram_post_id) {
                    console.log(`✅ [PUBLISH-ODOO] Post ${postId} pubblicato su ${platformLabel} (IG ID: ${livePostsAfter[0].instagram_post_id})`);
                    published = true;
                  } else if (livePostsAfter[0].state === 'failed') {
                    throw new Error(`Live post in stato failed`);
                  }
                }
              } else {
                console.log(`✅ [PUBLISH-ODOO] Post ${postId} pubblicato su ${platformLabel}`);
                published = true;
              }
            } catch (e: any) {
              console.warn(`⚠️ [PUBLISH-ODOO] ${platformLabel} tentativo ${attempt} fallito:`, e.message);
              if (attempt < 3) {
                // Per Instagram: aspetta 8s, 12s tra i retry (aumentato per dare tempo al container)
                // Per altri: 2s è sufficiente
                const retryDelay = isInstagram ? (attempt + 1) * 4000 : 2000;
                console.log(`⏳ [PUBLISH-ODOO] ${platformLabel}: Waiting ${retryDelay/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
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
    // 2. INSTAGRAM (messaggio completo) - Attraverso Odoo come gli altri
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
