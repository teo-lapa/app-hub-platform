/**
 * Script per fixare le interazioni salvate con customer_avatar_id sbagliato
 *
 * Problema: Il codice faceva parseInt(UUID) convertendo l'UUID in un integer
 * Questo causava interazioni salvate con customer_avatar_id = 297 invece dell'UUID corretto
 *
 * Questo script:
 * 1. Trova tutte le interazioni con customer_avatar_id che sembra un integer invece di UUID
 * 2. Cerca di mappare questi ID agli UUID corretti usando l'Odoo Partner ID
 * 3. Aggiorna le interazioni con l'UUID corretto
 */

const { sql } = require('@vercel/postgres');

async function fixInteractionsCustomerId() {
  console.log('🔧 FIXING INTERACTIONS WITH WRONG customer_avatar_id\n');

  try {
    // 1. Trova Laura's avatar con l'UUID corretto
    console.log('1. Cercando avatar di Laura...');
    const lauraAvatar = await sql`
      SELECT id, odoo_partner_id, name
      FROM customer_avatars
      WHERE odoo_partner_id = 2421
    `;

    if (lauraAvatar.rows.length === 0) {
      console.error('❌ Avatar di Laura non trovato!');
      return;
    }

    const correctUUID = lauraAvatar.rows[0].id;
    console.log(`✅ UUID corretto per Laura: ${correctUUID}\n`);

    // 2. Cerca interazioni che potrebbero essere di Laura ma con ID sbagliato
    // Visto che il parseInt() di un UUID potrebbe dare vari risultati,
    // cerchiamo interazioni con note che contengono riferimenti a Laura o al suo salesperson

    console.log('2. Cercando interazioni orfane (senza customer avatar valido)...');

    // Prima verifichiamo se ci sono interazioni con customer_avatar_id che non esiste
    const orphanedInteractions = await sql`
      SELECT
        i.id,
        i.customer_avatar_id,
        i.interaction_date,
        i.interaction_type,
        i.outcome,
        i.notes,
        i.salesperson_name,
        i.created_at
      FROM maestro_interactions i
      LEFT JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
      WHERE ca.id IS NULL
      ORDER BY i.created_at DESC
      LIMIT 50
    `;

    console.log(`✅ Trovate ${orphanedInteractions.rows.length} interazioni orfane\n`);

    if (orphanedInteractions.rows.length === 0) {
      console.log('✅ Nessuna interazione orfana da fixare!');
      return;
    }

    // 3. Mostra le interazioni orfane
    console.log('📋 Interazioni orfane trovate:');
    orphanedInteractions.rows.forEach((interaction, index) => {
      console.log(`\n${index + 1}. ID: ${interaction.id}`);
      console.log(`   customer_avatar_id (SBAGLIATO): ${interaction.customer_avatar_id}`);
      console.log(`   Type: ${interaction.interaction_type}`);
      console.log(`   Date: ${new Date(interaction.interaction_date).toLocaleString('it-IT')}`);
      console.log(`   Outcome: ${interaction.outcome}`);
      console.log(`   Salesperson: ${interaction.salesperson_name}`);
      console.log(`   Notes: ${interaction.notes || 'N/A'}`);
      console.log(`   Created: ${new Date(interaction.created_at).toLocaleString('it-IT')}`);
    });

    // 4. Chiedi conferma prima di procedere con il fix
    console.log('\n⚠️  ATTENZIONE: Questo script aggiornerà le interazioni orfane.');
    console.log(`Verranno associate all'avatar di ${lauraAvatar.rows[0].name} (UUID: ${correctUUID})`);
    console.log('\nPer procedere, modifica lo script e rimuovi il commento dalla riga del UPDATE.');
    console.log('OPPURE esegui manualmente questa query nel database:\n');

    const updateQuery = `
UPDATE maestro_interactions
SET customer_avatar_id = '${correctUUID}'
WHERE id IN (
  SELECT i.id
  FROM maestro_interactions i
  LEFT JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
  WHERE ca.id IS NULL
);
`;

    console.log(updateQuery);

    // UNCOMMENT QUESTA SEZIONE PER ESEGUIRE IL FIX AUTOMATICAMENTE
    /*
    console.log('\n🔧 Eseguendo fix...');
    const updateResult = await sql`
      UPDATE maestro_interactions
      SET customer_avatar_id = ${correctUUID}
      WHERE id IN (
        SELECT i.id
        FROM maestro_interactions i
        LEFT JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
        WHERE ca.id IS NULL
      )
    `;

    console.log(`✅ Fix completato! Aggiornate ${updateResult.rowCount} interazioni`);

    // Verifica
    console.log('\n📊 Verificando...');
    const lauraInteractions = await sql`
      SELECT COUNT(*) as total
      FROM maestro_interactions
      WHERE customer_avatar_id = ${correctUUID}
    `;

    console.log(`✅ Laura ora ha ${lauraInteractions.rows[0].total} interazioni totali`);
    */

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Esegui lo script
fixInteractionsCustomerId();
