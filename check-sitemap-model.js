const xmlrpc = require('xmlrpc');
const url = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-main-7268478';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/object' });

common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err || !uid) { console.log('Auth error'); return; }
    console.log('Authenticated, uid:', uid);

    // Check for installed modules related to sitemap
    models.methodCall('execute_kw', [db, uid, password, 'ir.module.module', 'search_read',
        [[['name', 'ilike', 'sitemap'], ['state', '=', 'installed']]],
        { fields: ['name', 'shortdesc', 'state'] }
    ], (err, modules) => {
        if (err) { console.log('Module search error:', err.message); return; }
        console.log('\nInstalled sitemap modules:');
        if (modules.length === 0) {
            console.log('  None found');
        } else {
            modules.forEach(m => console.log('  -', m.name, ':', m.shortdesc));
        }

        // Also check for website_seo module
        models.methodCall('execute_kw', [db, uid, password, 'ir.module.module', 'search_read',
            [[['name', 'ilike', 'seo'], ['state', '=', 'installed']]],
            { fields: ['name', 'shortdesc', 'state'] }
        ], (err, seoModules) => {
            if (err) { console.log('SEO module search error:', err.message); return; }
            console.log('\nInstalled SEO modules:');
            if (seoModules.length === 0) {
                console.log('  None found');
            } else {
                seoModules.forEach(m => console.log('  -', m.name, ':', m.shortdesc));
            }

            // Check for website module
            models.methodCall('execute_kw', [db, uid, password, 'ir.module.module', 'search_read',
                [[['name', '=', 'website'], ['state', '=', 'installed']]],
                { fields: ['name', 'shortdesc', 'state', 'installed_version'] }
            ], (err, websiteModule) => {
                if (err) { console.log('Website module search error:', err.message); return; }
                console.log('\nWebsite module:');
                if (websiteModule.length > 0) {
                    console.log('  Version:', websiteModule[0].installed_version);
                }

                // Try to access sitemap-related controllers
                console.log('\n--- Checking routes ---');
                models.methodCall('execute_kw', [db, uid, password, 'ir.http', 'search_read',
                    [[['name', 'ilike', 'sitemap']]],
                    { fields: ['name'] }
                ], (err, routes) => {
                    if (err) {
                        console.log('Route check error (normal if model not accessible):', err.message);
                    } else {
                        console.log('Sitemap routes:', routes);
                    }
                });
            });
        });
    });
});
