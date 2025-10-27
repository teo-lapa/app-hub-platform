/**
 * Conta esattamente quante interazioni ci sono per Laura Teodorescu
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';

async function countLauraInteractions() {
  console.log('🔢 Conteggio interazioni Laura Teodorescu...\n');

  try {
    // Laura ha customer_avatar_id = 297
    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE interaction_type = 'visit') as visite,
        COUNT(*) FILTER (WHERE interaction_type = 'call') as chiamate,
        COUNT(*) FILTER (WHERE interaction_type = 'email') as email,
        COUNT(*) FILTER (WHERE interaction_type = 'other') as altre,
        COUNT(*) FILTER (WHERE outcome = 'successful') as successful,
        COUNT(*) FILTER (WHERE outcome = 'neutral') as neutral,
        COUNT(*) FILTER (WHERE outcome = 'unsuccessful') as unsuccessful,
        MIN(interaction_date) as prima_interazione,
        MAX(interaction_date) as ultima_interazione
      FROM maestro_interactions
      WHERE customer_avatar_id = 297
    `;

    const stats = result.rows[0];

    console.log('📊 ========================================');
    console.log('   CONTEGGIO INTERAZIONI');
    console.log('========================================');
    console.log(`Totale interazioni:    ${stats.total}`);
    console.log('');
    console.log('📝 PER TIPO:');
    console.log(`  Visite:              ${stats.visite}`);
    console.log(`  Chiamate:            ${stats.chiamate}`);
    console.log(`  Email:               ${stats.email}`);
    console.log(`  Altre:               ${stats.altre}`);
    console.log('');
    console.log('🎯 PER OUTCOME:');
    console.log(`  Successful:          ${stats.successful}`);
    console.log(`  Neutral:             ${stats.neutral}`);
    console.log(`  Unsuccessful:        ${stats.unsuccessful}`);
    console.log('');
    console.log('📅 PERIODO:');
    console.log(`  Prima:               ${new Date(stats.prima_interazione).toLocaleString('it-IT')}`);
    console.log(`  Ultima:              ${new Date(stats.ultima_interazione).toLocaleString('it-IT')}`);
    console.log('========================================\n');

    // Ora lista tutte le interazioni con ID
    const allInteractions = await sql`
      SELECT id, interaction_type, interaction_date, outcome, notes, created_at
      FROM maestro_interactions
      WHERE customer_avatar_id = 297
      ORDER BY interaction_date DESC
    `;

    console.log('📋 LISTA COMPLETA INTERAZIONI (più recenti prime):\n');
    allInteractions.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ID: ${row.id} | ${row.interaction_type} | ${new Date(row.interaction_date).toLocaleString('it-IT')} | ${row.outcome}`);
      if (row.notes && row.notes.length < 100) {
        console.log(`   Note: ${row.notes}`);
      }
    });

    console.log('\n========================================');
    console.log(`✅ TOTALE: ${allInteractions.rows.length} interazioni`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Errore:', error);
    throw error;
  }
}

countLauraInteractions()
  .then(() => {
    console.log('✅ Conteggio completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
