import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import { put } from '@vercel/blob';

/**
 * Genera un access_token casuale per gli attachment Odoo
 * Necessario per rendere le immagini accessibili pubblicamente a Instagram/Facebook API
 */
function generateAccessToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

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

// Instagram Account ID in Odoo
const INSTAGRAM_ACCOUNT_ID = 4;

/**
 * Pubblica direttamente su Instagram usando Graph API
 * Bypassa Odoo perché il dominio dev.odoo.com non è accessibile a Instagram
 */
async function publishToInstagramDirect(
  imageUrl: string,
  caption: string,
  odooCookies: string
): Promise<{ success: boolean; instagramPostId?: string; error?: string }> {
  try {
    console.log('📸 [INSTAGRAM-DIRECT] Inizio pubblicazione diretta su Instagram...');

    // 1. Ottieni l'access token da Odoo
    const accounts = await callOdoo(
      odooCookies,
      'social.account',
      'search_read',
      [[['id', '=', INSTAGRAM_ACCOUNT_ID]]],
      { fields: ['instagram_access_token', 'instagram_account_id'] }
    );

    if (!accounts || accounts.length === 0) {
      throw new Error('Account Instagram non trovato in Odoo');
    }

    const { instagram_access_token: accessToken, instagram_account_id: igAccountId } = accounts[0];

    if (!accessToken || !igAccountId) {
      throw new Error('Credenziali Instagram non disponibili');
    }

    console.log(`📸 [INSTAGRAM-DIRECT] Account IG: ${igAccountId}`);

    // 2. Crea il media container
    console.log('📸 [INSTAGRAM-DIRECT] Creazione media container...');
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: accessToken
        })
      }
    );

    const containerData = await containerResponse.json();

    if (containerData.error) {
      throw new Error(containerData.error.message || 'Errore creazione container');
    }

    const containerId = containerData.id;
    console.log(`📸 [INSTAGRAM-DIRECT] Container creato: ${containerId}`);

    // 3. Attendi che il container sia pronto (polling)
    console.log('📸 [INSTAGRAM-DIRECT] Attendo che il container sia pronto...');
    let containerReady = false;
    let attempts = 0;
    const maxAttempts = 30; // Max 60 secondi

    while (!containerReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
      );
      const statusData = await statusResponse.json();

      console.log(`📸 [INSTAGRAM-DIRECT] Tentativo ${attempts}/${maxAttempts} - Status: ${statusData.status_code}`);

      if (statusData.status_code === 'FINISHED') {
        containerReady = true;
      } else if (statusData.status_code === 'ERROR') {
        throw new Error('Container in stato ERROR');
      }
    }

    if (!containerReady) {
      throw new Error('Timeout: container non pronto dopo 60 secondi');
    }

    // 4. Pubblica il container
    console.log('📸 [INSTAGRAM-DIRECT] Pubblicazione del post...');
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken
        })
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      throw new Error(publishData.error.message || 'Errore pubblicazione');
    }

    console.log(`✅ [INSTAGRAM-DIRECT] Post pubblicato! ID: ${publishData.id}`);

    return { success: true, instagramPostId: publishData.id };

  } catch (error: any) {
    console.error('❌ [INSTAGRAM-DIRECT] Errore:', error.message);
    return { success: false, error: error.message };
  }
}

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
    let vercelBlobUrl: string | null = null;  // URL pubblico per Instagram
    let processedImageBuffer: Buffer | null = null;
    let processedMimetype: string = 'image/jpeg';

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
        processedImageBuffer = finalBuffer;
        processedMimetype = mimetype;

        console.log(`📦 [PUBLISH-ODOO] Immagine pronta: ${mimetype} (${Math.round(finalBuffer.length / 1024)}KB)`);

        // ========================================
        // INSTAGRAM FIX: Carica su Vercel Blob per avere URL pubblico
        // Instagram non può accedere al dominio dev.odoo.com
        // ========================================
        const hasInstagram = requestedAccountIds.includes(INSTAGRAM_ACCOUNT_ID);
        if (hasInstagram) {
          console.log(`☁️ [PUBLISH-ODOO] Upload su Vercel Blob per Instagram...`);
          const blobFileName = `instagram-${Date.now()}.${extension}`;

          const blob = await put(blobFileName, finalBuffer, {
            access: 'public',
            contentType: mimetype,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });

          vercelBlobUrl = blob.url;
          console.log(`✅ [PUBLISH-ODOO] Vercel Blob URL: ${vercelBlobUrl}`);
        }

        // Genera access_token per rendere l'immagine accessibile pubblicamente
        const accessToken = generateAccessToken();

        // Converti in base64 per Odoo
        const imageBase64 = finalBuffer.toString('base64');
        const fileName = `social-ai-${Date.now()}.${extension}`;

        console.log(`📤 [PUBLISH-ODOO] Creazione attachment in Odoo: ${fileName}`);

        // Crea attachment in Odoo con dati binari
        // IMPORTANTE: Odoo social module richiede type='binary' con datas
        const attachmentResult = await callOdoo(
          odooCookies,
          'ir.attachment',
          'create',
          [{
            name: fileName,
            type: 'binary',
            datas: imageBase64,  // Dati binari in base64
            mimetype: mimetype,
            public: true,
            access_token: accessToken,
          }]
        );

        if (attachmentResult) {
          attachmentId = attachmentResult;
          console.log(`✅ [PUBLISH-ODOO] Attachment creato in Odoo: ID ${attachmentId}`);
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
    // 2. INSTAGRAM - Pubblicazione DIRETTA via Graph API
    // Bypassa Odoo perché il dominio dev.odoo.com non è accessibile a Instagram
    // ========================================
    if (otherAccountIds.includes(ODOO_SOCIAL_ACCOUNTS.instagram.id)) {
      if (vercelBlobUrl) {
        // Usa pubblicazione diretta con URL Vercel Blob
        console.log('📸 [PUBLISH-ODOO] Instagram: usando pubblicazione diretta via Graph API...');

        const instagramResult = await publishToInstagramDirect(
          vercelBlobUrl,
          fullPostText,
          odooCookies
        );

        if (instagramResult.success) {
          allAccountNames.push(ODOO_SOCIAL_ACCOUNTS.instagram.name);
          console.log(`✅ [PUBLISH-ODOO] Instagram pubblicato! Post ID: ${instagramResult.instagramPostId}`);
        } else {
          console.error(`❌ [PUBLISH-ODOO] Instagram fallito: ${instagramResult.error}`);
        }
      } else {
        // Fallback: prova con Odoo (probabilmente fallirà)
        console.warn('⚠️ [PUBLISH-ODOO] Instagram: nessuna immagine Vercel Blob, tento con Odoo...');
        await publishSingleAccount(
          ODOO_SOCIAL_ACCOUNTS.instagram.id,
          ODOO_SOCIAL_ACCOUNTS.instagram.name,
          fullPostText,
          'Instagram'
        );
      }
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
