# -*- coding: utf-8 -*-
{
    'name': 'Document Classifier AI',
    'version': '17.0.1.0.0',
    'category': 'Document Management',
    'summary': 'AI-powered document classification with Jetson OCR Server',
    'description': """
Document Classifier AI
======================

Automatically classify and extract data from uploaded documents using AI:

Features:
---------
* Automatic document type detection (Invoice, Order, Receipt, DDT, etc.)
* OCR for scanned documents via Jetson Nano GPU acceleration
* Extract key information: supplier, customer, amount, date, line items
* Integrate with Purchase, Sales, Inventory, and Accounting workflows
* Batch processing for multiple documents
* Real-time classification on document upload

Use Cases:
----------
* Warehouse arrivals: Auto-extract purchase order numbers from supplier invoices
* Invoice verification: Compare extracted amounts with expected values
* Order entry: Extract line items from customer orders
* Document archiving: Auto-tag and categorize documents

Technical:
----------
* Powered by Kimi K2 AI model via OpenRouter
* GPU-accelerated OCR with Tesseract on NVIDIA Jetson Nano
* REST API integration with Jetson OCR Server
* Supports PDF and image formats (JPEG, PNG, TIFF)
    """,
    'author': 'App Hub Platform',
    'website': 'https://app-hub-platform.vercel.app',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'mail',
        'web',
        'purchase',
        'sale',
        'stock',
        'account'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/document_classifier_views.xml',
        'views/res_config_settings_views.xml',
        'data/ir_cron_data.xml'
    ],
    'demo': [],
    'installable': True,
    'application': True,
    'auto_install': False,
    'external_dependencies': {
        'python': ['requests']
    }
}
