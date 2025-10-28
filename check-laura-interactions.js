// Script per verificare le interazioni di Laura nel database
const { sql } = require('@vercel/postgres');

async function checkLauraInteractions() {
  console.log('=== VERIFICA INTERAZIONI LAURA TEODORESCU ===\n');

  try {
    const odooPartnerId = 2421;

    // 1. Trova il customer avatar
    console.log('1. Recupero customer_avatar...');
    const avatarResult = await sql`
      SELECT id, odoo_partner_id, name, is_active
      FROM customer_avatars
      WHERE odoo_partner_id = ${odooPartnerId}
    `;

    if (avatarResult.rows.length === 0) {
      console.error('❌ Nessun customer avatar trovato per Odoo Partner ID:', odooPartnerId);
      return;
    }

    const avatar = avatarResult.rows[0];
    console.log('✅ Customer Avatar trovato:');
    console.log(`   ID: ${avatar.id}`);
    console.log(`   Name: ${avatar.name}`);
    console.log(`   Odoo Partner ID: ${avatar.odoo_partner_id}`);
    console.log(`   Is Active: ${avatar.is_active}\n`);

    // 2. Conta tutte le interazioni per questo avatar
    console.log('2. Conto le interazioni totali...');
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM maestro_interactions
      WHERE customer_avatar_id = ${avatar.id}
    `;
    console.log(`✅ Interazioni totali nel DB: ${countResult.rows[0].total}\n`);

    // 3. Recupera le ultime 10 interazioni
    console.log('3. Recupero ultime 10 interazioni...');
    const interactionsResult = await sql`
      SELECT
        id,
        interaction_type,
        interaction_date,
        outcome,
        notes,
        salesperson_name,
        order_placed,
        order_value,
        created_at
      FROM maestro_interactions
      WHERE customer_avatar_id = ${avatar.id}
      ORDER BY interaction_date DESC
      LIMIT 10
    `;

    if (interactionsResult.rows.length === 0) {
      console.log('⚠️ Nessuna interazione trovata per questo cliente\n');
    } else {
      console.log(`✅ Trovate ${interactionsResult.rows.length} interazioni:\n`);

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      interactionsResult.rows.forEach((interaction, index) => {
        const interactionDate = new Date(interaction.interaction_date);
        const createdDate = new Date(interaction.created_at);
        const isToday = interactionDate >= today;

        console.log(`${index + 1}. ${isToday ? '🔴 OGGI' : interactionDate.toLocaleDateString('it-IT')}`);
        console.log(`   ID: ${interaction.id}`);
        console.log(`   Type: ${interaction.interaction_type}`);
        console.log(`   Outcome: ${interaction.outcome}`);
        console.log(`   Salesperson: ${interaction.salesperson_name}`);
        console.log(`   Interaction Date: ${interactionDate.toISOString()}`);
        console.log(`   Created At: ${createdDate.toISOString()}`);
        console.log(`   Notes: ${interaction.notes?.substring(0, 50) || 'N/A'}`);
        if (interaction.order_placed) {
          console.log(`   Order: CHF ${interaction.order_value || 0}`);
        }
        console.log('');
      });
    }

    // 4. Verifica interazioni create oggi
    console.log('4. Verifico interazioni create oggi...');
    const todayInteractions = await sql`
      SELECT
        id,
        interaction_type,
        interaction_date,
        outcome,
        salesperson_name,
        created_at
      FROM maestro_interactions
      WHERE customer_avatar_id = ${avatar.id}
        AND DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
    `;

    if (todayInteractions.rows.length === 0) {
      console.log('⚠️ Nessuna interazione creata oggi per questo cliente\n');
    } else {
      console.log(`✅ Interazioni create oggi: ${todayInteractions.rows.length}\n`);
      todayInteractions.rows.forEach((interaction, index) => {
        console.log(`   ${index + 1}. ${interaction.interaction_type} - ${interaction.outcome}`);
        console.log(`      Creata: ${new Date(interaction.created_at).toLocaleString('it-IT')}`);
        console.log(`      Salesperson: ${interaction.salesperson_name}`);
        console.log('');
      });
    }

    // 5. Verifica l'ultima interazione salvata nel sistema
    console.log('5. Verifico ultima interazione nel sistema (tutti i clienti)...');
    const lastInteraction = await sql`
      SELECT
        i.id,
        i.interaction_type,
        i.interaction_date,
        i.created_at,
        i.salesperson_name,
        ca.name as customer_name,
        ca.odoo_partner_id
      FROM maestro_interactions i
      JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `;

    console.log('✅ Ultime 5 interazioni nel sistema:\n');
    lastInteraction.rows.forEach((interaction, index) => {
      const createdDate = new Date(interaction.created_at);
      const isLaura = interaction.odoo_partner_id === odooPartnerId;

      console.log(`   ${index + 1}. ${isLaura ? '🔴 LAURA' : interaction.customer_name}`);
      console.log(`      Type: ${interaction.interaction_type}`);
      console.log(`      Created: ${createdDate.toLocaleString('it-IT')}`);
      console.log(`      Salesperson: ${interaction.salesperson_name}`);
      console.log('');
    });

    console.log('\n=== RIEPILOGO ===');
    console.log(`Customer Avatar ID per Laura: ${avatar.id}`);
    console.log(`Interazioni totali nel DB: ${countResult.rows[0].total}`);
    console.log(`Interazioni create oggi: ${todayInteractions.rows.length}`);
    console.log(`Interazioni mostrate nella UI: 6 (dallo screenshot)`);

    if (parseInt(countResult.rows[0].total) !== 6) {
      console.log('\n⚠️ PROBLEMA TROVATO!');
      console.log('Il database ha un numero diverso di interazioni rispetto all\'UI.');
      console.log('\nPossibili cause:');
      console.log('1. La query nella pagina ha filtri aggiuntivi');
      console.log('2. L\'invalidazione cache non sta funzionando');
      console.log('3. C\'è un problema con il fetch dei dati');
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Esegui la verifica
checkLauraInteractions();
