# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class PriceReview(models.Model):
    _name = 'x.price.review'
    _description = 'Price Review Tracking'
    _order = 'create_date DESC'
    _rec_name = 'display_name'

    # ========== RELATIONSHIPS ==========
    product_id = fields.Many2one(
        'product.product',
        string='Product',
        required=True,
        ondelete='cascade',
        index=True,
        help='Prodotto da controllare'
    )

    order_id = fields.Many2one(
        'sale.order',
        string='Sale Order',
        required=True,
        ondelete='cascade',
        index=True,
        help='Ordine di vendita'
    )

    order_line_id = fields.Many2one(
        'sale.order.line',
        string='Order Line',
        required=True,
        ondelete='cascade',
        help='Riga ordine specifica'
    )

    company_id = fields.Many2one(
        'res.company',
        string='Company',
        required=True,
        default=lambda self: self.env.company,
        index=True
    )

    # ========== STATUS ==========
    status = fields.Selection([
        ('pending', 'Da Controllare'),
        ('reviewed', 'Controllato'),
        ('blocked', 'Prezzo Bloccato')
    ], string='Status', default='pending', required=True, index=True, tracking=True)

    # ========== REVIEW INFO ==========
    reviewed_by = fields.Char(
        string='Controllato Da',
        help='Email dell\'utente che ha controllato (Paul/Laura)'
    )

    reviewed_at = fields.Datetime(
        string='Data Controllo',
        help='Quando è stato controllato'
    )

    # ========== BLOCK INFO ==========
    blocked_by = fields.Char(
        string='Bloccato Da',
        help='Email dell\'utente che ha bloccato il prezzo'
    )

    blocked_at = fields.Datetime(
        string='Data Blocco',
        help='Quando è stato bloccato il prezzo'
    )

    # ========== NOTE ==========
    note = fields.Text(
        string='Note',
        help='Note sul controllo o blocco'
    )

    # ========== COMPUTED FIELDS (per display) ==========
    product_name = fields.Char(
        related='product_id.name',
        string='Nome Prodotto',
        readonly=True,
        store=True
    )

    product_code = fields.Char(
        related='product_id.default_code',
        string='Codice Prodotto',
        readonly=True,
        store=True
    )

    order_name = fields.Char(
        related='order_id.name',
        string='Numero Ordine',
        readonly=True,
        store=True
    )

    customer_id = fields.Many2one(
        related='order_id.partner_id',
        string='Cliente',
        readonly=True,
        store=True
    )

    customer_name = fields.Char(
        related='order_id.partner_id.name',
        string='Nome Cliente',
        readonly=True,
        store=True
    )

    price_unit = fields.Float(
        related='order_line_id.price_unit',
        string='Prezzo Venduto',
        readonly=True,
        digits='Product Price'
    )

    product_cost = fields.Float(
        related='product_id.standard_price',
        string='Costo Prodotto',
        readonly=True,
        digits='Product Price'
    )

    display_name = fields.Char(
        string='Display Name',
        compute='_compute_display_name',
        store=True
    )

    # ========== COMPUTED METHODS ==========
    @api.depends('product_name', 'order_name')
    def _compute_display_name(self):
        for record in self:
            record.display_name = f"{record.product_name or 'Product'} - {record.order_name or 'Order'}"

    # ========== CONSTRAINTS ==========
    _sql_constraints = [
        (
            'unique_product_order',
            'UNIQUE(product_id, order_id, company_id)',
            'Solo un record di controllo per prodotto per ordine!'
        )
    ]

    @api.constrains('status', 'reviewed_by', 'blocked_by')
    def _check_status_consistency(self):
        """Verifica coerenza status con campi reviewed/blocked"""
        for record in self:
            if record.status == 'reviewed' and not record.reviewed_by:
                raise ValidationError(
                    _("Status 'Controllato' richiede il campo 'Controllato Da'")
                )
            if record.status == 'blocked' and not record.blocked_by:
                raise ValidationError(
                    _("Status 'Prezzo Bloccato' richiede il campo 'Bloccato Da'")
                )

    # ========== BUSINESS LOGIC METHODS ==========
    def action_mark_reviewed(self, reviewed_by, note=None):
        """Marca come controllato"""
        self.ensure_one()
        self.write({
            'status': 'reviewed',
            'reviewed_by': reviewed_by,
            'reviewed_at': fields.Datetime.now(),
            'note': note or self.note,
        })
        return True

    def action_mark_blocked(self, blocked_by, note=None):
        """Marca come bloccato"""
        self.ensure_one()
        self.write({
            'status': 'blocked',
            'blocked_by': blocked_by,
            'blocked_at': fields.Datetime.now(),
            'note': note or self.note,
        })
        return True

    def action_mark_pending(self):
        """Reset a pending"""
        self.ensure_one()
        self.write({
            'status': 'pending',
            'reviewed_by': False,
            'reviewed_at': False,
            'blocked_by': False,
            'blocked_at': False,
        })
        return True
