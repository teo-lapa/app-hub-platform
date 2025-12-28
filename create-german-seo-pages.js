const xmlrpc = require('xmlrpc');
const url = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-main-7268478';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/object' });

// 3 German SEO landing pages
const pages = [
    {
        name: 'Italienischer Lebensmittel Grosshändler Zürich',
        url: '/italienischer-lebensmittel-grosshaendler-zuerich',
        meta_title: 'Italienischer Lebensmittel Grosshändler Zürich | LAPA Zero Pensieri',
        meta_description: 'LAPA - Ihr Grosshändler für italienische Lebensmittel in Zürich. Mozzarella, Prosciutto, Pasta, Pizza-Zutaten. B2B Lieferung 6 Tage/Woche. Kostenlose Beratung.',
        meta_keywords: 'italienischer grosshändler zürich, lebensmittel grosshandel zürich, italienische produkte grosshandel, b2b lebensmittel zürich',
        content: `
<section class="s_text_block pt48 pb48 o_colored_level" style="background-color: #f8f9fa;">
    <div class="container">
        <div class="row">
            <div class="col-lg-8 offset-lg-2 text-center">
                <h1 class="display-4" style="color: #c41e3a;">Italienischer Lebensmittel Grosshändler in Zürich</h1>
                <p class="lead mt-4">Ihr zuverlässiger B2B-Partner für authentische italienische Produkte</p>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container">
        <div class="row">
            <div class="col-lg-6">
                <h2>Wer wir sind</h2>
                <p>LAPA ist der führende <strong>Grosshändler für italienische Lebensmittel</strong> in der Schweiz. Seit Jahren beliefern wir Restaurants, Pizzerien, Hotels und Feinkostläden in Zürich und der gesamten Deutschschweiz.</p>
                <p>Unser Sortiment umfasst <strong>über 3.000 Produkte</strong> direkt aus Italien – von frischer Mozzarella di Bufala bis hin zu edlen Prosciutto-Spezialitäten.</p>
            </div>
            <div class="col-lg-6">
                <h2>Was wir liefern</h2>
                <ul class="list-unstyled">
                    <li>✓ <strong>Käse:</strong> Mozzarella, Burrata, Parmigiano, Gorgonzola</li>
                    <li>✓ <strong>Salumi:</strong> Prosciutto di Parma, Mortadella, Bresaola</li>
                    <li>✓ <strong>Pasta:</strong> Frische Pasta, Trockenpasta, Gnocchi</li>
                    <li>✓ <strong>Pizza-Zutaten:</strong> Mehl, Tomaten, Basilikum</li>
                    <li>✓ <strong>Tiefkühlprodukte:</strong> Meeresfrüchte, Gemüse, Fertiggerichte</li>
                    <li>✓ <strong>Öle &amp; Essig:</strong> Olivenöl extra vergine, Balsamico</li>
                </ul>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48" style="background-color: #c41e3a; color: white;">
    <div class="container">
        <div class="row">
            <div class="col-lg-8">
                <h2 style="color: white;">Lieferung in Zürich und Umgebung</h2>
                <p>Wir liefern <strong>6 Tage die Woche</strong> direkt zu Ihrem Restaurant oder Geschäft. Kühlkette garantiert.</p>
                <ul>
                    <li>Zürich Stadt und Agglomeration</li>
                    <li>Winterthur, Uster, Wetzikon</li>
                    <li>Gesamte Deutschschweiz</li>
                </ul>
            </div>
            <div class="col-lg-4 d-flex align-items-center justify-content-center">
                <a href="/contactus" class="btn btn-light btn-lg" style="color: #c41e3a; font-weight: bold;">Kostenlose Beratung für Restaurants</a>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container text-center">
        <h2>Warum LAPA wählen?</h2>
        <div class="row mt-4">
            <div class="col-md-4">
                <h4>Qualität aus Italien</h4>
                <p>Direktimport von ausgewählten italienischen Produzenten</p>
            </div>
            <div class="col-md-4">
                <h4>Faire B2B-Preise</h4>
                <p>Konkurrenzfähige Grosshandelspreise für Gastronomen</p>
            </div>
            <div class="col-md-4">
                <h4>Persönliche Betreuung</h4>
                <p>Deutschsprachiger Kundenservice und Beratung</p>
            </div>
        </div>
    </div>
</section>
`
    },
    {
        name: 'Pizza Zutaten Grosshandel Zürich',
        url: '/pizza-zutaten-grosshandel-zuerich',
        meta_title: 'Pizza Zutaten Grosshandel Zürich | Mehl, Mozzarella, Tomaten | LAPA',
        meta_description: 'Pizza Zutaten für Profis: Italienisches Pizzamehl, Fior di Latte, San Marzano Tomaten, Basilikum. B2B Grosshandel in Zürich. Lieferung für Pizzerien.',
        meta_keywords: 'pizza zutaten grosshandel, pizzamehl kaufen zürich, mozzarella für pizzeria, san marzano tomaten grosshandel',
        content: `
<section class="s_text_block pt48 pb48 o_colored_level" style="background-color: #f8f9fa;">
    <div class="container">
        <div class="row">
            <div class="col-lg-8 offset-lg-2 text-center">
                <h1 class="display-4" style="color: #c41e3a;">Pizza Zutaten Grosshandel in Zürich</h1>
                <p class="lead mt-4">Professionelle Zutaten für authentische italienische Pizza</p>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container">
        <div class="row">
            <div class="col-lg-6">
                <h2>Für Pizzerien, die keine Kompromisse machen</h2>
                <p>Sie führen eine Pizzeria in Zürich oder der Deutschschweiz? Bei LAPA finden Sie alle <strong>professionellen Pizza-Zutaten</strong>, die Sie für eine authentische italienische Pizza benötigen.</p>
                <p>Von <strong>Caputo Mehl</strong> bis zur perfekten <strong>Fior di Latte Mozzarella</strong> – wir liefern direkt aus Italien.</p>
            </div>
            <div class="col-lg-6">
                <h2>Unser Pizza-Sortiment</h2>
                <ul class="list-unstyled">
                    <li>✓ <strong>Pizzamehl:</strong> Caputo, Molino Dallagiovanna, Tipo 00</li>
                    <li>✓ <strong>Mozzarella:</strong> Fior di Latte, Bufala DOP, Pizzakäse</li>
                    <li>✓ <strong>Tomaten:</strong> San Marzano DOP, Pelati, Passata</li>
                    <li>✓ <strong>Kräuter:</strong> Frischer Basilikum, Oregano</li>
                    <li>✓ <strong>Olivenöl:</strong> Extra Vergine für Pizza</li>
                    <li>✓ <strong>Toppings:</strong> Prosciutto, Salami, Gemüse</li>
                </ul>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48" style="background-color: #c41e3a; color: white;">
    <div class="container">
        <div class="row align-items-center">
            <div class="col-lg-8">
                <h2 style="color: white;">Schnelle Lieferung für Pizzerien</h2>
                <p>Bestellung heute – Lieferung morgen. <strong>6 Tage die Woche</strong> liefern wir zu Ihrer Pizzeria in Zürich und Umgebung.</p>
                <p>Kühlkette garantiert. Frische Produkte direkt in Ihre Küche.</p>
            </div>
            <div class="col-lg-4 text-center">
                <a href="/contactus" class="btn btn-light btn-lg" style="color: #c41e3a; font-weight: bold;">Kostenlose Beratung für Restaurants</a>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container">
        <h2 class="text-center mb-4">Beliebte Pizza-Produkte</h2>
        <div class="row">
            <div class="col-md-3 text-center mb-4">
                <h5>Caputo Pizzamehl</h5>
                <p>Das Mehl der Profis aus Neapel</p>
            </div>
            <div class="col-md-3 text-center mb-4">
                <h5>Mozzarella Fior di Latte</h5>
                <p>Perfektes Schmelzverhalten</p>
            </div>
            <div class="col-md-3 text-center mb-4">
                <h5>San Marzano DOP</h5>
                <p>Original italienische Pizzatomaten</p>
            </div>
            <div class="col-md-3 text-center mb-4">
                <h5>Olivenöl Extra Vergine</h5>
                <p>Für den authentischen Geschmack</p>
            </div>
        </div>
    </div>
</section>
`
    },
    {
        name: 'Lieferant für italienische Restaurants Schweiz',
        url: '/lieferant-italienische-restaurants-schweiz',
        meta_title: 'Lieferant für italienische Restaurants Schweiz | LAPA B2B',
        meta_description: 'LAPA beliefert italienische Restaurants in der ganzen Schweiz. Pasta, Antipasti, Salumi, Käse, Wein. Zuverlässiger B2B-Partner. 6 Tage Lieferung.',
        meta_keywords: 'restaurant lieferant schweiz, italienisches restaurant beliefern, gastronomie grosshandel, b2b lebensmittel restaurant',
        content: `
<section class="s_text_block pt48 pb48 o_colored_level" style="background-color: #f8f9fa;">
    <div class="container">
        <div class="row">
            <div class="col-lg-8 offset-lg-2 text-center">
                <h1 class="display-4" style="color: #c41e3a;">Ihr Lieferant für italienische Restaurants</h1>
                <p class="lead mt-4">Zuverlässiger B2B-Partner für die gesamte Schweiz</p>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container">
        <div class="row">
            <div class="col-lg-6">
                <h2>Ihr Partner für italienische Gastronomie</h2>
                <p>LAPA ist seit Jahren der <strong>vertrauenswürdige Lieferant</strong> für italienische Restaurants in der Schweiz. Wir verstehen die Bedürfnisse von Gastronomen und liefern nur Produkte, die wir selbst in unserer Küche verwenden würden.</p>
                <p>Von kleinen Trattorien bis zu gehobenen Ristoranti – wir beliefern sie alle mit <strong>authentischen italienischen Produkten</strong>.</p>
            </div>
            <div class="col-lg-6">
                <h2>Komplettes Restaurant-Sortiment</h2>
                <ul class="list-unstyled">
                    <li>✓ <strong>Antipasti:</strong> Marinierte Artischocken, Oliven, Bruschetta</li>
                    <li>✓ <strong>Primi Piatti:</strong> Pasta fresca, Risotto-Reis, Gnocchi</li>
                    <li>✓ <strong>Secondi:</strong> Frisches Fleisch, Meeresfrüchte</li>
                    <li>✓ <strong>Contorni:</strong> Italienisches Gemüse, Kräuter</li>
                    <li>✓ <strong>Dolci:</strong> Tiramisu, Panna Cotta, Gelato</li>
                    <li>✓ <strong>Bevande:</strong> Italienische Weine, Aperitivo</li>
                </ul>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48" style="background-color: #c41e3a; color: white;">
    <div class="container">
        <div class="row align-items-center">
            <div class="col-lg-8">
                <h2 style="color: white;">Schweizweite Lieferung</h2>
                <p>Wir liefern <strong>in die gesamte Schweiz</strong>:</p>
                <div class="row">
                    <div class="col-md-4">
                        <ul>
                            <li>Zürich</li>
                            <li>Bern</li>
                            <li>Basel</li>
                        </ul>
                    </div>
                    <div class="col-md-4">
                        <ul>
                            <li>Luzern</li>
                            <li>St. Gallen</li>
                            <li>Winterthur</li>
                        </ul>
                    </div>
                    <div class="col-md-4">
                        <ul>
                            <li>Lugano</li>
                            <li>Genf</li>
                            <li>Lausanne</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 text-center">
                <a href="/contactus" class="btn btn-light btn-lg" style="color: #c41e3a; font-weight: bold;">Kostenlose Beratung für Restaurants</a>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container">
        <h2 class="text-center mb-4">Warum Restaurants LAPA wählen</h2>
        <div class="row">
            <div class="col-md-4 text-center mb-4">
                <h4>Zuverlässigkeit</h4>
                <p>Lieferung 6 Tage/Woche, immer pünktlich</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <h4>Qualität</h4>
                <p>Nur authentische italienische Produkte</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <h4>Service</h4>
                <p>Persönliche Betreuung auf Deutsch</p>
            </div>
        </div>
        <div class="row">
            <div class="col-md-4 text-center mb-4">
                <h4>Sortiment</h4>
                <p>Über 3.000 Produkte verfügbar</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <h4>Flexibilität</h4>
                <p>Bestellung bis 18 Uhr, Lieferung am nächsten Tag</p>
            </div>
            <div class="col-md-4 text-center mb-4">
                <h4>Preise</h4>
                <p>Faire B2B-Grosshandelskonditionen</p>
            </div>
        </div>
    </div>
</section>
`
    }
];

common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err || !uid) { console.log('Auth error'); return; }
    console.log('Authenticated, uid:', uid);

    let completed = 0;

    pages.forEach((page, index) => {
        // Build the arch XML
        const arch = `<t t-name="website.${page.url.replace(/\//g, '').replace(/-/g, '_')}">
    <t t-call="website.layout">
        <div id="wrap" class="oe_structure oe_empty">
            ${page.content}
        </div>
    </t>
</t>`;

        // First create the ir.ui.view
        const viewData = {
            name: page.name,
            type: 'qweb',
            key: `website.${page.url.replace(/\//g, '').replace(/-/g, '_')}`,
            arch: arch,
            website_id: 1
        };

        models.methodCall('execute_kw', [db, uid, password, 'ir.ui.view', 'create', [viewData]], (err, viewId) => {
            if (err) {
                console.log(`Error creating view for "${page.name}":`, err.message);
                return;
            }

            console.log(`Created view ID ${viewId} for: ${page.name}`);

            // Now create the website.page
            const pageData = {
                name: page.name,
                url: page.url,
                view_id: viewId,
                website_id: 1,
                is_published: true,
                website_meta_title: page.meta_title,
                website_meta_description: page.meta_description,
                website_meta_keywords: page.meta_keywords
            };

            models.methodCall('execute_kw', [db, uid, password, 'website.page', 'create', [pageData]], (err, pageId) => {
                if (err) {
                    console.log(`Error creating page for "${page.name}":`, err.message);
                    return;
                }

                console.log(`✅ Created page ID ${pageId}: ${page.name}`);
                console.log(`   URL: https://www.lapa.ch${page.url}`);

                completed++;
                if (completed === pages.length) {
                    console.log('\n=== All 3 German SEO pages created! ===');
                }
            });
        });
    });
});
