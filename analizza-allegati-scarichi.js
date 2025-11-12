/**
 * Agente AI per analizzare allegati (audio, foto, testo) degli scarichi parziali
 * - Legge il report JSON generato
 * - Scarica tutti gli allegati
 * - Usa AI per trascrivere audio e analizzare foto
 * - Genera report dettagliato con riassunto per ogni ordine
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const fs = require('fs');
const path = require('path');

// Carica variabili d'ambiente dal file .env.local
require('dotenv').config({ path: '.env.local' });

// Gemini API per analisi AI (supporta testo, immagini E audio!)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function authenticate() {
  console.log('🔐 Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Autenticazione fallita: ' + JSON.stringify(data.error));
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log('✅ Autenticazione riuscita!\n');
  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function scaricaAllegato(cookies, attachmentId, nomeFile, outputDir) {
  try {
    // Leggi i dati dell'allegato
    const attachment = await callOdoo(cookies, 'ir.attachment', 'read', [[attachmentId]], {
      fields: ['datas', 'mimetype', 'name']
    });

    if (!attachment || attachment.length === 0 || !attachment[0].datas) {
      console.log(`   ⚠️  Allegato ${attachmentId} non ha dati`);
      return null;
    }

    const fileData = attachment[0];
    const base64Data = fileData.datas;
    const mimeType = fileData.mimetype || 'application/octet-stream';

    // Converti base64 in buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Salva il file
    const filePath = path.join(outputDir, nomeFile);
    fs.writeFileSync(filePath, buffer);

    console.log(`   ✅ Scaricato: ${nomeFile} (${(buffer.length / 1024).toFixed(2)} KB)`);

    return {
      path: filePath,
      mimeType: mimeType,
      size: buffer.length
    };
  } catch (error) {
    console.log(`   ❌ Errore scaricamento ${nomeFile}: ${error.message}`);
    return null;
  }
}

async function analizzaConAI(contenuto, tipo) {
  if (!GEMINI_API_KEY) {
    return "❌ GEMINI_API_KEY non configurata - impossibile analizzare con AI";
  }

  try {
    let prompt = '';
    let parts = [];

    if (tipo === 'audio') {
      // Gemini supporta audio direttamente!
      prompt = `Trascrivi questo messaggio audio in italiano e riassumi brevemente cosa dice l'autista riguardo allo scarico parziale. Fornisci la trascrizione completa e poi un breve riassunto del motivo.`;

      const base64Audio = fs.readFileSync(contenuto.path, { encoding: 'base64' });
      const mimeType = contenuto.mimeType || 'audio/webm';

      parts.push({ text: prompt });
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Audio
        }
      });

    } else if (tipo === 'immagine') {
      prompt = `Analizza questa immagine e descrivi cosa vedi. Se contiene testo, trascrivilo. Se mostra prodotti, documenti o situazioni rilevanti per un ordine di consegna, descrivili in dettaglio.`;

      const base64Image = fs.readFileSync(contenuto.path, { encoding: 'base64' });
      const mimeType = contenuto.mimeType || 'image/jpeg';

      parts.push({ text: prompt });
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      });

    } else {
      // Testo
      prompt = `Analizza questo messaggio lasciato dall'autista durante uno scarico parziale e fornisci un riassunto chiaro del motivo:\n\n"${contenuto}"\n\nRiassumi in italiano il motivo dello scarico parziale.`;

      parts.push({ text: prompt });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Risposta non valida da Gemini');
    }

    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.log(`   ⚠️  Errore analisi AI: ${error.message}`);
    return `❌ Impossibile analizzare: ${error.message}`;
  }
}

async function analizzaOrdineConAllegati(cookies, ordine, outputDir) {
  console.log(`\n🔍 Analisi ordine ${ordine.numeroOrdineResiduo} - ${ordine.cliente}`);

  const analisi = {
    ...ordine,
    analisiAllegati: []
  };

  if (!ordine.haScarichiParziali) {
    console.log('   ✅ Nessuno scarico parziale da analizzare');
    return analisi;
  }

  // Crea directory per questo ordine
  const ordineDir = path.join(outputDir, ordine.numeroOrdineResiduo.replace(/\//g, '_'));
  if (!fs.existsSync(ordineDir)) {
    fs.mkdirSync(ordineDir, { recursive: true });
  }

  for (const [idx, scarico] of ordine.messaggiScaricoParziale.entries()) {
    console.log(`\n   📨 Messaggio ${idx + 1} da ${scarico.autore}`);

    const messaggioAnalisi = {
      autore: scarico.autore,
      data: scarico.data,
      testoOriginale: scarico.messaggio,
      allegati: [],
      riassuntoAI: ''
    };

    // Analizza il testo del messaggio
    if (scarico.messaggio && scarico.messaggio.trim()) {
      console.log('   📝 Analizzo testo messaggio...');
      messaggioAnalisi.riassuntoAI = await analizzaConAI(scarico.messaggio, 'testo');
    }

    // Scarica e analizza allegati
    if (scarico.allegati && scarico.allegati.length > 0) {
      console.log(`   📎 Elaborazione ${scarico.allegati.length} allegati...`);

      for (const [allegatoIdx, allegato] of scarico.allegati.entries()) {
        if (!allegato.id) continue;

        const nomeFile = `msg${idx + 1}_${allegatoIdx + 1}_${allegato.nome}`;
        const file = await scaricaAllegato(cookies, allegato.id, nomeFile, ordineDir);

        if (file) {
          let analisiAllegato = {
            nome: allegato.nome,
            tipo: allegato.tipo,
            path: file.path,
            analisiAI: ''
          };

          // Analizza in base al tipo
          if (allegato.tipo?.includes('audio')) {
            console.log('   🎤 Trascrivo audio con Gemini AI...');
            analisiAllegato.analisiAI = await analizzaConAI(file, 'audio');
          } else if (allegato.tipo?.includes('image')) {
            console.log('   🖼️  Analizzo immagine con Gemini AI...');
            analisiAllegato.analisiAI = await analizzaConAI(file, 'immagine');
          } else {
            console.log('   📄 Allegato non analizzabile automaticamente');
            analisiAllegato.analisiAI = '📄 File allegato salvato';
          }

          messaggioAnalisi.allegati.push(analisiAllegato);
        }
      }
    }

    analisi.analisiAllegati.push(messaggioAnalisi);
  }

  return analisi;
}

async function generaReportFinale(analisiCompleta) {
  let report = '';

  report += '═════════════════════════════════════════════════════════════════\n';
  report += '  REPORT ANALISI INTELLIGENTE SCARICHI PARZIALI\n';
  report += `  Data: ${new Date().toLocaleString('it-IT')}\n`;
  report += `  Ordini analizzati: ${analisiCompleta.length}\n`;
  report += '═════════════════════════════════════════════════════════════════\n\n';

  for (const [idx, ordine] of analisiCompleta.entries()) {
    report += `\n${'━'.repeat(65)}\n`;
    report += `${idx + 1}. ORDINE: ${ordine.numeroOrdineResiduo}\n`;
    report += `${'━'.repeat(65)}\n\n`;

    report += `📋 INFORMAZIONI:\n`;
    report += `   Cliente: ${ordine.cliente}\n`;
    report += `   Sales Order: ${ordine.salesOrder}\n`;
    report += `   OUT Completato: ${ordine.outCompletato || 'N/A'}\n`;
    report += `   Data prevista: ${new Date(ordine.dataPrevisita).toLocaleDateString('it-IT')}\n\n`;

    if (ordine.prodottiNonScaricati && ordine.prodottiNonScaricati.length > 0) {
      report += `📦 PRODOTTI NON SCARICATI (${ordine.prodottiNonScaricati.length}):\n`;
      ordine.prodottiNonScaricati.forEach((prod, i) => {
        report += `   ${i + 1}. ${prod.nome}\n`;
        report += `      Richiesta: ${prod.quantitaRichiesta} ${prod.uom}\n`;
        report += `      Mancante: ${prod.quantitaRichiesta - prod.quantitaEffettiva} ${prod.uom}\n`;
      });
      report += '\n';
    }

    if (ordine.analisiAllegati && ordine.analisiAllegati.length > 0) {
      report += `🤖 ANALISI AI MESSAGGI AUTISTA:\n\n`;

      ordine.analisiAllegati.forEach((msg, i) => {
        report += `   Messaggio ${i + 1}:\n`;
        report += `   👤 Autore: ${msg.autore}\n`;
        report += `   📅 Data: ${new Date(msg.data).toLocaleString('it-IT')}\n\n`;

        if (msg.riassuntoAI) {
          report += `   💡 RIASSUNTO AI:\n`;
          report += `   ${msg.riassuntoAI.split('\n').join('\n   ')}\n\n`;
        }

        if (msg.testoOriginale) {
          report += `   📝 Testo originale:\n`;
          report += `   ${msg.testoOriginale.split('\n').join('\n   ')}\n\n`;
        }

        if (msg.allegati && msg.allegati.length > 0) {
          report += `   📎 Allegati analizzati:\n`;
          msg.allegati.forEach(all => {
            report += `      • ${all.nome}\n`;
            if (all.analisiAI) {
              report += `        ${all.analisiAI.split('\n').join('\n        ')}\n`;
            }
          });
          report += '\n';
        }
      });
    } else {
      report += `✅ NESSUNO SCARICO PARZIALE REGISTRATO\n\n`;
    }
  }

  // Statistiche finali
  const conScarichi = analisiCompleta.filter(o => o.haScarichiParziali).length;
  const totaleProdottiMancanti = analisiCompleta.reduce((sum, o) =>
    sum + (o.prodottiNonScaricati?.length || 0), 0
  );

  report += '\n\n═════════════════════════════════════════════════════════════════\n';
  report += '  STATISTICHE\n';
  report += '═════════════════════════════════════════════════════════════════\n\n';
  report += `📊 Ordini con scarichi parziali: ${conScarichi}/${analisiCompleta.length}\n`;
  report += `📦 Totale prodotti non scaricati: ${totaleProdottiMancanti}\n`;
  report += `🤖 Messaggi analizzati con AI\n\n`;

  return report;
}

async function main() {
  try {
    console.log('🤖 AGENTE ANALISI INTELLIGENTE SCARICHI PARZIALI\n');

    // 1. Leggi il report JSON
    const reportJsonPath = 'REPORT_SCARICHI_PARZIALI_2025-11-08.json';

    if (!fs.existsSync(reportJsonPath)) {
      throw new Error(`File ${reportJsonPath} non trovato. Esegui prima lo script di analisi.`);
    }

    console.log(`📄 Caricamento report: ${reportJsonPath}\n`);
    const reportData = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));

    // 2. Crea directory output per allegati
    const outputDir = 'allegati_scarichi_parziali';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 3. Autentica
    const cookies = await authenticate();

    // 4. Analizza ogni ordine
    console.log('🔍 Inizio analisi dettagliata...\n');
    const analisiCompleta = [];

    for (const [idx, ordine] of reportData.entries()) {
      const analisi = await analizzaOrdineConAllegati(cookies, ordine, outputDir);
      analisiCompleta.push(analisi);
    }

    // 5. Genera report finale
    console.log('\n\n📝 Generazione report finale...');
    const reportFinale = await generaReportFinale(analisiCompleta);

    // Salva report
    const reportPath = `REPORT_AI_SCARICHI_PARZIALI_${new Date().toISOString().split('T')[0]}.txt`;
    fs.writeFileSync(reportPath, reportFinale, 'utf8');
    console.log(`✅ Report salvato: ${reportPath}`);

    // Salva JSON analisi
    const jsonPath = `REPORT_AI_SCARICHI_PARZIALI_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(jsonPath, JSON.stringify(analisiCompleta, null, 2), 'utf8');
    console.log(`✅ JSON salvato: ${jsonPath}`);

    // Mostra report
    console.log('\n' + reportFinale);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
