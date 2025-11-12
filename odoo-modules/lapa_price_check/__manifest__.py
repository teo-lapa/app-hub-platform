# -*- coding: utf-8 -*-
{
    'name': 'LAPA Price Check',
    'version': '1.0.0',
    'category': 'Sales',
    'summary': 'Sistema di controllo prezzi vendita per Paul e Laura',
    'description': """
        Price Check Review System
        ==========================

        Questo modulo permette di tracciare e gestire i controlli prezzi sui prodotti:
        - Status tracking (pending/reviewed/blocked)
        - History di chi ha controllato e quando
        - Integrazione con listini per blocco prezzi
        - Note e commenti sui controlli

        Utilizzato dall'app NextJS "Controllo Prezzi"
    """,
    'author': 'LAPA',
    'website': 'https://lapa.ch',
    'depends': ['base', 'sale', 'product'],
    'data': [
        'security/ir.model.access.csv',
        'views/price_review_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
