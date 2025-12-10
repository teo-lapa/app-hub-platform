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

// Usa l'API web_read che gestisce meglio le traduzioni
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

async function main() {
  console.log("========================================");
  console.log("VERIFICA TRADUZIONI CON WEB_READ");
  console.log("========================================\n");

  sessionId = await authenticate();

  // Test con un singolo articolo
  const testId = 75;

  console.log(`Test con articolo ID ${testId}:\n`);

  // Leggi in italiano
  const itResults = await webRead("blog.post", [testId], { name: {}, content: {} }, "it_IT");
  console.log("ITALIANO:");
  if (itResults.length > 0) {
    console.log(`  Titolo: ${itResults[0].name}`);
    console.log(`  Content length: ${itResults[0].content?.length || 0}`);
    console.log(`  Preview: ${itResults[0].content?.substring(0, 200) || "[VUOTO]"}...\n`);
  }

  // Leggi in inglese
  const enResults = await webRead("blog.post", [testId], { name: {}, content: {} }, "en_US");
  console.log("INGLESE:");
  if (enResults.length > 0) {
    console.log(`  Titolo: ${enResults[0].name}`);
    console.log(`  Content length: ${enResults[0].content?.length || 0}`);
    console.log(`  Preview: ${enResults[0].content?.substring(0, 200) || "[VUOTO]"}...\n`);
  }

  // Confronto
  if (itResults.length > 0 && enResults.length > 0) {
    const areSame = itResults[0].content === enResults[0].content;
    console.log(`\nContenuti ${areSame ? "UGUALI" : "DIVERSI"}`);
  }
}

main();
