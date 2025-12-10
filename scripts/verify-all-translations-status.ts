const ODOO_CONFIG = {
  url: "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com",
  db: "lapadevadmin-lapa-v2-main-7268478",
  username: "paul@lapa.ch",
  password: "lapa201180",
};

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

function detectLanguage(text: string): string {
  if (!text || text.length < 20) return "EMPTY";
  const cleanText = text.replace(/<[^>]*>/g, ' ').toLowerCase();

  // Italian indicators
  const itWords = ['della', 'nella', 'sono', 'come', 'essere', 'qualità', 'perché', 'più'];
  const itCount = itWords.filter(w => cleanText.includes(w)).length;

  // German indicators
  const deWords = ['der', 'die', 'das', 'und', 'ist', 'für', 'sie', 'werden', 'qualität'];
  const deCount = deWords.filter(w => cleanText.includes(w)).length;

  // French indicators
  const frWords = ['les', 'des', 'une', 'pour', 'qui', 'est', 'dans', 'qualité', 'être'];
  const frCount = frWords.filter(w => cleanText.includes(w)).length;

  // English indicators
  const enWords = ['the', 'and', 'for', 'with', 'that', 'your', 'quality', 'restaurant'];
  const enCount = enWords.filter(w => cleanText.includes(w)).length;

  const max = Math.max(itCount, deCount, frCount, enCount);
  if (max === 0) return "UNKNOWN";
  if (itCount === max) return "IT";
  if (deCount === max) return "DE";
  if (frCount === max) return "FR";
  return "EN";
}

async function main() {
  console.log("📊 VERIFICA COMPLETA STATO TRADUZIONI BLOG\n");
  console.log("=".repeat(80));

  sessionId = await authenticate();
  console.log("✓ Autenticato\n");

  // Get all blog posts
  const allPosts = await searchRead("blog.post", [], ["id", "name"]);
  allPosts.sort((a, b) => a.id - b.id);

  console.log(`Trovati ${allPosts.length} articoli totali\n`);

  const langs = [
    { code: 'it_IT', name: 'IT', emoji: '🇮🇹' },
    { code: 'de_CH', name: 'DE', emoji: '🇩🇪' },
    { code: 'fr_CH', name: 'FR', emoji: '🇫🇷' },
    { code: 'en_US', name: 'EN', emoji: '🇬🇧' }
  ];

  const results: any[] = [];
  const missingTranslations: any[] = [];

  for (const post of allPosts) {
    const articleStatus: any = {
      id: post.id,
      translations: {}
    };

    for (const lang of langs) {
      try {
        const [version] = await readWithLang("blog.post", [post.id], ["name", "content"], lang.code);
        const content = version.content || '';
        const detectedLang = detectLanguage(content);
        const hasCorrectLang = detectedLang === lang.name || detectedLang === "UNKNOWN";

        articleStatus.translations[lang.name] = {
          title: version.name,
          hasContent: content.length > 100,
          contentLength: content.length,
          detectedLang: detectedLang,
          isCorrect: hasCorrectLang
        };

        // Track missing/incorrect translations
        if (!hasCorrectLang && content.length > 100) {
          missingTranslations.push({
            articleId: post.id,
            targetLang: lang.name,
            currentLang: detectedLang,
            title: version.name
          });
        }
      } catch (e) {
        articleStatus.translations[lang.name] = { error: true };
      }
    }

    results.push(articleStatus);

    // Print status line
    const it = articleStatus.translations.IT;
    const de = articleStatus.translations.DE;
    const fr = articleStatus.translations.FR;
    const en = articleStatus.translations.EN;

    const itStatus = it?.hasContent ? (it.detectedLang === 'IT' ? '✅' : `⚠️${it.detectedLang}`) : '❌';
    const deStatus = de?.hasContent ? (de.detectedLang === 'DE' ? '✅' : `⚠️${de.detectedLang}`) : '❌';
    const frStatus = fr?.hasContent ? (fr.detectedLang === 'FR' ? '✅' : `⚠️${fr.detectedLang}`) : '❌';
    const enStatus = en?.hasContent ? (en.detectedLang === 'EN' ? '✅' : `⚠️${en.detectedLang}`) : '❌';

    const titlePreview = (it?.title || 'N/A').substring(0, 45);
    console.log(`ID ${String(post.id).padStart(3)}: IT${itStatus} DE${deStatus} FR${frStatus} EN${enStatus} | ${titlePreview}...`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📋 RIEPILOGO:\n");

  // Count statistics
  let fullyTranslated = 0;
  let partiallyTranslated = 0;
  let notTranslated = 0;

  for (const r of results) {
    const hasIT = r.translations.IT?.hasContent && r.translations.IT?.detectedLang === 'IT';
    const hasDE = r.translations.DE?.hasContent && r.translations.DE?.detectedLang === 'DE';
    const hasFR = r.translations.FR?.hasContent && r.translations.FR?.detectedLang === 'FR';
    const hasEN = r.translations.EN?.hasContent && r.translations.EN?.detectedLang === 'EN';

    if (hasIT && hasDE && hasFR && hasEN) {
      fullyTranslated++;
    } else if (hasIT && (hasDE || hasFR || hasEN)) {
      partiallyTranslated++;
    } else {
      notTranslated++;
    }
  }

  console.log(`✅ Completamente tradotti (IT+DE+FR+EN): ${fullyTranslated}`);
  console.log(`⚠️  Parzialmente tradotti: ${partiallyTranslated}`);
  console.log(`❌ Non tradotti (solo base): ${notTranslated}`);

  if (missingTranslations.length > 0) {
    console.log(`\n⚠️  TRADUZIONI MANCANTI O ERRATE (${missingTranslations.length}):`);
    for (const m of missingTranslations.slice(0, 20)) {
      console.log(`   ID ${m.articleId}: ${m.targetLang} ha contenuto in ${m.currentLang} invece`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

main();
