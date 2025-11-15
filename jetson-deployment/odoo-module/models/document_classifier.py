# -*- coding: utf-8 -*-

import base64
import logging
import requests
from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class DocumentClassifier(models.Model):
    _name = 'document.classifier'
    _description = 'AI Document Classifier'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(string='Document Name', required=True, tracking=True)
    attachment_id = fields.Many2one('ir.attachment', string='Attachment', required=True, ondelete='cascade')

    # Classification results
    document_type = fields.Selection([
        ('invoice', 'Fattura'),
        ('purchase_order', 'Ordine Acquisto'),
        ('sales_order', 'Ordine Vendita'),
        ('receipt', 'Ricevuta'),
        ('delivery_note', 'DDT'),
        ('quote', 'Preventivo'),
        ('contract', 'Contratto'),
        ('payment_slip', 'Bollettino Pagamento'),
        ('tax_document', 'Documento Fiscale'),
        ('photo', 'Foto'),
        ('other', 'Altro')
    ], string='Document Type', tracking=True)

    confidence = fields.Float(string='Confidence %', tracking=True)
    classification_state = fields.Selection([
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], string='Status', default='pending', tracking=True)

    # Extracted details
    supplier_name = fields.Char(string='Supplier', tracking=True)
    customer_name = fields.Char(string='Customer', tracking=True)
    document_number = fields.Char(string='Document Number', tracking=True)
    document_date = fields.Date(string='Document Date', tracking=True)
    amount_total = fields.Float(string='Total Amount', tracking=True)
    currency_code = fields.Char(string='Currency', default='EUR')

    extracted_text = fields.Text(string='Extracted Text (OCR)')
    line_items = fields.Text(string='Line Items (JSON)')

    # Processing info
    ocr_duration = fields.Integer(string='OCR Duration (ms)')
    classification_duration = fields.Integer(string='Classification Duration (ms)')
    total_duration = fields.Integer(string='Total Duration (ms)')
    error_message = fields.Text(string='Error Message')

    # Links to Odoo records
    partner_id = fields.Many2one('res.partner', string='Linked Partner')
    purchase_order_id = fields.Many2one('purchase.order', string='Linked Purchase Order')
    sale_order_id = fields.Many2one('sale.order', string='Linked Sale Order')
    invoice_id = fields.Many2one('account.move', string='Linked Invoice')
    picking_id = fields.Many2one('stock.picking', string='Linked Picking')

    @api.model
    def create(self, vals):
        """Override create to auto-classify on creation"""
        record = super(DocumentClassifier, self).create(vals)

        # Auto-classify if attachment is provided
        if record.attachment_id and record.classification_state == 'pending':
            record.action_classify()

        return record

    def action_classify(self):
        """Classify document using Jetson OCR Server"""
        self.ensure_one()

        if not self.attachment_id:
            raise UserError('No attachment found to classify')

        # Get OCR server URL from settings
        ocr_server_url = self.env['ir.config_parameter'].sudo().get_param(
            'document_classifier.jetson_ocr_url',
            'http://jetson-nano.local:3100'
        )

        webhook_secret = self.env['ir.config_parameter'].sudo().get_param(
            'document_classifier.webhook_secret',
            ''
        )

        # Update state
        self.classification_state = 'processing'

        try:
            # Prepare file for upload
            file_content = base64.b64decode(self.attachment_id.datas)
            file_name = self.attachment_id.name

            _logger.info(f'Classifying document: {file_name} ({len(file_content)} bytes)')

            # Call Jetson OCR API
            headers = {}
            if webhook_secret:
                headers['X-Webhook-Secret'] = webhook_secret

            files = {
                'file': (file_name, file_content, self.attachment_id.mimetype or 'application/pdf')
            }

            response = requests.post(
                f'{ocr_server_url}/api/v1/ocr/analyze',
                files=files,
                headers=headers,
                timeout=120  # 2 minutes timeout
            )

            response.raise_for_status()
            result = response.json()

            if not result.get('success'):
                raise Exception(result.get('error', 'Unknown error'))

            # Extract classification data
            classification = result.get('result', {})
            processing = result.get('processing', {})

            # Update record with results
            self.write({
                'classification_state': 'completed',
                'document_type': classification.get('type', 'other'),
                'confidence': classification.get('confidence', 0),
                'supplier_name': classification.get('details', {}).get('supplier'),
                'customer_name': classification.get('details', {}).get('customer'),
                'document_number': classification.get('details', {}).get('number'),
                'document_date': classification.get('details', {}).get('date'),
                'amount_total': classification.get('details', {}).get('amount'),
                'currency_code': classification.get('details', {}).get('currency', 'EUR'),
                'extracted_text': classification.get('extractedText', ''),
                'ocr_duration': processing.get('ocrDuration', 0),
                'classification_duration': processing.get('classificationDuration', 0),
                'total_duration': processing.get('totalDuration', 0)
            })

            # Store line items as JSON
            items = classification.get('details', {}).get('items', [])
            if items:
                import json
                self.line_items = json.dumps(items, indent=2)

            # Try to link to existing partner
            self._auto_link_partner()

            # Post message to chatter
            self.message_post(
                body=f"✅ Document classified as <b>{classification.get('typeName')}</b> "
                     f"with {classification.get('confidence')}% confidence.<br/>"
                     f"Processing time: {processing.get('totalDuration')}ms"
            )

            _logger.info(f'Classification successful: {file_name} -> {self.document_type} ({self.confidence}%)')

        except requests.RequestException as e:
            error_msg = f'Failed to connect to OCR server: {str(e)}'
            _logger.error(error_msg)
            self.write({
                'classification_state': 'failed',
                'error_message': error_msg
            })
            raise UserError(error_msg)

        except Exception as e:
            error_msg = f'Classification error: {str(e)}'
            _logger.error(error_msg)
            self.write({
                'classification_state': 'failed',
                'error_message': error_msg
            })
            raise UserError(error_msg)

    def _auto_link_partner(self):
        """Auto-link to partner based on supplier/customer name"""
        self.ensure_one()

        partner_name = self.supplier_name or self.customer_name
        if not partner_name:
            return

        # Search for partner (fuzzy match)
        partner = self.env['res.partner'].search([
            ('name', 'ilike', partner_name)
        ], limit=1)

        if partner:
            self.partner_id = partner
            _logger.info(f'Auto-linked to partner: {partner.name}')

    def action_create_purchase_order(self):
        """Create purchase order from classified document"""
        self.ensure_one()

        if self.document_type not in ['invoice', 'purchase_order', 'delivery_note']:
            raise UserError('Can only create purchase order from invoice, purchase order, or delivery note')

        if not self.partner_id:
            raise UserError('Please link a supplier partner first')

        # Create purchase order
        po_vals = {
            'partner_id': self.partner_id.id,
            'date_order': self.document_date or fields.Date.today(),
            'notes': f'Created from AI-classified document: {self.name}'
        }

        po = self.env['purchase.order'].create(po_vals)

        # Parse line items and create PO lines
        if self.line_items:
            import json
            items = json.loads(self.line_items)

            for item in items:
                description = item.get('description', '')
                quantity = item.get('quantity', 1)
                price = item.get('unitPrice', 0)

                # Try to find matching product
                product = self._find_product_by_description(description)

                if product:
                    self.env['purchase.order.line'].create({
                        'order_id': po.id,
                        'product_id': product.id,
                        'name': description,
                        'product_qty': quantity,
                        'price_unit': price,
                        'date_planned': fields.Date.today()
                    })

        self.purchase_order_id = po

        # Open the created PO
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'purchase.order',
            'res_id': po.id,
            'view_mode': 'form',
            'target': 'current'
        }

    def _find_product_by_description(self, description):
        """Find product by description (simple keyword matching)"""
        if not description:
            return None

        # Search by name or default code
        product = self.env['product.product'].search([
            '|',
            ('name', 'ilike', description),
            ('default_code', 'ilike', description)
        ], limit=1)

        return product

    @api.model
    def classify_attachment(self, attachment_id):
        """Helper method to classify an attachment (can be called from other modules)"""
        attachment = self.env['ir.attachment'].browse(attachment_id)

        if not attachment.exists():
            raise UserError(f'Attachment {attachment_id} not found')

        # Check if already classified
        existing = self.search([('attachment_id', '=', attachment_id)], limit=1)
        if existing:
            if existing.classification_state == 'failed':
                # Retry failed classification
                existing.action_classify()
            return existing

        # Create new classification record
        classifier = self.create({
            'name': attachment.name,
            'attachment_id': attachment_id
        })

        return classifier


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    classification_id = fields.Many2one('document.classifier', string='AI Classification', compute='_compute_classification')
    is_classified = fields.Boolean(string='Classified', compute='_compute_classification', store=True)

    @api.depends('name')
    def _compute_classification(self):
        for record in self:
            classification = self.env['document.classifier'].search([
                ('attachment_id', '=', record.id)
            ], limit=1)

            record.classification_id = classification
            record.is_classified = bool(classification and classification.classification_state == 'completed')

    def action_classify_document(self):
        """Classify this attachment"""
        self.ensure_one()

        classifier = self.env['document.classifier'].classify_attachment(self.id)

        # Open classification record
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'document.classifier',
            'res_id': classifier.id,
            'view_mode': 'form',
            'target': 'current'
        }
