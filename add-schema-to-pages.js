const xmlrpc = require('xmlrpc');
const url = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-main-7268478';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/object' });

// Schema.org JSON-LD for each page
const schemaData = {
    '/italienischer-lebensmittel-grosshaendler-zuerich': {
        city: 'Zürich',
        region: 'Zürich'
    },
    '/pizza-zutaten-grosshandel-zuerich': {
        city: 'Zürich',
        region: 'Zürich',
        specialty: 'Pizza Zutaten'
    },
    '/lieferant-italienische-restaurants-schweiz': {
        city: 'Schweiz',
        region: 'Schweiz',
        national: true
    },
    '/italienischer-grosshaendler-bern': { city: 'Bern', region: 'Bern' },
    '/italienischer-grosshaendler-basel': { city: 'Basel', region: 'Basel-Stadt' },
    '/italienischer-grosshaendler-luzern': { city: 'Luzern', region: 'Luzern' },
    '/italienischer-grosshaendler-st-gallen': { city: 'St. Gallen', region: 'St. Gallen' },
    '/italienischer-grosshaendler-winterthur': { city: 'Winterthur', region: 'Zürich' }
};

function generateSchema(pageUrl, data) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": `https://www.lapa.ch${pageUrl}#business`,
        "name": "LAPA - Italienischer Lebensmittel Grosshändler",
        "alternateName": "LAPA Zero Pensieri",
        "description": `B2B Grosshändler für italienische Lebensmittel in ${data.city}. Lieferung von Mozzarella, Pasta, Prosciutto, Pizza-Zutaten für Restaurants und Gastronomie.`,
        "url": `https://www.lapa.ch${pageUrl}`,
        "logo": "https://www.lapa.ch/web/image/website/1/logo",
        "image": "https://www.lapa.ch/web/image/website/1/logo",
        "telephone": "+41 91 946 00 09",
        "email": "info@lapa.ch",
        "priceRange": "$$",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Via Bossi 12",
            "addressLocality": "Balerna",
            "postalCode": "6828",
            "addressRegion": "Ticino",
            "addressCountry": "CH"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 45.8489,
            "longitude": 9.0058
        },
        "areaServed": {
            "@type": "Place",
            "name": data.national ? "Schweiz" : data.city
        },
        "serviceArea": {
            "@type": "GeoCircle",
            "geoMidpoint": {
                "@type": "GeoCoordinates",
                "latitude": 46.8182,
                "longitude": 8.2275
            },
            "geoRadius": "200000"
        },
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": "06:00",
                "closes": "18:00"
            }
        ],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Italienische Lebensmittel",
            "itemListElement": [
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Mozzarella di Bufala" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Prosciutto di Parma" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Pasta Fresca" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Pizza Mehl Caputo" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "San Marzano Tomaten" } }
            ]
        },
        "sameAs": [
            "https://www.instagram.com/lapalapach1/",
            "https://www.facebook.com/lapalapach/"
        ],
        "potentialAction": {
            "@type": "OrderAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://www.lapa.ch/contactus",
                "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
            },
            "deliveryMethod": "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"
        }
    };

    return JSON.stringify(schema, null, 2);
}

common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err || !uid) { console.log('Auth error'); return; }
    console.log('Authenticated, uid:', uid);

    const pageUrls = Object.keys(schemaData);
    let completed = 0;

    pageUrls.forEach(pageUrl => {
        // Find the page
        models.methodCall('execute_kw', [db, uid, password, 'website.page', 'search_read',
            [[['url', '=', pageUrl]]],
            { fields: ['id', 'name', 'view_id'] }
        ], (err, pages) => {
            if (err || pages.length === 0) {
                console.log(`Page not found: ${pageUrl}`);
                completed++;
                return;
            }

            const page = pages[0];
            const viewId = page.view_id[0];

            // Get current view arch
            models.methodCall('execute_kw', [db, uid, password, 'ir.ui.view', 'search_read',
                [[['id', '=', viewId]]],
                { fields: ['arch'] }
            ], (err, views) => {
                if (err || views.length === 0) {
                    console.log(`View not found for: ${pageUrl}`);
                    completed++;
                    return;
                }

                const currentArch = views[0].arch;
                const schema = generateSchema(pageUrl, schemaData[pageUrl]);

                // Add schema script before closing </div>
                const schemaScript = `
<script type="application/ld+json">
${schema}
</script>`;

                // Insert schema before the last </div> in wrap
                let newArch = currentArch.replace(
                    '</div>\n    </t>\n</t>',
                    `${schemaScript}\n</div>\n    </t>\n</t>`
                );

                // Update the view
                models.methodCall('execute_kw', [db, uid, password, 'ir.ui.view', 'write',
                    [[viewId], { arch: newArch }]
                ], (err, result) => {
                    if (err) {
                        console.log(`❌ Error updating ${pageUrl}:`, err.message);
                    } else {
                        console.log(`✅ Schema.org added: ${pageUrl}`);
                    }
                    completed++;
                    if (completed === pageUrls.length) {
                        console.log('\n=== All pages updated with Schema.org! ===');
                    }
                });
            });
        });
    });
});
