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

async function main() {
  console.log("========================================");
  console.log("VERIFICA FINALE TRADUZIONI");
  console.log("========================================\n");

  sessionId = await authenticate();

  // Verifica tutti gli articoli
  const articleIds = Array.from({ length: 15 }, (_, i) => 75 + i);

  console.log("Verifica traduzioni per tutti gli articoli 75-89...\n");

  let allTranslated = true;

  for (const id of articleIds) {
    const [itVersion] = await readWithLang("blog.post", [id], ["name", "content"], "it_IT");
    const [enVersion] = await readWithLang("blog.post", [id], ["name", "content"], "en_US");

    const itContent = itVersion.content || "";
    const enContent = enVersion.content || "";

    const hasContent = itContent.length > 10 && enContent.length > 10;
    const areDifferent = itContent !== enContent;

    const status = hasContent ? (areDifferent ? "✓ DIVERSI" : "⚠ UGUALI") : "✗ VUOTI";

    console.log(`ID ${id}: ${status}`);
    console.log(`  IT: ${itContent.length} caratteri`);
    console.log(`  EN: ${enContent.length} caratteri`);

    if (!hasContent || !areDifferent) {
      allTranslated = false;

      // Mostra anteprima se sono uguali
      if (itContent === enContent && itContent.length > 0) {
        console.log(`  Preview: ${itContent.substring(0, 100)}...`);
      }
    }
    console.log();
  }

  console.log("========================================");
  if (allTranslated) {
    console.log("✓ SUCCESSO: Tutte le traduzioni sono complete e diverse!");
  } else {
    console.log("⚠ ATTENZIONE: Alcune traduzioni potrebbero non essere corrette");
  }
  console.log("========================================");
}

main();
