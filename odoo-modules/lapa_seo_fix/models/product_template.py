# -*- coding: utf-8 -*-
from odoo import models, api
from odoo.tools import html2plaintext
import re


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    def _default_website_meta(self):
        """
        Override del metodo che genera i meta tag di default.
        Se website_meta_description è compilato, lo usa.
        Altrimenti genera automaticamente.
        """
        res = super()._default_website_meta()

        # Usa il campo personalizzato se compilato
        if self.website_meta_description:
            res['default_meta_description'] = self.website_meta_description

        if self.website_meta_title:
            res['default_opengraph']['og:title'] = self.website_meta_title
            res['default_twitter']['twitter:title'] = self.website_meta_title

        return res

    @api.model
    def _get_default_seo_meta_description(self):
        """
        Genera una meta description SEO-friendly se non specificata.
        Pattern: "[Nome Prodotto]. Prodotto italiano di qualità da LAPA, grossista in Svizzera. [Categoria]. Ordina ora."
        """
        self.ensure_one()

        # Se il campo è già compilato, usalo
        if self.website_meta_description:
            return self.website_meta_description

        # Altrimenti genera automaticamente
        name = self.name or ''
        # Pulisci il nome da codici tecnici
        clean_name = re.sub(r'\s+CONF\s+\d+\w*\s*', ' ', name)
        clean_name = re.sub(r'\s+CRT\s+\w+', '', clean_name)
        clean_name = re.sub(r'\s+', ' ', clean_name).strip()

        # Ottieni categoria
        category = ''
        if self.public_categ_ids:
            category = self.public_categ_ids[0].display_name
        elif self.categ_id:
            category = self.categ_id.display_name

        # Costruisci la descrizione
        parts = [f"Acquista {clean_name} da LAPA, grossista prodotti italiani in Svizzera"]
        if category:
            parts.append(category)
        parts.append("Consegna rapida, qualità garantita.")

        description = ". ".join(parts)

        # Tronca a 160 caratteri max
        if len(description) > 160:
            description = description[:157] + "..."

        return description


class ProductPublicCategory(models.Model):
    _inherit = 'product.public.category'

    def _default_website_meta(self):
        """
        Override per le categorie prodotto.
        """
        res = super()._default_website_meta()

        if self.website_meta_description:
            res['default_meta_description'] = self.website_meta_description

        if self.website_meta_title:
            res['default_opengraph']['og:title'] = self.website_meta_title
            res['default_twitter']['twitter:title'] = self.website_meta_title

        return res
