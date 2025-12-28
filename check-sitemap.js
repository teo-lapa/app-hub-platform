const xmlrpc = require('xmlrpc');
const url = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-main-7268478';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/object' });

common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err) { console.log('Auth error:', err.message); return; }
    if (!uid) { console.log('Auth failed - no uid'); return; }

    console.log('Authenticated, uid:', uid);

    // Check website configuration for sitemap settings
    models.methodCall('execute_kw', [db, uid, password, 'website', 'fields_get', [], { attributes: ['string', 'type'] }], (err, fields) => {
        if (err) { console.log('Error:', err.message); return; }

        // Filter for sitemap-related fields
        const sitemapFields = Object.keys(fields).filter(f =>
            f.toLowerCase().includes('sitemap') ||
            f.toLowerCase().includes('seo') ||
            f.toLowerCase().includes('robot')
        );

        console.log('\nSitemap/SEO related fields in website model:');
        sitemapFields.forEach(f => {
            console.log('  -', f, ':', fields[f].string, '(' + fields[f].type + ')');
        });

        // Also read current website settings
        models.methodCall('execute_kw', [db, uid, password, 'website', 'search_read', [[['id', '=', 1]]], { fields: sitemapFields }], (err, website) => {
            if (err) { console.log('Error reading website:', err.message); return; }
            console.log('\nCurrent website sitemap/SEO settings:');
            console.log(JSON.stringify(website, null, 2));
        });
    });
});
