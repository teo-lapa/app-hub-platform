const xmlrpc = require('xmlrpc');
const url = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-main-7268478';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/object' });

// Local SEO pages for Swiss German cities
const cities = [
    { name: 'Bern', region: 'Bern und Umgebung', extras: 'Thun, Biel, Burgdorf' },
    { name: 'Basel', region: 'Basel und Nordwestschweiz', extras: 'Liestal, Rheinfelden, Aarau' },
    { name: 'Luzern', region: 'Zentralschweiz', extras: 'Zug, Schwyz, Altdorf' },
    { name: 'St. Gallen', region: 'Ostschweiz', extras: 'Appenzell, Herisau, Wil' },
    { name: 'Winterthur', region: 'Winterthur und Umgebung', extras: 'Frauenfeld, Schaffhausen' }
];

const pages = cities.map(city => ({
    name: `Italienischer Grosshändler ${city.name}`,
    url: `/italienischer-grosshaendler-${city.name.toLowerCase().replace(/\./g, '').replace(/ /g, '-')}`,
    meta_title: `Italienischer Lebensmittel Grosshändler ${city.name} | LAPA B2B`,
    meta_description: `LAPA liefert italienische Lebensmittel nach ${city.name}. Mozzarella, Pasta, Prosciutto für Restaurants. B2B Grosshandel, 6 Tage Lieferung. Jetzt anfragen!`,
    meta_keywords: `italienischer grosshändler ${city.name.toLowerCase()}, lebensmittel lieferant ${city.name.toLowerCase()}, restaurant belieferung ${city.name.toLowerCase()}, pizza zutaten ${city.name.toLowerCase()}`,
    content: `
<section class="s_text_block pt48 pb48 o_colored_level" style="background-color: #f8f9fa;">
    <div class="container">
        <div class="row">
            <div class="col-lg-8 offset-lg-2 text-center">
                <h1 class="display-4" style="color: #c41e3a;">Italienischer Grosshändler für ${city.name}</h1>
                <p class="lead mt-4">Ihr B2B-Partner für authentische italienische Lebensmittel in ${city.region}</p>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container">
        <div class="row">
            <div class="col-lg-6">
                <h2>Italienische Lebensmittel für ${city.name}</h2>
                <p>LAPA beliefert Restaurants, Pizzerien und Hotels in <strong>${city.name}</strong> und der gesamten Region ${city.region} mit authentischen italienischen Produkten.</p>
                <p>Über <strong>3.000 Produkte</strong> direkt aus Italien – frisch, qualitativ hochwertig und zu fairen B2B-Preisen.</p>
                <h3 class="mt-4">Liefergebiet</h3>
                <ul>
                    <li><strong>${city.name}</strong> Stadt und Agglomeration</li>
                    <li>${city.extras}</li>
                    <li>Gesamte Region ${city.region}</li>
                </ul>
            </div>
            <div class="col-lg-6">
                <h2>Unser Sortiment für Gastronomen</h2>
                <ul class="list-unstyled">
                    <li>✓ <strong>Frischprodukte:</strong> Mozzarella, Burrata, Ricotta</li>
                    <li>✓ <strong>Salumi:</strong> Prosciutto, Mortadella, Bresaola</li>
                    <li>✓ <strong>Pasta:</strong> Frisch und trocken, alle Formate</li>
                    <li>✓ <strong>Pizza-Zutaten:</strong> Mehl, Tomaten, Olivenöl</li>
                    <li>✓ <strong>Antipasti:</strong> Oliven, Artischocken, Bruschetta</li>
                    <li>✓ <strong>Tiefkühl:</strong> Meeresfrüchte, Gemüse, Desserts</li>
                    <li>✓ <strong>Wein &amp; Getränke:</strong> Italienische Auswahl</li>
                </ul>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48" style="background-color: #c41e3a; color: white;">
    <div class="container">
        <div class="row align-items-center">
            <div class="col-lg-8">
                <h2 style="color: white;">Lieferung nach ${city.name} – 6 Tage die Woche</h2>
                <p>Bestellen Sie bis 18 Uhr – wir liefern am nächsten Tag direkt zu Ihrem Restaurant in ${city.name}.</p>
                <ul>
                    <li>Kühlkette garantiert</li>
                    <li>Professionelle Lieferfahrzeuge</li>
                    <li>Flexible Lieferzeiten</li>
                </ul>
            </div>
            <div class="col-lg-4 text-center">
                <a href="/contactus" class="btn btn-light btn-lg" style="color: #c41e3a; font-weight: bold;">Kostenlose Beratung für Restaurants</a>
            </div>
        </div>
    </div>
</section>

<section class="s_text_block pt48 pb48">
    <div class="container text-center">
        <h2>Warum Gastronomen in ${city.name} LAPA wählen</h2>
        <div class="row mt-4">
            <div class="col-md-4">
                <h4>Direkt aus Italien</h4>
                <p>Authentische Produkte von ausgewählten Produzenten</p>
            </div>
            <div class="col-md-4">
                <h4>B2B-Preise</h4>
                <p>Faire Grosshandelskonditionen für Gastronomen</p>
            </div>
            <div class="col-md-4">
                <h4>Persönlicher Service</h4>
                <p>Deutschsprachige Beratung und Betreuung</p>
            </div>
        </div>
        <div class="mt-5">
            <a href="/shop" class="btn btn-outline-danger btn-lg">Sortiment entdecken</a>
            <a href="/contactus" class="btn btn-danger btn-lg ml-3">Jetzt anfragen</a>
        </div>
    </div>
</section>
`
}));

common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err || !uid) { console.log('Auth error'); return; }
    console.log('Authenticated, uid:', uid);
    console.log(`Creating ${pages.length} local SEO pages...\n`);

    let completed = 0;

    pages.forEach((page, index) => {
        const viewKey = `website.${page.url.replace(/\//g, '').replace(/-/g, '_')}`;
        const arch = `<t t-name="${viewKey}">
    <t t-call="website.layout">
        <div id="wrap" class="oe_structure oe_empty">
            ${page.content}
        </div>
    </t>
</t>`;

        const viewData = {
            name: page.name,
            type: 'qweb',
            key: viewKey,
            arch: arch,
            website_id: 1
        };

        models.methodCall('execute_kw', [db, uid, password, 'ir.ui.view', 'create', [viewData]], (err, viewId) => {
            if (err) {
                console.log(`❌ Error creating view for "${page.name}":`, err.message);
                completed++;
                return;
            }

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
                    console.log(`❌ Error creating page for "${page.name}":`, err.message);
                } else {
                    console.log(`✅ ${page.name}`);
                    console.log(`   https://www.lapa.ch${page.url}`);
                }

                completed++;
                if (completed === pages.length) {
                    console.log('\n=== Local SEO pages created! ===');
                }
            });
        });
    });
});
