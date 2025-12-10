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
            context: { lang: "it_IT" },
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
  console.log("Analisi lingue degli articoli 75-89...\n");

  sessionId = await authenticate();

  const articles = await searchRead(
    "blog.post",
    [["id", ">=", 75], ["id", "<=", 89]],
    ["id", "name", "content"]
  );

  articles.sort((a, b) => a.id - b.id);

  for (const article of articles) {
    const content = article.content || "";
    const preview = content.substring(0, 200).replace(/\n/g, " ");

    // Analisi lingua
    let language = "UNKNOWN";
    if (content.includes("Come ") || content.includes("La ") || content.includes("Il ") ||
        content.includes("una ") || content.includes("della ") || content.includes("per ")) {
      language = "ITALIANO";
    } else if (content.includes("Die ") || content.includes("der ") || content.includes("das ") ||
               content.includes("Warum ") || content.includes("Wie ")) {
      language = "TEDESCO/MISTO";
    } else if (content.includes("The ") || content.includes("How ") || content.includes("What ")) {
      language = "INGLESE/MISTO";
    }

    console.log(`\nID ${article.id} - ${article.name}`);
    console.log(`Lingua rilevata: ${language}`);
    console.log(`Preview: ${preview}...`);
  }
}

main();
