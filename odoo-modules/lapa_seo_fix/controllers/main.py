# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
from odoo.addons.website_sale.controllers.main import WebsiteSale
import re


class WebsiteSaleSEO(WebsiteSale):
    """
    Override del controller website_sale per forzare l'uso
    dei campi SEO personalizzati nelle pagine prodotto.
    """

    def _prepare_product_values(self, product, category, search, **kwargs):
        """
        Override del metodo che prepara i valori per la pagina prodotto.
        Forza l'uso di website_meta_description se compilato.
        """
        values = super()._prepare_product_values(product, category, search, **kwargs)

        # Forza i meta tag personalizzati se presenti
        if product.website_meta_description:
            values['website_meta_description'] = product.website_meta_description
        else:
            # Genera automaticamente se non presente
            values['website_meta_description'] = self._generate_seo_description(product)

        if product.website_meta_title:
            values['website_meta_title'] = product.website_meta_title
        else:
            # Genera titolo SEO-friendly
            values['website_meta_title'] = self._generate_seo_title(product)

        if product.website_meta_keywords:
            values['website_meta_keywords'] = product.website_meta_keywords
        else:
            values['website_meta_keywords'] = self._generate_seo_keywords(product)

        return values

    def _generate_seo_title(self, product):
        """
        Genera un titolo SEO ottimizzato (30-60 caratteri).
        Pattern: "[Nome Pulito] | LAPA Svizzera"
        """
        name = product.name or ''
        # Pulisci il nome da codici tecnici
        clean_name = re.sub(r'\s+CONF\s+\d+\w*\s*', ' ', name)
        clean_name = re.sub(r'\s+CRT\s+\w+', '', clean_name)
        clean_name = re.sub(r'\s+', ' ', clean_name).strip()

        suffix = " | LAPA Svizzera"
        max_name_len = 60 - len(suffix)

        if len(clean_name) > max_name_len:
            clean_name = clean_name[:max_name_len - 3].rsplit(' ', 1)[0] + "..."

        return clean_name + suffix

    def _generate_seo_description(self, product):
        """
        Genera una meta description SEO ottimizzata (120-160 caratteri).
        """
        name = product.name or ''
        clean_name = re.sub(r'\s+CONF\s+\d+\w*\s*', ' ', name)
        clean_name = re.sub(r'\s+CRT\s+\w+', '', clean_name)
        clean_name = re.sub(r'\s+', ' ', clean_name).strip()

        # Ottieni categoria
        category = ''
        if product.public_categ_ids:
            category = product.public_categ_ids[0].display_name
        elif product.categ_id:
            category = product.categ_id.display_name

        # Template in italiano
        parts = [f"Acquista {clean_name} da LAPA, grossista prodotti italiani in Svizzera"]
        if category:
            parts.append(category)
        parts.append("Consegna rapida, qualità garantita.")

        description = ". ".join(parts)

        if len(description) > 160:
            description = description[:157] + "..."

        return description

    def _generate_seo_keywords(self, product):
        """
        Genera keywords SEO dal nome prodotto e categoria.
        """
        keywords = []

        # Keywords dal nome prodotto
        name_words = re.sub(r'[^\w\s]', '', product.name.lower()).split()
        keywords.extend([w for w in name_words if len(w) > 3 and w not in ['conf', 'crt']])

        # Categoria
        if product.public_categ_ids:
            cat_words = product.public_categ_ids[0].name.lower().split()
            keywords.extend([w for w in cat_words if len(w) > 3])

        # Keywords base LAPA
        base_keywords = ['lapa', 'svizzera', 'grossista', 'prodotti italiani', 'gastronomia']
        keywords.extend(base_keywords)

        # Rimuovi duplicati e limita
        unique_keywords = list(dict.fromkeys(keywords))[:10]

        return ', '.join(unique_keywords)
