import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/social-ai/publish-to-odoo
 *
 * Pubblica un post generato dall'AI Studio direttamente su Odoo Social Marketing.
 * Il post verrà distribuito su tutti i canali social collegati in Odoo.
 *
 * Body:
 * - caption: string - Testo del post
 * - hashtags: string[] - Array di hashtag
 * - cta: string - Call to action
 * - imageUrl?: string - URL dell'immagine generata
 * - videoUrl?: string - URL del video generato
 * - platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
 * - accountIds?: number[] - ID degli account Odoo su cui pubblicare (opzionale, default: tutti)
 * - scheduledDate?: string - Data/ora di pubblicazione programmata (ISO 8601)
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

interface OdooAccount {
  id: number;
  name: string;
  media_type: string;
  is_media_disconnected: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: PublishToOdooRequest = await req.json();

    const { caption, hashtags, cta, imageUrl, videoUrl, platform, accountIds, scheduledDate } = body;

    // Validazione
    if (!caption) {
      return NextResponse.json({ error: 'Caption è richiesto' }, { status: 400 });
    }

    // Costruisci il testo completo del post
    const fullPostText = `${caption}\n\n${hashtags.join(' ')}\n\n${cta}`;

    // Ottieni client Odoo
    const odoo = await getOdooClient();

    // Mappa piattaforma ai media_type di Odoo
    const platformToMediaType: Record<string, string> = {
      instagram: 'instagram',
      facebook: 'facebook',
      tiktok: 'tiktok',
      linkedin: 'linkedin'
    };

    // Cerca gli account social disponibili per questa piattaforma
    let accounts: OdooAccount[];

    if (accountIds && accountIds.length > 0) {
      // Usa gli account specificati
      accounts = await odoo.searchRead(
        'social.account',
        [['id', 'in', accountIds], ['is_media_disconnected', '=', false]],
        ['id', 'name', 'media_type']
      );
    } else {
      // Trova tutti gli account connessi per questa piattaforma
      accounts = await odoo.searchRead(
        'social.account',
        [
          ['media_type', '=', platformToMediaType[platform]],
          ['is_media_disconnected', '=', false]
        ],
        ['id', 'name', 'media_type']
      );
    }

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Nessun account ${platform} connesso in Odoo. Collega prima un account in Odoo > Marketing Social > Configurazione.`
      }, { status: 400 });
    }

    // Prepara i valori per social.post
    const postValues: Record<string, any> = {
      message: fullPostText,
      account_ids: [[6, 0, accounts.map(a => a.id)]], // Comando Many2many: sostituisci con questi ID
    };

    // Aggiungi immagine se presente
    if (imageUrl) {
      try {
        // Scarica l'immagine e convertila in base64
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        // Crea attachment in Odoo
        const attachmentIds = await odoo.create('ir.attachment', [{
          name: `social-ai-image-${Date.now()}.png`,
          type: 'binary',
          datas: imageBase64,
          mimetype: 'image/png',
          res_model: 'social.post',
        }]);

        if (attachmentIds && attachmentIds.length > 0) {
          postValues.image_ids = [[6, 0, [attachmentIds[0]]]];
        }
      } catch (imgError) {
        console.error('Errore upload immagine:', imgError);
        // Continua senza immagine
      }
    }

    // Aggiungi data programmata se presente
    if (scheduledDate) {
      postValues.scheduled_date = scheduledDate;
      postValues.post_method = 'scheduled';
    } else {
      postValues.post_method = 'now'; // Pubblica immediatamente
    }

    // Crea il post in Odoo
    const postIds = await odoo.create('social.post', [postValues]);

    if (!postIds || postIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Errore durante la creazione del post in Odoo'
      }, { status: 500 });
    }

    const postId = postIds[0];

    // Se pubblicazione immediata, avvia il post
    if (!scheduledDate) {
      try {
        await odoo.call('social.post', 'action_post', [[postId]]);
      } catch (postError) {
        console.error('Errore pubblicazione immediata:', postError);
        // Il post è stato creato ma potrebbe essere in stato draft
      }
    }

    // Recupera il post creato per conferma
    const createdPosts = await odoo.searchRead(
      'social.post',
      [['id', '=', postId]],
      ['id', 'message', 'state', 'scheduled_date', 'account_ids']
    );

    const createdPost = createdPosts[0];

    return NextResponse.json({
      success: true,
      message: scheduledDate
        ? `Post programmato per ${scheduledDate} su ${accounts.length} account`
        : `Post pubblicato su ${accounts.length} account`,
      odooPostId: postId,
      post: {
        id: createdPost?.id,
        message: createdPost?.message?.substring(0, 100) + '...',
        state: createdPost?.state,
        scheduledDate: createdPost?.scheduled_date,
        accounts: accounts.map(a => ({ id: a.id, name: a.name }))
      }
    });

  } catch (error: any) {
    console.error('Errore publish-to-odoo:', error);

    // Gestisci errori specifici di Odoo
    if (error.message?.includes('Access Denied') || error.message?.includes('access')) {
      return NextResponse.json({
        success: false,
        error: 'Permessi insufficienti. Verifica che l\'utente Odoo abbia accesso al modulo Social Marketing.'
      }, { status: 403 });
    }

    if (error.message?.includes('social.post') && error.message?.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: 'Modulo Social Marketing non installato in Odoo. Installa il modulo "Social Marketing" da App.'
      }, { status: 400 });
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
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');

    const odoo = await getOdooClient();

    // Costruisci il domain per la ricerca
    const domain: any[] = [['is_media_disconnected', '=', false]];

    if (platform) {
      domain.push(['media_type', '=', platform]);
    }

    // Cerca tutti gli account social connessi
    const accounts = await odoo.searchRead(
      'social.account',
      domain,
      ['id', 'name', 'media_type', 'social_account_handle', 'is_media_disconnected']
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
      totalAccounts: accounts.length
    });

  } catch (error: any) {
    console.error('Errore get accounts:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero degli account'
    }, { status: 500 });
  }
}
