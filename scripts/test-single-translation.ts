import Anthropic from "@anthropic-ai/sdk";

const ODOO_CONFIG = {
  url: "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com",
  db: "lapadevadmin-lapa-v2-main-7268478",
  username: "paul@lapa.ch",
  password: "lapa201180",
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

let sessionId: string = "";

async function authenticate(): Promise<string> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

async function searchRead(
  model: string,
  domain: any[],
  fields: string[]
): Promise<any[]> {
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
          kwargs: {
            domain: domain,
            fields: fields,
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

async function writeWithLang(
  model: string,
  ids: number[],
  values: any,
  lang: string
): Promise<boolean> {
  console.log(`\n  Writing to Odoo with lang=${lang}...`);
  console.log(`    IDs: ${JSON.stringify(ids)}`);
  console.log(`    Content length: ${values.content?.length || 0}`);

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
  console.log(`    Response: ${JSON.stringify(data)}`);

  if (data.error) throw new Error(`Odoo error: ${JSON.stringify(data.error)}`);
  return data.result === true;
}

async function webRead(model: string, ids: number[], specification: any, lang: string): Promise<any[]> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/web_read`,
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
          method: "web_read",
          args: [ids],
          kwargs: {
            specification: specification,
            context: { lang: lang },
          },
        },
        id: Date.now(),
      }),
    }
  );

  const data: any = await response.json();
  if (data.error) {
    console.log(`Error: ${JSON.stringify(data.error)}`);
    return [];
  }
  return data.result || [];
}

async function translateContent(italianHtml: string): Promise<string> {
  console.log("    Translating with Claude...");

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: `Traduci il seguente contenuto HTML da italiano a inglese professionale.

REGOLE:
1. Mantieni TUTTI i tag HTML
2. Traduci SOLO il testo
3. NON modificare attributi HTML
4. Restituisci SOLO l'HTML tradotto

HTML da tradurre:

${italianHtml}`,
      },
    ],
  });

  const translatedContent = message.content[0];
  if (translatedContent.type !== "text") throw new Error("Unexpected response");
  return translatedContent.text.trim();
}

async function main() {
  console.log("=== TEST TRADUZIONE SINGOLO ARTICOLO ===\n");

  sessionId = await authenticate();
  console.log("✓ Autenticato\n");

  const testId = 76;

  // 1. Leggi il contenuto originale (prova con web_read e italiano)
  console.log(`1. Lettura articolo ID ${testId} (versione italiana)...`);
  const itArticles = await webRead("blog.post", [testId], { name: {}, content: {} }, "it_IT");

  if (itArticles.length === 0 || !itArticles[0].content) {
    console.log("⚠ Articolo non trovato o contenuto vuoto!");
    return;
  }

  const article = itArticles[0];
  console.log(`   Titolo: ${article.name}`);
  console.log(`   Content length: ${article.content?.length || 0}`);
  console.log(`   Content preview: ${article.content?.substring(0, 150) || "[VUOTO]"}...\n`);

  if (article.content.length < 10) {
    console.log("⚠ Contenuto troppo corto!");
    return;
  }

  // 2. Traduci
  console.log("2. Traduzione...");
  const translatedContent = await translateContent(article.content);
  console.log(`   Translated length: ${translatedContent.length}`);
  console.log(`   Translated preview: ${translatedContent.substring(0, 150)}...\n`);

  // 3. Scrivi la traduzione
  console.log("3. Scrittura traduzione in Odoo (en_US)...");
  const success = await writeWithLang(
    "blog.post",
    [testId],
    { content: translatedContent },
    "en_US"
  );

  console.log(`\n   Write result: ${success ? "SUCCESS" : "FAILED"}\n`);

  // 4. Rileggi per verificare
  console.log("4. Verifica lettura post-scrittura...\n");

  const itResults = await webRead("blog.post", [testId], { content: {} }, "it_IT");
  console.log("   IT version:");
  if (itResults.length > 0) {
    console.log(`     Length: ${itResults[0].content?.length || 0}`);
    console.log(`     Preview: ${itResults[0].content?.substring(0, 150) || "[VUOTO]"}...\n`);
  }

  const enResults = await webRead("blog.post", [testId], { content: {} }, "en_US");
  console.log("   EN version:");
  if (enResults.length > 0) {
    console.log(`     Length: ${enResults[0].content?.length || 0}`);
    console.log(`     Preview: ${enResults[0].content?.substring(0, 150) || "[VUOTO]"}...\n`);
  }

  // 5. Confronto
  if (itResults.length > 0 && enResults.length > 0) {
    const areSame = itResults[0].content === enResults[0].content;
    console.log(`   Risultato: Contenuti ${areSame ? "UGUALI ⚠" : "DIVERSI ✓"}`);
  }
}

main();
