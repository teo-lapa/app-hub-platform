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

// Controlla le traduzioni usando ir.translation
async function checkTranslations(recordId: number): Promise<void> {
  const response = await fetch(
    `${ODOO_CONFIG.url}/web/dataset/call_kw/ir.translation/search_read`,
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
          model: "ir.translation",
          method: "search_read",
          args: [],
          kwargs: {
            domain: [
              ["name", "=", "blog.post,content"],
              ["res_id", "=", recordId],
            ],
            fields: ["lang", "source", "value", "state"],
          },
        },
        id: Date.now(),
      }),
    }
  );

  const data: any = await response.json();
  if (data.error) {
    console.log(`Error: ${JSON.stringify(data.error)}`);
    return;
  }

  console.log(`\nTraduzioni per blog.post ID ${recordId}:`);
  if (data.result && data.result.length > 0) {
    for (const trans of data.result) {
      console.log(`\n  Lingua: ${trans.lang}`);
      console.log(`  State: ${trans.state}`);
      console.log(`  Source length: ${trans.source?.length || 0}`);
      console.log(`  Value length: ${trans.value?.length || 0}`);
      console.log(`  Value preview: ${trans.value?.substring(0, 150) || "[VUOTO]"}...`);
    }
  } else {
    console.log("  Nessuna traduzione trovata");
  }
}

async function main() {
  console.log("========================================");
  console.log("VERIFICA TRADUZIONI RAW (ir.translation)");
  console.log("========================================");

  sessionId = await authenticate();

  // Controlla alcuni articoli
  const testIds = [75, 80, 85, 89];

  for (const id of testIds) {
    await checkTranslations(id);
  }
}

main();
