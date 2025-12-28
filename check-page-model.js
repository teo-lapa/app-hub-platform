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

    // Get website.page fields
    models.methodCall('execute_kw', [db, uid, password, 'website.page', 'fields_get', [], { attributes: ['string', 'type', 'required'] }], (err, fields) => {
        if (err) { console.log('Error:', err.message); return; }

        console.log('\nwebsite.page fields:');
        const importantFields = ['name', 'url', 'website_meta_title', 'website_meta_description', 'website_meta_keywords',
                                  'is_published', 'website_id', 'view_id', 'arch', 'arch_base', 'content'];

        Object.keys(fields).forEach(f => {
            if (importantFields.includes(f) || f.includes('meta') || f.includes('seo')) {
                console.log('  -', f, ':', fields[f].string, '(' + fields[f].type + ')', fields[f].required ? 'REQUIRED' : '');
            }
        });

        // Get an example page to understand the structure
        models.methodCall('execute_kw', [db, uid, password, 'website.page', 'search_read', [[['url', '!=', false]]],
            { fields: ['name', 'url', 'website_meta_title', 'is_published', 'view_id'], limit: 3 }], (err, pages) => {
            if (err) { console.log('Error:', err.message); return; }
            console.log('\nExample pages:');
            pages.forEach(p => {
                console.log('  -', p.name, '| URL:', p.url, '| Published:', p.is_published);
            });
        });
    });
});
