const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDAsJxrNXDOekSoT-YW_t1VENOvi7PYEmA');

app.use(express.static('public'));
app.use(express.json());

// Endpoint per analizzare il PDF
app.post('/analyze-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    console.log('📄 Analisi PDF:', req.file.originalname);

    const pdfBuffer = fs.readFileSync(req.file.path);
    const base64PDF = pdfBuffer.toString('base64');

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
  "prodotti": [
    {
      "codice": "A0334SG",
      "lotto": "25233",
      "nome": "ARAN DI RISO SUGO 25 g",
      "unita_misura": "CT",
      "quantita": 18,
      "scadenza": "2027-02-12"
    }
  ]
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64PDF
        }
      },
      prompt
    ]);

    const text = result.response.text();

    fs.unlinkSync(req.file.path);

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);

    console.log('✅ Completato');

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Errore:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Crea la cartella uploads se non esiste
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Crea la cartella public se non esiste
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

const PORT = 8080;
app.listen(PORT, () => {
  console.log('🚀 Server PDF Reader avviato!');
  console.log(`📡 http://localhost:${PORT}`);
  console.log('');
  console.log('📝 Per usare:');
  console.log('1. Apri il browser su http://localhost:8080');
  console.log('2. Carica un PDF');
  console.log('3. Vedi i risultati!');
});
