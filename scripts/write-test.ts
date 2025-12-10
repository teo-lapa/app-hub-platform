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
): Promise<any> {
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
  return data;
}

async function main() {
  console.log("=== TEST SCRITTURA ===\n");

  sessionId = await authenticate();
  console.log("✓ Autenticato\n");

  const testId = 75;
  const testContent = "<h2>Test Translation</h2><p>This is a test English translation content with more text to make it longer than just a few characters.</p><ul><li>Point 1</li><li>Point 2</li></ul>";

  console.log(`1. Stato PRE-scrittura:`);
  let articles = await searchRead("blog.post", [["id", "=", testId]], ["id", "name", "content"]);
  console.log(`   Content length: ${articles[0].content?.length || 0}`);
  console.log(`   Content: ${articles[0].content?.substring(0, 100) || "[VUOTO]"}...\n`);

  console.log(`2. Scrittura in en_US...`);
  console.log(`   Content da scrivere: ${testContent.length} caratteri`);
  const writeResult = await writeWithLang("blog.post", [testId], { content: testContent }, "en_US");
  console.log(`   Risposta: ${JSON.stringify(writeResult)}\n`);

  console.log(`3. Stato POST-scrittura (search_read senza lang):`);
  articles = await searchRead("blog.post", [["id", "=", testId]], ["id", "name", "content"]);
  console.log(`   Content length: ${articles[0].content?.length || 0}`);
  console.log(`   Content: ${articles[0].content?.substring(0, 100) || "[VUOTO]"}...\n`);
}

main();
