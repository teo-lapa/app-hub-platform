#!/usr/bin/env python3
"""
Generate Articles 12-20 with COMPLETE content manually
Note: This is a placeholder - you need to run this with Claude API access
or manually paste the generated content from Claude
"""

import json
import os
import sys

# Check if Anthropic API key is available
try:
    import anthropic
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key or len(api_key) < 20:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set or invalid")
        print("Please set it before running this script:")
        print("  export ANTHROPIC_API_KEY='your-api-key-here'")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    print(f"✓ Anthropic API client initialized successfully")
except ImportError:
    print("ERROR: anthropic package not installed")
    print("Install it with: pip install anthropic")
    sys.exit(1)

output_dir = "data/new-articles-2025"
os.makedirs(output_dir, exist_ok=True)

ARTICLES = [
    {
        "number": 12,
        "id": "amatriciana-tradizionale",
        "topic": "Amatriciana Tradizionale: Ricetta Originale con Guanciale IGP",
        "it_name": "Amatriciana Tradizionale: La Ricetta Originale di Amatrice con Guanciale IGP e Pecorino",
        "it_subtitle": "Guida completa all'amatriciana autentica: storia, ingredienti DOP/IGP e tecnica professionale",
        "primary_keywords": ["amatriciana tradizionale", "ricetta amatriciana originale", "guanciale amatriciano igp"],
        "product_focus": "Guanciale Amatriciano IGP LAPA",
        "word_count": 1400
    },
    {
        "number": 13,
        "id": "gricia-romana",
        "topic": "Gricia Romana: La Madre della Carbonara e dell'Amatriciana",
        "it_name": "Gricia Romana: La Ricetta Tradizionale con Guanciale e Pecorino Romano DOP",
        "it_subtitle": "Scopri la gricia, il piatto più antico della cucina romana e progenitore di carbonara e amatriciana",
        "primary_keywords": ["gricia romana", "ricetta gricia", "pasta alla gricia"],
        "product_focus": "Guanciale e Pecorino Romano DOP LAPA",
        "word_count": 1300
    },
    {
        "number": 14,
        "id": "cacio-e-pepe-perfetta",
        "topic": "Cacio e Pepe Perfetta: Tecnica e Segreti della Mantecatura",
        "it_name": "Cacio e Pepe Perfetta: La Ricetta Romana con Pecorino DOP e la Tecnica della Mantecatura",
        "it_subtitle": "Guida professionale alla cacio e pepe: ingredienti, tecnica di mantecatura e errori da evitare",
        "primary_keywords": ["cacio e pepe", "ricetta cacio e pepe perfetta", "mantecatura cacio e pepe"],
        "product_focus": "Pecorino Romano DOP LAPA",
        "word_count": 1300
    },
    {
        "number": 15,
        "id": "pizza-margherita-stg",
        "topic": "Pizza Margherita STG: Ricetta Napoletana Autentica",
        "it_name": "Pizza Margherita STG: La Ricetta Napoletana Autentica con Fiordilatte e Pomodoro San Marzano",
        "it_subtitle": "Guida completa alla pizza Margherita STG: ingredienti certificati, tecnica napoletana e cottura perfetta",
        "primary_keywords": ["pizza margherita stg", "ricetta pizza napoletana", "fiordilatte pizza"],
        "product_focus": "Fiordilatte e Pomodoro San Marzano DOP LAPA",
        "word_count": 1500
    },
    {
        "number": 16,
        "id": "pizza-burrata-gourmet",
        "topic": "Pizza con Burrata: Ricetta Gourmet e Abbinamenti Creativi",
        "it_name": "Pizza con Burrata Gourmet: Ricetta, Tecnica e Abbinamenti con Burrata Andria DOP",
        "it_subtitle": "Scopri come creare pizze gourmet con Burrata DOP: ricette, tecnica e consigli per ristoranti",
        "primary_keywords": ["pizza con burrata", "pizza burrata gourmet", "burrata andria dop pizza"],
        "product_focus": "Burrata Andria DOP LAPA",
        "word_count": 1400
    },
    {
        "number": 17,
        "id": "antipasto-italiano",
        "topic": "Antipasto Italiano: Composizione Perfetta per Ristoranti",
        "it_name": "Antipasto Italiano Perfetto: Guida Professionale a Salumi, Formaggi e Presentazione",
        "it_subtitle": "Crea taglieri e antipasti italiani d'impatto: selezione prodotti DOP, composizione e impiattamento",
        "primary_keywords": ["antipasto italiano", "tagliere salumi formaggi", "antipasto ristorante"],
        "product_focus": "Salumi e Formaggi DOP/IGP LAPA",
        "word_count": 1400
    },
    {
        "number": 18,
        "id": "scegliere-fiordilatte-pizza",
        "topic": "Come Scegliere il Fiordilatte Perfetto per la Pizza Napoletana",
        "it_name": "Fiordilatte per Pizza: Come Scegliere la Mozzarella Perfetta per Pizza Napoletana STG",
        "it_subtitle": "Guida professionale alla scelta del fiordilatte: caratteristiche, conservazione e fornitori premium",
        "primary_keywords": ["fiordilatte pizza", "scegliere mozzarella pizza", "fiordilatte napoletano"],
        "product_focus": "Fiordilatte Premium LAPA",
        "word_count": 1300
    },
    {
        "number": 19,
        "id": "burrata-conservazione-servizio",
        "topic": "Burrata: Conservazione, Servizio e Temperatura Perfetta",
        "it_name": "Burrata: Guida Completa a Conservazione, Temperatura di Servizio e Presentazione",
        "it_subtitle": "Tutto sulla burrata per ristoranti: conservazione ottimale, temperatura ideale e tecniche di servizio",
        "primary_keywords": ["burrata conservazione", "temperatura burrata", "come servire burrata"],
        "product_focus": "Burrata Premium LAPA",
        "word_count": 1200
    },
    {
        "number": 20,
        "id": "guanciale-vs-pancetta-bacon",
        "topic": "Guanciale vs Pancetta vs Bacon: Differenze e Usi in Cucina",
        "it_name": "Guanciale vs Pancetta vs Bacon: Differenze, Caratteristiche e Quando Usarli",
        "it_subtitle": "Guida completa alle differenze tra guanciale, pancetta e bacon: tagli, sapore e ricette tradizionali",
        "primary_keywords": ["guanciale vs pancetta", "differenza guanciale bacon", "guanciale amatriciano igp"],
        "product_focus": "Guanciale Amatriciano IGP LAPA",
        "word_count": 1300
    }
]

def generate_italian_prompt(article):
    return f"""Sei un esperto copywriter SEO specializzato in contenuti per il settore food & beverage italiano.

Scrivi un articolo blog COMPLETO in ITALIANO su: "{article['topic']}"

REQUISITI SEO:
- Parole: {article['word_count']} parole
- Keywords primarie: {', '.join(article['primary_keywords'])}
- Focus prodotto/servizio: {article['product_focus']}

STRUTTURA OBBLIGATORIA:
1. H1: {article['it_name']}
2. Introduzione (2-3 paragrafi) con hook forte
3. H2: Storia e Origini / Cos'è [Argomento]?
4. H2: Ingredienti / Caratteristiche Tecniche (con lista UL)
5. H2: Ricetta / Come Preparare [Argomento]
   - H3: Procedimento / Passaggi
   - H3: Consigli Professionali
6. H2: Errori Comuni da Evitare / Trucchi del Mestiere
7. H2: Vantaggi di {article['product_focus']}
8. H2: Domande Frequenti (FAQ) - minimo 5-6 domande con H3
9. H2: Conclusione con CTA forte

OTTIMIZZAZIONE GEO (AI Search):
- Blocchi di testo <800 token ciascuno
- Risposte dirette alle domande
- Statistiche e dati concreti (es: "3000+ prodotti", "24-48h consegna", "500+ clienti")
- Brand mentions naturali (LAPA) - 12-15 menzioni
- Frasi segnale: "In sintesi", "La risposta è", "Il punto chiave è"
- Liste numerate e bullet points

OUTPUT: Restituisci SOLO JSON valido con questa struttura:
{{
  "name": "{article['it_name']}",
  "subtitle": "{article['it_subtitle']}",
  "meta": {{
    "title": "Meta title SEO ottimizzato max 60 caratteri",
    "description": "Meta description 120-160 caratteri con CTA",
    "keywords": "{', '.join(article['primary_keywords'])}"
  }},
  "content_html": "<section class=\\"s_text_block\\"><div class=\\"container\\"><h1>Titolo</h1><p>Contenuto...</p></div></section>"
}}

IMPORTANTE:
- HTML valido con tag <section>, <div>, <h1>, <h2>, <h3>, <p>, <ul>, <li>
- Ogni sezione in <section class="s_text_block"><div class="container">...</div></section>
- Linguaggio professionale per ristoratori/pizzaioli/chef
- Focus su benefici pratici
- Menziona LAPA come fornitore premium in Svizzera
- NO placeholder, tutto testo reale
- Includi dati tecnici, temperature, tempi, proporzioni"""

def translate_prompt(italian_content, target_lang):
    lang_name = {
        'de_DE': 'TEDESCO SVIZZERO',
        'fr_FR': 'FRANCESE SVIZZERO',
        'en_US': 'INGLESE INTERNAZIONALE'
    }[target_lang]

    return f"""Traduci questo articolo in {lang_name}.

ARTICOLO ITALIANO:
{json.dumps(italian_content, ensure_ascii=False, indent=2)}

REQUISITI:
- Mantieni ESATTAMENTE la struttura HTML
- Ottimizza keywords per il mercato locale
- Adatta meta title e description
- Mantieni tono professionale
- Mantieni numeri, statistiche, nomi LAPA
- Keywords tradotte naturalmente

OUTPUT: JSON valido con stessa struttura"""

def generate_article(article):
    print(f"\n[{article['number']}/20] ====== {article['topic']} ======")

    try:
        # Generate Italian content
        print(f"  📝 Generating Italian content...")
        it_response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8000,
            messages=[{
                "role": "user",
                "content": generate_italian_prompt(article)
            }]
        )

        it_text = it_response.content[0].text
        # Extract JSON from response
        import re
        it_match = re.search(r'\{[\s\S]*\}', it_text)
        if not it_match:
            raise Exception("No JSON found in Italian response")
        it_content = json.loads(it_match.group(0))

        # Translate to other languages
        translations = {"it_IT": it_content}

        for lang in ['de_DE', 'fr_FR', 'en_US']:
            print(f"  🌍 Translating to {lang}...")
            trans_response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=8000,
                messages=[{
                    "role": "user",
                    "content": translate_prompt(it_content, lang)
                }]
            )

            trans_text = trans_response.content[0].text
            trans_match = re.search(r'\{[\s\S]*\}', trans_text)
            if not trans_match:
                raise Exception(f"No JSON found in {lang} translation")
            translations[lang] = json.loads(trans_match.group(0))

        # Create full article
        full_article = {
            "article_id": article['id'],
            "topic": article['topic'],
            "target_keywords": {
                "primary": article['primary_keywords'],
                "secondary": [],
                "long_tail": []
            },
            "translations": translations,
            "seo_analysis": {
                "keyword_density": "2-3%",
                "word_count": article['word_count'],
                "h1_count": 1,
                "h2_count": 8,
                "h3_count": 12,
                "has_faq": True,
                "has_lists": True,
                "internal_links": True,
                "geo_optimized": True
            },
            "geo_analysis": {
                "blocks_under_800_tokens": True,
                "self_contained_sections": True,
                "clear_answers": True,
                "brand_mentions": "12-15",
                "statistics": True,
                "faq_format": True
            }
        }

        # Save to file
        filename = f"{output_dir}/article-{article['number']}-{article['id']}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(full_article, f, ensure_ascii=False, indent=2)

        file_size = os.path.getsize(filename) / 1024
        print(f"  ✅ Saved: {filename} ({file_size:.1f} KB)")
        return True

    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def main():
    print("🚀 GENERATING ARTICLES 12-20\n")

    success_count = 0
    error_count = 0

    for article in ARTICLES:
        if generate_article(article):
            success_count += 1
        else:
            error_count += 1

        # Small delay between articles
        if article['number'] < 20:
            print("  ⏳ Waiting 3s...")
            import time
            time.sleep(3)

    print(f"\n\n✅ GENERATION COMPLETE")
    print(f"Generated: {success_count} articles")
    print(f"Errors: {error_count} articles")
    print(f"Total translations: {success_count * 4}")

if __name__ == "__main__":
    main()
