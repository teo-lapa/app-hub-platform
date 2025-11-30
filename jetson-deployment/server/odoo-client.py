#!/usr/bin/env python3
"""
Odoo XML-RPC Client (Python)
Client affidabile per chiamate Odoo usando xmlrpc.client nativo
Funziona 100% - testato e verificato
"""

import xmlrpc.client
import ssl
import json
import sys
import os
from typing import Dict, List, Any, Optional

# Disable SSL certificate verification (per ambienti dev Odoo)
ssl._create_default_https_context = ssl._create_unverified_context

class OdooClient:
    def __init__(self, url: str, db: str, username: str, password: str):
        self.url = url
        self.db = db
        self.username = username
        self.password = password
        self.uid: Optional[int] = None

        self.common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
        self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

    def authenticate(self) -> int:
        """Autentica e ottieni UID utente"""
        if self.uid:
            return self.uid

        self.uid = self.common.authenticate(self.db, self.username, self.password, {})

        if not self.uid:
            raise Exception("Odoo authentication failed")

        return self.uid

    def execute_kw(self, model: str, method: str, args: list = None, kwargs: dict = None) -> Any:
        """Esegui chiamata Odoo execute_kw"""
        uid = self.authenticate()

        if args is None:
            args = []
        if kwargs is None:
            kwargs = {}

        return self.models.execute_kw(
            self.db,
            uid,
            self.password,
            model,
            method,
            args,
            kwargs
        )

    def create_partner(self, partner_data: Dict[str, Any]) -> int:
        """
        Crea un nuovo partner (contatto/azienda) in Odoo

        Args:
            partner_data: Dictionary con i dati del partner
                - name (required): Nome del partner
                - is_company: True per azienda, False per persona (default: False)
                - email: Email
                - phone: Telefono fisso
                - mobile: Cellulare
                - street: Via e numero
                - zip: CAP
                - city: Città
                - country_id: ID del paese (21 = Switzerland)
                - vat: Partita IVA / UID
                - parent_id: ID del parent partner (per contatti aziendali)
                - function: Ruolo/posizione
                - comment: Note aggiuntive
                - type: 'contact', 'invoice', 'delivery', 'other'

        Returns:
            ID del partner creato
        """
        # Validazione dati minimi
        if 'name' not in partner_data or not partner_data['name']:
            raise ValueError("Partner name is required")

        # Crea il partner
        partner_id = self.execute_kw('res.partner', 'create', [[partner_data]])

        if isinstance(partner_id, list):
            partner_id = partner_id[0]

        return int(partner_id)

    def create_company_with_owners(
        self,
        company_data: Dict[str, Any],
        owners: List[Dict[str, Any]] = None,
        contact_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Crea un'azienda con proprietari e contatto originale

        Args:
            company_data: Dati dell'azienda (is_company=True)
            owners: Lista di proprietari/amministratori
            contact_data: Dati del contatto originale (dal biglietto/documento)

        Returns:
            {
                'company_id': int,
                'company': {...},
                'owners': [{id, name}, ...],
                'contact': {id, name} or None
            }
        """
        result = {
            'company_id': None,
            'company': {},
            'owners': [],
            'contact': None
        }

        # 1. Crea l'azienda
        company_data['is_company'] = True
        company_data['type'] = 'contact'

        company_id = self.create_partner(company_data)
        result['company_id'] = company_id

        # Leggi i dati dell'azienda creata
        company = self.execute_kw(
            'res.partner',
            'read',
            [[company_id]],
            {'fields': ['id', 'name', 'display_name', 'vat', 'email', 'phone']}
        )
        result['company'] = company[0] if company else {}

        # 2. Crea i proprietari/amministratori (se forniti)
        if owners:
            for owner_data in owners:
                owner_data['parent_id'] = company_id
                owner_data['is_company'] = False
                owner_data['type'] = 'contact'

                try:
                    owner_id = self.create_partner(owner_data)

                    # Leggi i dati del proprietario
                    owner = self.execute_kw(
                        'res.partner',
                        'read',
                        [[owner_id]],
                        {'fields': ['id', 'name', 'display_name', 'function']}
                    )

                    result['owners'].append(owner[0] if owner else {'id': owner_id, 'name': owner_data.get('name')})
                except Exception as e:
                    print(f"Warning: Failed to create owner {owner_data.get('name')}: {e}", file=sys.stderr)

        # 3. Crea il contatto originale (se fornito e diverso dall'azienda)
        if contact_data:
            contact_data['parent_id'] = company_id
            contact_data['is_company'] = False
            contact_data['type'] = 'contact'

            try:
                contact_id = self.create_partner(contact_data)

                # Leggi i dati del contatto
                contact = self.execute_kw(
                    'res.partner',
                    'read',
                    [[contact_id]],
                    {'fields': ['id', 'name', 'display_name', 'email', 'phone', 'mobile']}
                )

                result['contact'] = contact[0] if contact else {'id': contact_id, 'name': contact_data.get('name')}
            except Exception as e:
                print(f"Warning: Failed to create contact {contact_data.get('name')}: {e}", file=sys.stderr)

        return result

    def search_partner(self, domain: List = None, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Cerca partner in Odoo

        Args:
            domain: Dominio di ricerca Odoo (es: [['name', 'ilike', 'Mario']])
            limit: Numero massimo di risultati

        Returns:
            Lista di partner trovati
        """
        if domain is None:
            domain = []

        partners = self.execute_kw(
            'res.partner',
            'search_read',
            [domain],
            {'fields': ['id', 'name', 'display_name', 'email', 'phone', 'vat', 'is_company'], 'limit': limit}
        )

        return partners if partners else []


def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Missing command. Usage: odoo-client.py <command> <json_data>'
        }))
        sys.exit(1)

    command = sys.argv[1]

    # Carica configurazione da env
    odoo_url = os.getenv('ODOO_URL')
    odoo_db = os.getenv('ODOO_DB')
    odoo_username = os.getenv('ODOO_USERNAME')
    odoo_password = os.getenv('ODOO_PASSWORD')

    if not all([odoo_url, odoo_db, odoo_username, odoo_password]):
        print(json.dumps({
            'success': False,
            'error': 'Missing Odoo configuration in environment variables'
        }))
        sys.exit(1)

    try:
        client = OdooClient(odoo_url, odoo_db, odoo_username, odoo_password)

        if command == 'create_partner':
            # Leggi dati partner da stdin o argv[2]
            if len(sys.argv) > 2:
                partner_data = json.loads(sys.argv[2])
            else:
                partner_data = json.load(sys.stdin)

            partner_id = client.create_partner(partner_data)

            # Leggi il partner creato
            partner = client.execute_kw(
                'res.partner',
                'read',
                [[partner_id]],
                {'fields': ['id', 'name', 'display_name', 'email', 'phone', 'mobile', 'vat']}
            )

            print(json.dumps({
                'success': True,
                'partner_id': partner_id,
                'partner': partner[0] if partner else {}
            }))

        elif command == 'create_company_complete':
            # Crea azienda con proprietari e contatto
            if len(sys.argv) > 2:
                data = json.loads(sys.argv[2])
            else:
                data = json.load(sys.stdin)

            company_data = data.get('company', {})
            owners = data.get('owners', [])
            contact_data = data.get('contact')

            result = client.create_company_with_owners(company_data, owners, contact_data)

            print(json.dumps({
                'success': True,
                'result': result
            }))

        elif command == 'search_partner':
            # Cerca partner
            if len(sys.argv) > 2:
                data = json.loads(sys.argv[2])
            else:
                data = json.load(sys.stdin)

            domain = data.get('domain', [])
            limit = data.get('limit', 10)

            partners = client.search_partner(domain, limit)

            print(json.dumps({
                'success': True,
                'partners': partners,
                'count': len(partners)
            }))

        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown command: {command}'
            }))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'type': type(e).__name__
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
