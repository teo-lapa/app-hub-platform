const xmlrpc = require('xmlrpc');
const url = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-main-7268478';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ url: url + '/xmlrpc/2/object' });

common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err || !uid) { console.log('Auth error'); return; }

    // Get a simple page with its full content
    models.methodCall('execute_kw', [db, uid, password, 'website.page', 'search_read',
        [[['url', '=', '/privacy']]],
        { fields: ['name', 'url', 'view_id', 'arch', 'arch_base', 'website_meta_title', 'website_meta_description', 'website_meta_keywords', 'is_published'] }
    ], (err, pages) => {
        if (err) { console.log('Error:', err.message); return; }
        if (pages.length === 0) { console.log('Page not found'); return; }

        const page = pages[0];
        console.log('Page:', page.name);
        console.log('URL:', page.url);
        console.log('view_id:', page.view_id);
        console.log('is_published:', page.is_published);
        console.log('\nArch (first 2000 chars):');
        console.log(page.arch ? page.arch.substring(0, 2000) : 'null');
    });
});
