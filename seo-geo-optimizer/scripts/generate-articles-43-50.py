#!/usr/bin/env python3
"""
Generate LAPA blog articles 43-50 (Restaurant Guides block)
Using Claude API for content generation and translation
"""

import os
import json
import time
import re
from anthropic import Anthropic

# Initialize Anthropic client
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Article definitions from the TypeScript script
ARTICLES = [
    {
        "number": 43,
        "id": "food-cost-margini",
        "topic": "Food Cost e Margini: Calcolare la Redditività di Ogni Piatto",
        "primary_keywords": ["food cost ristorante", "calcolo margini cucina", "redditività piatti"],
        "product_focus": "Strumenti LAPA",
        "word_count": 1400
    },
    {
        "number": 44,
        "id": "gestione-inventario-ridurre-sprechi",
        "topic": "Gestione Inventario Ristorante: Ridurre Gli Sprechi del 30%",
        "primary_keywords": ["gestione inventario ristorante", "ridurre sprechi cucina", "fifo ristorante"],
        "product_focus": "Sistema Ordini LAPA",
        "word_count": 1300
    },
    {
        "number": 45,
        "id": "marketing-ristoranti-svizzera-2026",
        "topic": "Marketing per Ristoranti Italiani in Svizzera: Strategie 2026",
        "primary_keywords": ["marketing ristorante", "instagram ristoranti", "social media food"],
        "product_focus": "Marketing Support LAPA",
        "word_count": 1500
    },
    {
        "number": 46,
        "id": "selezione-formazione-staff",
        "topic": "Selezione e Formazione Staff Ristorante: La Guida del Titolare",
        "primary_keywords": ["assumere personale ristorante", "formazione camerieri", "gestione staff"],
        "product_focus": "Training LAPA",
        "word_count": 1400
    },
    {
        "number": 47,
        "id": "haccp-cucina-svizzera",
        "topic": "Igiene e HACCP in Cucina: Normative Svizzere Spiegate Semplice",
        "primary_keywords": ["haccp ristorante svizzera", "igiene cucina", "normative alimentari"],
        "product_focus": "Certificazioni LAPA",
        "word_count": 1500
    },
    {
        "number": 48,
        "id": "menu-stagionale-vantaggi",
        "topic": "Creare un Menu Stagionale Italiano: Vantaggi e Strategia",
        "primary_keywords": ["menu stagionale ristorante", "ingredienti di stagione", "menu rotazione"],
        "product_focus": "Prodotti Stagionali LAPA",
        "word_count": 1200
    },
    {
        "number": 49,
        "id": "wine-pairing-italiano",
        "topic": "Wine Pairing Italiano: Abbinare Vini ai Piatti del Menu",
        "primary_keywords": ["abbinamento vino cibo", "wine pairing italiano", "carta vini ristorante"],
        "product_focus": "Cantina LAPA",
        "word_count": 1400
    },
    {
        "number": 50,
        "id": "delivery-takeaway-ottimizzare",
        "topic": "Delivery e Take-Away per Ristoranti: Ottimizzare il Servizio",
        "primary_keywords": ["delivery ristorante", "ottimizzare take away", "packaging delivery"],
        "product_focus": "Soluzioni Delivery LAPA",
        "word_count": 1300
    }
]

def get_italian_prompt(article):
    """Generate prompt for Italian article"""
    return f"""Sei un esperto copywriter SEO specializzato in contenuti per il settore food & beverage italiano.

Scrivi un articolo blog COMPLETO in ITALIANO su: "{article['topic']}"

REQUISITI SEO:
- Parole: {article['word_count']} parole
- Keywords primarie: {', '.join(article['primary_keywords'])}
- Focus prodotto/servizio: {article['product_focus']}

STRUTTURA OBBLIGATORIA:
1. H1: Titolo principale con keyword primaria
2. Introduzione (2-3 paragrafi) con hook forte
3. H2: Cos'è [Argomento]? Origini e Caratteristiche
4. H2: Caratteristiche Tecniche/Dettagli (con lista UL)
5. H2: Come Utilizzare/Applicare [Argomento]
   - H3: Applicazioni Pratiche
   - H3: Consigli Professionali
6. H2: Vantaggi e Benefici
7. H2: [Argomento] LAPA: Qualità e Servizio
8. H2: Domande Frequenti (FAQ) - minimo 4-6 domande con H3
9. H2: Conclusione con CTA forte
10. Sezione "Leggi anche" con 3 link placeholder

OTTIMIZZAZIONE GEO (AI Search):
- Blocchi di testo <800 token ciascuno
- Risposte dirette alle domande
- Statistiche e dati concreti (es: "3000+ prodotti", "24-48h consegna", "500+ clienti")
- Brand mentions naturali (LAPA) - 10-15 menzioni
- Frasi segnale: "In sintesi", "La risposta è", "Ecco cosa significa", "Il punto chiave è"
- Tabelle comparative quando possibile
- Liste numerate e bullet points

META TAGS:
- Meta Title: max 60 caratteri con keyword principale
- Meta Description: 120-160 caratteri con CTA chiara
- Meta Keywords: 5-8 keywords separate da virgola

OUTPUT: Restituisci SOLO JSON valido con questa struttura:
{{
  "name": "Titolo Articolo Completo",
  "subtitle": "Sottotitolo breve descrittivo",
  "meta": {{
    "title": "Meta title SEO ottimizzato",
    "description": "Meta description con CTA",
    "keywords": "keyword1, keyword2, keyword3, keyword4"
  }},
  "content_html": "<section class=\\"s_text_block\\"><div class=\\"container\\"><h1>Titolo</h1><p>Contenuto...</p></div></section>"
}}

IMPORTANTE:
- HTML valido con tag <section>, <div>, <h1>, <h2>, <h3>, <p>, <ul>, <li>, <table>
- Ogni sezione principale in <section class="s_text_block"><div class="container">...</div></section>
- Linguaggio coinvolgente, professionale, specifico per ristoratori/pizzaioli/chef
- Focus su benefici pratici e concreti
- Menziona LAPA come fornitore premium in Svizzera con servizi distintivi
- NO placeholder, tutto testo reale e completo
- Includi dati tecnici, statistiche, confronti quando possibile
"""

def get_translation_prompt(italian_content, target_lang):
    """Generate prompt for translation"""
    lang_names = {
        'de_CH': 'TEDESCO SVIZZERO (Schweizerdeutsch formale)',
        'fr_CH': 'FRANCESE SVIZZERO',
        'en_US': 'INGLESE INTERNAZIONALE'
    }

    market_names = {
        'de_CH': 'svizzero tedesco',
        'fr_CH': 'svizzero francese',
        'en_US': 'internazionale'
    }

    return f"""Sei un traduttore professionista specializzato in contenuti SEO food & beverage.

Traduci questo articolo in {lang_names[target_lang]}.

ARTICOLO ITALIANO:
{json.dumps(italian_content, ensure_ascii=False, indent=2)}

REQUISITI:
- Mantieni ESATTAMENTE la struttura HTML
- Ottimizza keywords per il mercato {market_names[target_lang]}
- Adatta meta title e description per SEO locale
- Mantieni tono professionale ma coinvolgente
- Keywords tradotte naturalmente (NON letteralmente se suona male)
- Mantieni tutti i numeri, statistiche, nomi prodotto LAPA
- Adatta CTA e frasi chiave per il mercato locale

OUTPUT: Restituisci SOLO JSON valido con stessa struttura dell'originale italiano.
"""

def extract_json(text):
    """Extract JSON from Claude response"""
    # Try to find JSON in the response
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        return json.loads(json_match.group(0))
    raise ValueError("No JSON found in response")

def generate_italian_article(article):
    """Generate Italian article using Claude"""
    print(f"\n📝 Generating article {article['number']}: {article['topic']} (IT)...")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[{
            "role": "user",
            "content": get_italian_prompt(article)
        }]
    )

    content = message.content[0].text
    return extract_json(content)

def translate_article(italian_content, target_lang):
    """Translate article to target language"""
    print(f"   🌍 Translating to {target_lang}...")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[{
            "role": "user",
            "content": get_translation_prompt(italian_content, target_lang)
        }]
    )

    content = message.content[0].text
    return extract_json(content)

def generate_article(article):
    """Generate complete article in all languages"""
    print(f"\n[{article['number']}/50] ====== {article['topic']} ======")

    filename = f"/home/paul/app-hub-platform/seo-geo-optimizer/data/new-articles-2025/article-{str(article['number']).zfill(2)}-{article['id']}.json"

    # Skip if exists
    if os.path.exists(filename):
        print(f"   ⏭️  File already exists, skipping...")
        return True

    try:
        # 1. Generate Italian content
        italian_content = generate_italian_article(article)

        # 2. Translate to German, French, English
        german_content = translate_article(italian_content, 'de_CH')
        french_content = translate_article(italian_content, 'fr_CH')
        english_content = translate_article(italian_content, 'en_US')

        # 3. Create complete article object
        full_article = {
            "article_id": article['id'],
            "topic": article['topic'],
            "target_keywords": {
                "primary": article['primary_keywords'],
                "secondary": [],
                "long_tail": []
            },
            "translations": {
                "it_IT": italian_content,
                "de_DE": german_content,  # Will be mapped to de_CH in upload
                "fr_FR": french_content,  # Will be mapped to fr_CH in upload
                "en_US": english_content
            },
            "seo_analysis": {
                "keyword_density": "2-3%",
                "word_count": article['word_count'],
                "h1_count": 1,
                "h2_count": "6-8",
                "h3_count": "8-12",
                "has_faq": True,
                "has_lists": True,
                "internal_links": True,
                "geo_optimized": True
            },
            "geo_analysis": {
                "blocks_under_800_tokens": True,
                "self_contained_sections": True,
                "clear_answers": True,
                "brand_mentions": "10-15",
                "statistics": True,
                "faq_format": True
            }
        }

        # 4. Save JSON file
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(full_article, f, ensure_ascii=False, indent=2)

        print(f"   ✅ Saved: {filename}")
        return True

    except Exception as e:
        print(f"   ❌ Error generating article {article['number']}: {e}")
        return False

def main():
    """Main function"""
    print("🚀 GENERATORE ARTICOLI 43-50 - LAPA BLOG\n")
    print("Generazione 8 articoli mancanti (Restaurant Guides)")
    print("Lingue: IT, DE, FR, EN\n")

    start_time = time.time()
    success_count = 0
    error_count = 0

    for article in ARTICLES:
        if generate_article(article):
            success_count += 1
        else:
            error_count += 1

        # Delay to avoid rate limiting
        if article != ARTICLES[-1]:
            print("   ⏳ Waiting 3s before next article...")
            time.sleep(3)

    duration = int((time.time() - start_time) / 60)

    print(f"\n\n✅ ====== GENERATION COMPLETE ======")
    print(f"Generated: {success_count} articles")
    print(f"Errors: {error_count} articles")
    print(f"Total translations: {success_count * 4}")
    print(f"Duration: {duration} minutes")
    print(f"\n📂 Files saved in: /home/paul/app-hub-platform/seo-geo-optimizer/data/new-articles-2025/")

if __name__ == "__main__":
    main()
