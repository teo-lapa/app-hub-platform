import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Configura timeout per Vercel Pro Plan (60 secondi)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Article {
  id: string;
  title: string;
  content: string;
  category: 'Curiosita Food' | 'Gestione Ristorante';
  source: string;
  imageUrl: string;
  date: string;
  preview: string;
}

const ARTICLES_FILE = path.join(process.cwd(), 'data', 'food-articles.json');

// Assicura che la directory data esista
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Salva articoli nel file JSON
function saveArticles(articles: Article[]) {
  ensureDataDir();
  const data = {
    date: new Date().toISOString().split('T')[0],
    articles,
  };
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Genera un singolo articolo con Claude
async function generateArticle(category: 'Curiosita Food' | 'Gestione Ristorante', index: number): Promise<Article> {
  const prompts = {
    'Curiosita Food': `Scrivi un articolo giornalistico originale e interessante (400-500 parole) su una curiosità del mondo food.

IMPORTANTE: Scegli un argomento DIVERSO e UNICO ogni volta. Non ripetere mai lo stesso argomento.

Focus su: cucina mediterranea.
Deve essere informativo, coinvolgente e ricco di dettagli interessanti.

Esempi di argomenti (ma sentiti libero di sceglierne altri):
- Storia e origine di un piatto tradizionale
- Ingredienti rari e pregiati (tartufi, zafferano, caviale, etc.)
- Tecniche culinarie antiche o moderne
- Tradizioni gastronomiche regionali
- Scoperte scientifiche sul cibo
- Trend culinari emergenti
- Formaggi, salumi, vini particolari
- Street food tipici
- Dolci e dessert storici
- Spezie e aromi

STRUTTURA:
- Titolo accattivante (max 80 caratteri)
- Contenuto articolo (400-500 parole, diviso in 3-4 paragrafi)
- Fonte credibile (nome sito/rivista gastronomica)

Rispondi in formato JSON:
{
  "title": "Il titolo dell'articolo",
  "content": "Il contenuto completo diviso in paragrafi separati da \\n\\n",
  "source": "Nome della fonte credibile"
}`,

    'Gestione Ristorante': `Scrivi un articolo professionale (400-500 parole) su strategie e best practices per la gestione di ristoranti.

IMPORTANTE: Scegli un argomento DIVERSO e UNICO ogni volta. Non ripetere mai lo stesso argomento.

Esempi di argomenti (ma sentiti libero di sceglierne altri):
- Gestione staff e formazione
- Ottimizzazione food cost e margini
- Marketing digitale e social media
- Customer experience e servizio
- Gestione inventario e fornitori
- Tecnologie per la ristorazione
- Sostenibilità e riduzione sprechi
- Revenue management e pricing
- Design e layout del locale
- Gestione recensioni online
- Wine list e beverage management

STRUTTURA:
- Titolo professionale (max 80 caratteri)
- Contenuto articolo (400-500 parole, diviso in 3-4 paragrafi)
- Fonte credibile (rivista/sito di business ristorazione)

Rispondi in formato JSON:
{
  "title": "Il titolo dell'articolo",
  "content": "Il contenuto completo diviso in paragrafi separati da \\n\\n",
  "source": "Nome della fonte credibile"
}`,
  };

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompts[category],
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Estrai JSON dalla risposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Formato risposta non valido');
    }

    const articleData = JSON.parse(jsonMatch[0]);

    // Genera preview (primi 150 caratteri del contenuto)
    const preview = articleData.content.substring(0, 150).trim() + '...';

    // URL immagini Unsplash correlate alla categoria
    const imageUrls = {
      'Curiosita Food': [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
      ],
      'Gestione Ristorante': [
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
        'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800',
      ],
    };

    const categoryImages = imageUrls[category];
    const imageUrl = categoryImages[index % categoryImages.length];

    return {
      id: `${category.toLowerCase().replace(' ', '-')}-${index}-${Date.now()}`,
      title: articleData.title,
      content: articleData.content,
      category,
      source: articleData.source,
      imageUrl,
      date: new Date().toISOString(),
      preview,
    };
  } catch (error) {
    console.error(`Error generating article ${category} ${index}:`, error);
    throw error;
  }
}

export async function POST() {
  try {
    console.log('Starting article generation...');

    // Genera tutti i 6 articoli IN PARALLELO per essere più veloce
    console.log('Generating all 6 articles in parallel...');

    const articlePromises = [
      // 3 articoli "Curiosita Food"
      generateArticle('Curiosita Food', 0),
      generateArticle('Curiosita Food', 1),
      generateArticle('Curiosita Food', 2),
      // 3 articoli "Gestione Ristorante"
      generateArticle('Gestione Ristorante', 0),
      generateArticle('Gestione Ristorante', 1),
      generateArticle('Gestione Ristorante', 2),
    ];

    // Aspetta che tutti gli articoli siano generati
    const articles = await Promise.all(articlePromises);

    // Salva articoli
    saveArticles(articles);

    console.log('Articles generated successfully!');

    return NextResponse.json({
      success: true,
      message: '6 articoli generati con successo',
      articles,
      date: new Date().toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Error generating articles:', error);
    return NextResponse.json(
      {
        error: 'Errore nella generazione degli articoli',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
