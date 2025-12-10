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
  console.log("Controllo contenuto completo articolo ID 75...\n");

  sessionId = await authenticate();

  // Leggi versione italiana
  const [itVersion] = await readWithLang("blog.post", [75], ["name", "content"], "it_IT");
  console.log("=== VERSIONE ITALIANA ===");
  console.log(`Titolo: ${itVersion.name}`);
  console.log(`\nContenuto:\n${itVersion.content}\n`);

  console.log("\n" + "=".repeat(80) + "\n");

  // Leggi versione inglese
  const [enVersion] = await readWithLang("blog.post", [75], ["name", "content"], "en_US");
  console.log("=== VERSIONE INGLESE ===");
  console.log(`Titolo: ${enVersion.name}`);
  console.log(`\nContenuto:\n${enVersion.content}\n`);
}

main();
