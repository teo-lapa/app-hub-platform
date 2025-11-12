/**
 * MODULO DI CONNESSIONE ODOO STAGING
 *
 * Gestisce la connessione e l'autenticazione con Odoo staging
 */

const Odoo = require('odoo-xmlrpc');

class OdooStagingConnect {
    constructor() {
        this.odoo = new Odoo({
            url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
            db: 'lapadevadmin-lapa-v2-main-7268478',
            username: 'apphubplatform@lapa.ch',
            password: 'apphubplatform2025'
        });

        this.uid = null;
        this.connected = false;
    }

    async connect() {
        if (this.connected) {
            return this.uid;
        }

        return new Promise((resolve, reject) => {
            this.odoo.connect((err, uid) => {
                if (err) {
                    console.error('Errore connessione Odoo:', err);
                    reject(err);
                    return;
                }

                this.uid = uid;
                this.connected = true;
                console.log(`✓ Connesso a Odoo staging (UID: ${uid})`);
                resolve(uid);
            });
        });
    }

    async execute_kw(model, method, params = [], kwargs = {}) {
        if (!this.connected) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.odoo.execute_kw(model, method, params, (err, value) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(value);
            });
        });
    }

    async search(model, domain = [], fields = [], limit = null, offset = 0, order = null) {
        const options = { fields };
        if (limit) options.limit = limit;
        if (offset) options.offset = offset;
        if (order) options.order = order;

        return this.execute_kw(model, 'search_read', [domain], options);
    }

    async read(model, ids, fields = []) {
        return this.execute_kw(model, 'read', [ids], { fields });
    }

    async create(model, values) {
        return this.execute_kw(model, 'create', [values]);
    }

    async write(model, ids, values) {
        return this.execute_kw(model, 'write', [ids, values]);
    }

    async unlink(model, ids) {
        return this.execute_kw(model, 'unlink', [ids]);
    }
}

// Esporta singleton
const instance = new OdooStagingConnect();
module.exports = instance;
