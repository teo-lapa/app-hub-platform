import json

# Carico file JSON
with open('/home/paul/app-hub-platform/seo-geo-optimizer/data/new-articles/article-14-pizza-napoletana-stg-ricetta.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

it_html = data['translations']['it_IT']['content_html']

# Le traduzioni complete al 100% includono TUTTO il contenuto italiano tradotto
# Visto che ho già generato traduzioni parziali, ora le completo al 100%

print("Script pronto per generare traduzioni complete")
print(f"Contenuto IT: {len(it_html)} caratteri")
print(f"Per raggiungere 95-100%, le traduzioni devono essere ~20,000+ caratteri")

