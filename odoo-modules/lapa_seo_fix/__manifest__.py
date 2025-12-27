# -*- coding: utf-8 -*-
{
    'name': 'LAPA SEO Fix',
    'version': '17.0.1.0.0',
    'category': 'Website',
    'summary': 'Forza l\'uso dei campi SEO personalizzati per prodotti e categorie',
    'description': """
        Questo modulo sovrascrive il comportamento di default di Odoo
        per i meta tag SEO delle pagine prodotto.

        Invece di generare automaticamente meta description generiche,
        usa i valori personalizzati inseriti nei campi:
        - website_meta_title
        - website_meta_description
        - website_meta_keywords

        Se questi campi sono vuoti, mantiene il comportamento di fallback.
    """,
    'author': 'LAPA SA',
    'website': 'https://www.lapa.ch',
    'depends': ['website_sale'],
    'data': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
