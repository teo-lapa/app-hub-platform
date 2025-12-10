import Anthropic from "@anthropic-ai/sdk";

// Configurazione Odoo
const ODOO_CONFIG = {
  url: "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com",
  db: "lapadevadmin-lapa-v2-main-7268478",
  username: "paul@lapa.ch",
  password: "lapa201180",
};

// Configurazione Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

let sessionId: string = "";

// Funzione per autenticarsi in Odoo
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
  if (!setCookie) {
    throw new Error("No session cookie received");
  }

  const sessionMatch = setCookie.match(/session_id=([^;]+)/);
  if (!sessionMatch) {
    throw new Error("Could not extract session_id from cookie");
  }

  console.log("✓ Autenticazione Odoo completata");
  return sessionMatch[1];
}

// Funzione per leggere i blog post
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
  if (data.error) {
    throw new Error(`Odoo error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

// Funzione per scrivere con un contesto di lingua specifico
async function writeWithLang(
  model: string,
  ids: number[],
  values: any,
  lang: string
): Promise<boolean> {
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
  if (data.error) {
    throw new Error(`Odoo error: ${JSON.stringify(data.error)}`);
  }
  return data.result === true;
}

// Funzione per tradurre il contenuto HTML usando Claude
async function translateContent(italianHtml: string): Promise<string> {
  console.log("  → Traduzione in corso...");

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: `Traduci il seguente contenuto HTML da italiano a inglese professionale.

REGOLE CRITICHE:
1. Mantieni TUTTI i tag HTML ESATTAMENTE come sono (<h2>, <h3>, <p>, <ul>, <li>, <a href>, <strong>, <em>, etc.)
2. Traduci SOLO il testo all'interno dei tag
3. NON modificare gli attributi HTML (href, class, style, etc.)
4. Restituisci SOLO l'HTML tradotto, senza commenti o spiegazioni
5. Mantieni la struttura e formattazione esatta

Contenuto HTML da tradurre:

${italianHtml}

Restituisci SOLO l'HTML tradotto:`,
      },
    ],
  });

  const translatedContent = message.content[0];
  if (translatedContent.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return translatedContent.text.trim();
}

// Funzione principale
async function main() {
  console.log("========================================");
  console.log("TRADUZIONE ARTICOLI BLOG IT → EN");
  console.log("========================================\n");

  try {
    // 1. Autenticazione
    sessionId = await authenticate();

    // 2. Ottieni tutti gli articoli da tradurre (ID 75-89)
    console.log("\n📖 Lettura articoli blog (ID 75-89)...");
    const articles = await searchRead(
      "blog.post",
      [["id", ">=", 75], ["id", "<=", 89]],
      ["id", "name", "content"]
    );

    console.log(`✓ Trovati ${articles.length} articoli\n`);

    if (articles.length === 0) {
      console.log("⚠ Nessun articolo trovato con ID 75-89");
      return;
    }

    // Ordina per ID
    articles.sort((a, b) => a.id - b.id);

    // 3. Traduci ogni articolo
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`\n[${i + 1}/${articles.length}] Articolo ID ${article.id}`);
      console.log(`  Titolo: ${article.name}`);

      try {
        // Verifica che ci sia contenuto
        if (!article.content || article.content.trim() === "") {
          console.log("  ⚠ Contenuto vuoto, skip");
          continue;
        }

        console.log(`  Lunghezza contenuto: ${article.content.length} caratteri`);

        // Traduci il contenuto
        const translatedContent = await translateContent(article.content);

        // Scrivi la traduzione in inglese
        console.log("  → Scrittura traduzione in Odoo...");
        const success = await writeWithLang(
          "blog.post",
          [article.id],
          { content: translatedContent },
          "en_US"
        );

        if (success) {
          console.log(`  ✓ Articolo ID ${article.id} tradotto con successo`);
          successCount++;
        } else {
          console.log(`  ✗ Errore nella scrittura dell'articolo ID ${article.id}`);
          errorCount++;
        }

        // Pausa breve per non sovraccaricare le API
        if (i < articles.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`  ✗ Errore: ${error.message}`);
        errorCount++;
      }
    }

    // 4. Riepilogo finale
    console.log("\n========================================");
    console.log("RIEPILOGO");
    console.log("========================================");
    console.log(`✓ Articoli tradotti con successo: ${successCount}`);
    console.log(`✗ Errori: ${errorCount}`);
    console.log(`📊 Totale articoli processati: ${articles.length}`);
    console.log("========================================\n");
  } catch (error: any) {
    console.error("❌ Errore critico:", error.message);
    process.exit(1);
  }
}

// Esegui lo script
main();
