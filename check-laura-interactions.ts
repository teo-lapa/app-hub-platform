/**
 * Script per controllare le interazioni di Laura Teodoresco
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Carica le variabili d'ambiente
config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';

async function checkLauraInteractions() {
  console.log('🔍 Cerco Laura Teodoresco nel database...\n');

  try {
    // 1. Cerca il customer avatar
    const avatarResult = await sql`
      SELECT
        id,
        odoo_partner_id,
        name,
        email,
        phone,
        city,
        total_orders,
        total_revenue,
        last_order_date,
        health_score,
        churn_risk_score,
        engagement_score,
        assigned_salesperson_name
      FROM customer_avatars
      WHERE name ILIKE '%LAURA%TEODORESCU%PRIVATO%'
      ORDER BY name
    `;

    if (avatarResult.rows.length === 0) {
      console.log('❌ Nessun cliente trovato con nome "Laura Teodoresco"');
      console.log('\n🔍 Cerco varianti del nome...');

      const variantResult = await sql`
        SELECT
          id,
          name,
          email,
          total_orders
        FROM customer_avatars
        WHERE name ILIKE '%Teodoresco%' OR name ILIKE '%Laura%'
        LIMIT 10
      `;

      if (variantResult.rows.length > 0) {
        console.log('\n📋 Clienti simili trovati:');
        variantResult.rows.forEach(row => {
          console.log(`  - ${row.name} (ID: ${row.id}, Email: ${row.email || 'N/A'})`);
        });
      }

      return;
    }

    console.log('✅ Cliente trovato!\n');

    const avatar = avatarResult.rows[0];

    console.log('👤 ========================================');
    console.log(`   PROFILO CLIENTE`);
    console.log('========================================');
    console.log(`Nome:              ${avatar.name}`);
    console.log(`ID Avatar:         ${avatar.id}`);
    console.log(`Odoo Partner ID:   ${avatar.odoo_partner_id}`);
    console.log(`Email:             ${avatar.email || 'N/A'}`);
    console.log(`Telefono:          ${avatar.phone || 'N/A'}`);
    console.log(`Città:             ${avatar.city || 'N/A'}`);
    console.log(`\n📊 METRICHE BUSINESS`);
    console.log(`Ordini totali:     ${avatar.total_orders}`);
    console.log(`Revenue totale:    €${avatar.total_revenue ? parseFloat(avatar.total_revenue as any).toFixed(2) : '0.00'}`);
    console.log(`Ultimo ordine:     ${avatar.last_order_date ? new Date(avatar.last_order_date).toLocaleDateString('it-IT') : 'N/A'}`);
    console.log(`\n🎯 SCORES AI`);
    console.log(`Health Score:      ${avatar.health_score}/100`);
    console.log(`Churn Risk:        ${avatar.churn_risk_score}/100`);
    console.log(`Engagement:        ${avatar.engagement_score}/100`);
    console.log(`\n👨‍💼 VENDITORE ASSEGNATO`);
    console.log(`${avatar.assigned_salesperson_name || 'Non assegnato'}`);
    console.log('========================================\n');

    // 2. Cerca le interazioni
    const interactionsResult = await sql`
      SELECT
        id,
        interaction_type,
        interaction_date,
        outcome,
        notes,
        order_placed,
        order_value,
        samples_given,
        next_follow_up_date,
        salesperson_name,
        created_at
      FROM maestro_interactions
      WHERE customer_avatar_id = ${avatar.id}
      ORDER BY interaction_date DESC
    `;

    console.log(`📝 INTERAZIONI REGISTRATE: ${interactionsResult.rows.length}\n`);

    if (interactionsResult.rows.length === 0) {
      console.log('⚠️  Nessuna interazione registrata per questo cliente.');
      console.log('   Il venditore non ha ancora registrato visite, chiamate o email.\n');
    } else {
      console.log('========================================');
      console.log('   STORICO INTERAZIONI');
      console.log('========================================\n');

      interactionsResult.rows.forEach((interaction, index) => {
        console.log(`📌 Interazione #${index + 1} (ID: ${interaction.id})`);
        console.log(`   Tipo:           ${interaction.interaction_type}`);
        console.log(`   Data:           ${new Date(interaction.interaction_date).toLocaleString('it-IT')}`);
        console.log(`   Outcome:        ${interaction.outcome}`);
        console.log(`   Venditore:      ${interaction.salesperson_name}`);

        if (interaction.notes) {
          console.log(`   Note:           ${interaction.notes}`);
        }

        if (interaction.order_placed) {
          console.log(`   ✅ Ordine fatto: €${interaction.order_value?.toFixed(2) || '0.00'}`);
        }

        if (interaction.samples_given) {
          try {
            const samples = typeof interaction.samples_given === 'string'
              ? JSON.parse(interaction.samples_given)
              : interaction.samples_given;
            if (samples && samples.length > 0) {
              console.log(`   🎁 Campioni:    ${samples.join(', ')}`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        if (interaction.next_follow_up_date) {
          console.log(`   📅 Follow-up:   ${new Date(interaction.next_follow_up_date).toLocaleDateString('it-IT')}`);
        }

        console.log(`   Creata:         ${new Date(interaction.created_at).toLocaleString('it-IT')}`);
        console.log('');
      });

      console.log('========================================\n');

      // Statistiche sulle interazioni
      const stats = {
        visite: interactionsResult.rows.filter(i => i.interaction_type === 'visit').length,
        chiamate: interactionsResult.rows.filter(i => i.interaction_type === 'call').length,
        email: interactionsResult.rows.filter(i => i.interaction_type === 'email').length,
        successful: interactionsResult.rows.filter(i => i.outcome === 'successful').length,
        ordini: interactionsResult.rows.filter(i => i.order_placed).length,
        totaleValore: interactionsResult.rows
          .filter(i => i.order_value)
          .reduce((sum, i) => sum + (i.order_value || 0), 0)
      };

      console.log('📊 STATISTICHE INTERAZIONI');
      console.log('========================================');
      console.log(`Visite:            ${stats.visite}`);
      console.log(`Chiamate:          ${stats.chiamate}`);
      console.log(`Email:             ${stats.email}`);
      console.log(`Success rate:      ${stats.successful}/${interactionsResult.rows.length}`);
      console.log(`Ordini generati:   ${stats.ordini}`);
      console.log(`Valore ordini:     €${stats.totaleValore.toFixed(2)}`);
      console.log('========================================\n');
    }

  } catch (error) {
    console.error('❌ Errore durante la query:', error);
    throw error;
  }
}

// Esegui lo script
checkLauraInteractions()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
