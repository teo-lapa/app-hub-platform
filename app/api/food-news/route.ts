import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

interface ArticlesData {
  date: string;
  articles: Article[];
}

const ARTICLES_FILE = path.join(process.cwd(), 'data', 'food-articles.json');

// Leggi articoli dal file
function readArticles(): ArticlesData | null {
  try {
    if (!fs.existsSync(ARTICLES_FILE)) {
      return null;
    }
    const data = fs.readFileSync(ARTICLES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading articles:', error);
    return null;
  }
}

// Verifica se gli articoli sono di oggi
function areArticlesFromToday(articlesData: ArticlesData | null): boolean {
  if (!articlesData) return false;
  const today = new Date().toISOString().split('T')[0];
  return articlesData.date === today;
}

export async function GET(request: Request) {
  try {
    console.log('📰 [FOOD-NEWS] GET request received');

    // Leggi articoli esistenti
    let articlesData = readArticles();
    console.log('📰 [FOOD-NEWS] Articles data:', articlesData ? 'Found' : 'Not found');

    // Se non esistono articoli o sono vecchi, genera nuovi articoli
    if (!areArticlesFromToday(articlesData)) {
      console.log('📰 [FOOD-NEWS] No articles for today, generating new ones...');

      // Usa l'host della richiesta corrente invece di hardcodare l'URL
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      console.log('📰 [FOOD-NEWS] Base URL:', baseUrl);

      const generateUrl = `${baseUrl}/api/food-news/generate`;
      console.log('📰 [FOOD-NEWS] Calling generate endpoint:', generateUrl);

      const generateResponse = await fetch(generateUrl, {
        method: 'POST',
      });

      console.log('📰 [FOOD-NEWS] Generate response status:', generateResponse.status);

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        console.error('📰 [FOOD-NEWS] Generate failed with:', errorText);
        throw new Error(`Failed to generate articles: ${generateResponse.status} - ${errorText}`);
      }

      const generateData = await generateResponse.json();
      console.log('📰 [FOOD-NEWS] Articles generated successfully');

      return NextResponse.json({
        success: true,
        articles: generateData.articles,
        date: generateData.date,
        generated: true,
      });
    }

    // Ritorna articoli esistenti
    console.log('📰 [FOOD-NEWS] Returning existing articles');
    return NextResponse.json({
      success: true,
      articles: articlesData.articles,
      date: articlesData.date,
      generated: false,
    });
  } catch (error) {
    console.error('📰 [FOOD-NEWS] ERROR:', error);
    console.error('📰 [FOOD-NEWS] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        error: 'Errore nel recupero degli articoli',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
