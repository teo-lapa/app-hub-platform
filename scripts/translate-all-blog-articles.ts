/**
 * Script per tradurre TUTTI gli articoli del blog in DE, FR, EN
 * Usa Google Gemini per traduzioni professionali
 */

const ODOO_CONFIG = {
  url: "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com",
  db: "lapadevadmin-lapa-v2-main-7268478",
  username: "paul@lapa.ch",
  password: "lapa201180",
};

// Gemini API
const GEMINI_API_KEY = "AIzaSyA0G2fmSasrbuQZKSg-GnNKup9d8fPR8Sc";

let sessionId: string = "";

async function authenticate(): Promise<string> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password,
      },
      id: Date.now(),
    }),
  });

  const setCookie = response.headers.get("set-cookie");
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  if (!sessionMatch) throw new Error("Could not extract session_id");
  return sessionMatch[1];
}

async function readWithLang(model: string, ids: number[], fields: string[], lang: string): Promise<any[]> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/read`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: "read",
          args: [ids],
          kwargs: {
            fields: fields,
            context: { lang: lang },
          },
        },
        id: Date.now(),
      }),
    }
  );

  const data: any = await response.json();
  if (data.error) throw new Error(`Odoo error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function writeWithLang(model: string, ids: number[], values: any, lang: string): Promise<boolean> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model,
          method: "write",
          args: [ids, values],
          kwargs: { context: { lang: lang } },
        },
        id: Date.now(),
      }),
    }
  );

  const data: any = await response.json();
  if (data.error) throw new Error(`Write error: ${JSON.stringify(data.error)}`);
  return data.result === true;
}

async function searchRead(model: string, domain: any[], fields: string[]): Promise<any[]> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: model,
          method: "search_read",
          args: [],
          kwargs: { domain: domain, fields: fields },
        },
        id: Date.now(),
      }),
    }
  );

  const data: any = await response.json();
  return data.result || [];
}

async function translateWithGemini(text: string, targetLang: string, sourceDesc: string): Promise<string> {
  const langNames: Record<string, string> = {
    'de_CH': 'German (Swiss)',
    'fr_CH': 'French (Swiss)',
    'en_US': 'English'
  };

  const prompt = `You are a professional translator. Translate the following ${sourceDesc} from Italian to ${langNames[targetLang]}.

IMPORTANT RULES:
1. Preserve ALL HTML tags exactly as they are
2. Only translate the text content, not the HTML structure
3. Maintain the same formatting and paragraph structure
4. Keep brand names like "LAPA" unchanged
5. Use professional, business-appropriate language
6. For Swiss German/French, use local expressions where appropriate

Text to translate:
${text}

Provide ONLY the translated text, no explanations.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: any = await response.json();

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid Gemini response');
  }

  return data.candidates[0].content.parts[0].text.trim();
}

function detectLanguage(text: string): string {
  if (!text || text.length < 20) return "EMPTY";
  const cleanText = text.replace(/<[^>]*>/g, ' ').toLowerCase();

  const itWords = ['della', 'nella', 'sono', 'come', 'essere', 'qualità', 'perché', 'più', 'anche', 'questo'];
  const deWords = ['der', 'die', 'das', 'und', 'ist', 'für', 'sie', 'werden', 'qualität', 'auch'];
  const frWords = ['les', 'des', 'une', 'pour', 'qui', 'est', 'dans', 'qualité', 'être', 'aussi'];
  const enWords = ['the', 'and', 'for', 'with', 'that', 'your', 'quality', 'restaurant', 'also', 'this'];

  const itCount = itWords.filter(w => cleanText.includes(w)).length;
  const deCount = deWords.filter(w => cleanText.includes(w)).length;
  const frCount = frWords.filter(w => cleanText.includes(w)).length;
  const enCount = enWords.filter(w => cleanText.includes(w)).length;

  const max = Math.max(itCount, deCount, frCount, enCount);
  if (max === 0) return "UNKNOWN";
  if (itCount === max) return "IT";
  if (deCount === max) return "DE";
  if (frCount === max) return "FR";
  return "EN";
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("=".repeat(80));
  console.log("TRADUZIONE COMPLETA ARTICOLI BLOG LAPA");
  console.log("IT -> DE, FR, EN");
  console.log("=".repeat(80));
  console.log("");

  sessionId = await authenticate();
  console.log("Autenticato con Odoo\n");

  // Get all blog posts
  const allPosts = await searchRead("blog.post", [], ["id", "name"]);
  allPosts.sort((a, b) => a.id - b.id);

  console.log(`Trovati ${allPosts.length} articoli totali\n`);

  const targetLangs = [
    { code: 'de_CH', name: 'Tedesco' },
    { code: 'fr_CH', name: 'Francese' },
    { code: 'en_US', name: 'Inglese' }
  ];

  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process each article
  for (const post of allPosts) {
    console.log("=".repeat(80));
    console.log(`ARTICOLO ID ${post.id}: ${post.name.substring(0, 50)}...`);
    console.log("=".repeat(80));

    try {
      // Read Italian content (base)
      const [itVersion] = await readWithLang("blog.post", [post.id], ["name", "subtitle", "content"], "it_IT");

      const itContent = itVersion.content || '';
      const itTitle = itVersion.name || '';
      const itSubtitle = itVersion.subtitle || '';

      // Check if Italian content exists
      const detectedLang = detectLanguage(itContent);
      if (detectedLang !== "IT" && detectedLang !== "UNKNOWN") {
        console.log(`  SKIP: Contenuto base non in italiano (rilevato: ${detectedLang})`);
        totalSkipped++;
        continue;
      }

      if (itContent.length < 50) {
        console.log(`  SKIP: Contenuto troppo corto (${itContent.length} chars)`);
        totalSkipped++;
        continue;
      }

      console.log(`  Contenuto IT: ${itContent.length} caratteri`);

      // Translate to each target language
      for (const lang of targetLangs) {
        try {
          // Check if translation already exists and is correct
          const [existingVersion] = await readWithLang("blog.post", [post.id], ["name", "content"], lang.code);
          const existingLang = detectLanguage(existingVersion.content || '');

          const expectedLang = lang.code === 'de_CH' ? 'DE' : lang.code === 'fr_CH' ? 'FR' : 'EN';

          if (existingLang === expectedLang) {
            console.log(`  ${lang.name}: Traduzione già presente`);
            continue;
          }

          console.log(`  ${lang.name}: Traduzione in corso...`);

          // Translate title
          const translatedTitle = await translateWithGemini(itTitle, lang.code, "article title");
          await sleep(500); // Rate limiting

          // Translate subtitle if exists
          let translatedSubtitle = '';
          if (itSubtitle && itSubtitle.trim()) {
            translatedSubtitle = await translateWithGemini(itSubtitle, lang.code, "article subtitle");
            await sleep(500);
          }

          // Translate content
          const translatedContent = await translateWithGemini(itContent, lang.code, "article content (HTML)");
          await sleep(500);

          // Write translation
          const updateData: any = {
            name: translatedTitle,
            content: translatedContent
          };

          if (translatedSubtitle) {
            updateData.subtitle = translatedSubtitle;
          }

          const success = await writeWithLang("blog.post", [post.id], updateData, lang.code);

          if (success) {
            console.log(`  ${lang.name}: OK (${translatedContent.length} chars)`);
            totalTranslated++;
          } else {
            console.log(`  ${lang.name}: ERRORE salvataggio`);
            totalErrors++;
          }

          // Rate limiting between translations
          await sleep(1000);

        } catch (langError) {
          console.log(`  ${lang.name}: ERRORE - ${langError}`);
          totalErrors++;
          await sleep(2000); // Longer wait on error
        }
      }

    } catch (error) {
      console.log(`  ERRORE: ${error}`);
      totalErrors++;
    }

    console.log("");

    // Progress update every 10 articles
    if (post.id % 10 === 0) {
      console.log(`--- Progresso: Tradotti ${totalTranslated}, Saltati ${totalSkipped}, Errori ${totalErrors} ---\n`);
    }
  }

  // Final summary
  console.log("=".repeat(80));
  console.log("RIEPILOGO FINALE");
  console.log("=".repeat(80));
  console.log(`Articoli processati: ${allPosts.length}`);
  console.log(`Traduzioni completate: ${totalTranslated}`);
  console.log(`Articoli saltati: ${totalSkipped}`);
  console.log(`Errori: ${totalErrors}`);
  console.log("=".repeat(80));
}

main().catch(console.error);
