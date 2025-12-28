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

    // First read current robots.txt
    models.methodCall('execute_kw', [db, uid, password, 'website', 'search_read', [[['id', '=', 1]]], { fields: ['robots_txt'] }], (err, website) => {
        if (err) { console.log('Read error:', err.message); return; }

        console.log('\nCurrent robots.txt:');
        console.log(website[0].robots_txt);

        // Update the sitemap URL from sitemap.xml to sitemap-1.xml
        let newRobotsTxt = website[0].robots_txt.replace(
            'Sitemap: https://www.lapa.ch/sitemap.xml',
            'Sitemap: https://www.lapa.ch/sitemap-1.xml'
        );

        console.log('\n--- UPDATING to: ---');
        console.log(newRobotsTxt);

        // Write the updated robots.txt
        models.methodCall('execute_kw', [db, uid, password, 'website', 'write', [[1], { robots_txt: newRobotsTxt }]], (err, result) => {
            if (err) { console.log('Write error:', err.message); return; }
            console.log('\n✅ robots.txt updated successfully! Result:', result);
        });
    });
});
