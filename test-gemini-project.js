const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI('AIzaSyBuHNSxFt4Ua-5ZNj7s5vo5yVTXqcfbKN8');

async function test() {
  console.log('📄 Carico PDF...');
  const pdfBuffer = fs.readFileSync('C:\\Users\\lapa\\Desktop\\SAN GIORGIO.pdf');
  const base64 = pdfBuffer.toString('base64');

  console.log('🤖 Chiamo Gemini 2.5 Flash...');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json'
    }
  });

  const prompt = `Estrai i dati dalla fattura.

La tabella prodotti ha queste colonne IN ORDINE (da sinistra a destra):
ARTICOLO | LOTTO | DESCRIZIONE | UM | QUANTITA' | QTA' x CARTONE | PREZZO UNITARIO | % SCONTI | IMPORTO | DT. SCAD. | IVA

ATTENZIONE COLONNA QUANTITA':
- Colonna QUANTITA': contiene SOLO NUMERI (es: 18, 54, 8, 5, 1, 2)
- Colonna QTA' x CARTONE: contiene TESTO (es: KG 5, PZ 50, CT 30)
- USA la colonna QUANTITA' (solo numeri)!

Esempio riga:
A0334SG | 25233 | ARAN DI RISO SUGO 25 g | CT | 18 | KG 5 | 29,51 | 25,0 10,0 | 358,55 | 12/02/27 | 69
→ quantita = 18 (NON 5!)

Output JSON:
{
  "fornitore": "nome fornitore",
  "numero_fattura": "numero",
  "data_fattura": "YYYY-MM-DD",
  "products": [
    {
      "article_code": "A0334SG",
      "description": "ARAN DI RISO SUGO 25 g",
      "quantity": 18,
      "unit": "CT",
      "lot_number": "25233",
      "expiry_date": "2027-02-12"
    }
  ]
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64
      }
    },
    prompt
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const json = JSON.parse(cleaned);

  console.log('\n✅ RISULTATO:');
  console.log(JSON.stringify(json, null, 2));

  console.log('\n📊 QUANTITÀ ESTRATTE:');
  json.products.forEach(p => {
    console.log(`${p.article_code}: ${p.quantity} ${p.unit}`);
  });
}

test().catch(console.error);
