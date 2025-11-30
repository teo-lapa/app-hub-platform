/**
 * Test rapido per verificare se la VEO_API_KEY funziona
 * Testa:
 * 1. Connessione API
 * 2. Generazione video (se quota disponibile)
 * 3. Polling status
 * 4. Download video
 */

const VEO_API_KEY = process.env.VEO_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';

async function testVeoKey() {
  console.log('🔑 Testing VEO_API_KEY:', VEO_API_KEY.substring(0, 20) + '...');
  console.log('');

  // TEST 1: Verifica connessione base
  console.log('📡 TEST 1: Verifica connessione API...');
  try {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
    const response = await fetch(testUrl, {
      headers: {
        'x-goog-api-key': VEO_API_KEY
      }
    });

    if (response.ok) {
      console.log('✅ API key valida e connessione OK!');
      const data = await response.json();
      const veoModel = data.models?.find((m: any) => m.name.includes('veo'));
      if (veoModel) {
        console.log('✅ Modello Veo disponibile:', veoModel.name);
      }
    } else {
      const error = await response.text();
      console.error('❌ Errore connessione:', response.status, error);
      return;
    }
  } catch (error: any) {
    console.error('❌ Errore di rete:', error.message);
    return;
  }

  console.log('');

  // TEST 2: Controlla quota disponibile
  console.log('📊 TEST 2: Controlla quota disponibile...');
  console.log('⚠️  Purtroppo Google non fornisce un endpoint per controllare la quota');
  console.log('    Dobbiamo provare a generare un video per vedere se funziona');
  console.log('');

  // TEST 3: Prova generazione video
  console.log('🎬 TEST 3: Prova generazione video...');
  console.log('⚠️  ATTENZIONE: Questo consumerà 1 video dalla quota (10 al giorno)');
  console.log('');

  try {
    const videoPrompt = 'A red apple rotating slowly on a white background';

    console.log('📝 Prompt:', videoPrompt);
    console.log('⏳ Avvio generazione video...');

    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateVideos`;

    const generateResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': VEO_API_KEY
      },
      body: JSON.stringify({
        prompt: videoPrompt,
        config: {
          aspectRatio: '16:9',
          durationSeconds: 6,
          resolution: '720p'
        }
      })
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.json();
      console.error('❌ Errore generazione video:', error);

      if (error.error?.code === 429) {
        console.log('');
        console.log('❌ QUOTA ESAURITA!');
        console.log('   Hai già usato tutti i 10 video disponibili oggi');
        console.log('   Riprova domani o crea un altro progetto/API key');
      }

      return;
    }

    const operation = await generateResponse.json();
    const operationId = operation.name;

    console.log('✅ Video generazione avviata!');
    console.log('📝 Operation ID:', operationId);
    console.log('⏱️  Tempo stimato: ~2 minuti');
    console.log('');

    // TEST 4: Polling dello stato
    console.log('🔄 TEST 4: Polling dello stato...');

    let isDone = false;
    let attempts = 0;
    const maxAttempts = 40; // 2 minuti max (40 x 3 secondi)

    while (!isDone && attempts < maxAttempts) {
      attempts++;

      // Aspetta 3 secondi tra un polling e l'altro
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pollingUrl = `https://generativelanguage.googleapis.com/v1beta/${operationId}`;
      const pollingResponse = await fetch(pollingUrl, {
        headers: {
          'x-goog-api-key': VEO_API_KEY
        }
      });

      if (!pollingResponse.ok) {
        console.error('❌ Errore polling:', pollingResponse.status);
        break;
      }

      const pollingData = await pollingResponse.json();

      if (pollingData.done) {
        isDone = true;
        console.log('✅ Video completato!');
        console.log('');

        // TEST 5: Download video
        console.log('📥 TEST 5: Download video...');

        const videoFile = pollingData.response?.generatedVideos?.[0]?.video;

        if (!videoFile) {
          console.error('❌ Nessun video trovato nella risposta');
          console.log('📋 Response:', JSON.stringify(pollingData.response, null, 2));
          return;
        }

        const fileId = videoFile.name || videoFile.uri;
        console.log('📹 File ID:', fileId);

        const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/${fileId}`;
        const downloadResponse = await fetch(downloadUrl, {
          headers: {
            'x-goog-api-key': VEO_API_KEY
          }
        });

        if (!downloadResponse.ok) {
          console.error('❌ Errore download:', downloadResponse.status);
          return;
        }

        const videoBuffer = await downloadResponse.arrayBuffer();
        console.log('✅ Video scaricato con successo!');
        console.log('📊 Dimensione:', (videoBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');
        console.log('');

        // Salva il video in un file di test
        const fs = require('fs');
        const path = require('path');
        const outputPath = path.join(process.cwd(), 'test-video-output.mp4');
        fs.writeFileSync(outputPath, Buffer.from(videoBuffer));

        console.log('💾 Video salvato in:', outputPath);
        console.log('');
        console.log('🎉 TUTTI I TEST COMPLETATI CON SUCCESSO!');
        console.log('');
        console.log('📊 RIEPILOGO:');
        console.log('   ✅ API key valida');
        console.log('   ✅ Veo model disponibile');
        console.log('   ✅ Video generato correttamente');
        console.log('   ✅ Polling funzionante');
        console.log('   ✅ Download completato');
        console.log('');
        console.log('🚀 La tua VEO_API_KEY funziona perfettamente!');
        console.log('   Puoi usarla nell\'app Social Marketing AI Studio');

      } else {
        const progress = pollingData.metadata?.progress || 0;
        process.stdout.write(`\r⏳ Generazione in corso... (${attempts}/${maxAttempts}) - Progress: ${progress}%`);
      }
    }

    if (!isDone) {
      console.log('');
      console.log('⚠️  Timeout: Il video non è stato completato entro 2 minuti');
      console.log('   Questo può succedere se il server è sovraccarico');
      console.log('   Riprova più tardi');
    }

  } catch (error: any) {
    console.error('❌ Errore durante il test:', error.message);
  }
}

// Esegui il test
console.log('');
console.log('═══════════════════════════════════════════════');
console.log('  🎬 TEST VEO API KEY');
console.log('═══════════════════════════════════════════════');
console.log('');

testVeoKey().catch(console.error);
