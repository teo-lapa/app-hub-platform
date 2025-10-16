import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force dynamic rendering - necessario per request.url
export const dynamic = 'force-dynamic';

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

    // Se non esistono articoli, crea un set vuoto
    if (!articlesData) {
      console.log('📰 [FOOD-NEWS] No articles found, creating empty set');
      articlesData = {
        date: new Date().toISOString().split('T')[0],
        articles: []
      };
    }

    // Ritorna sempre gli articoli esistenti (anche se vecchi)
    // L'utente può generarne di nuovi manualmente cliccando sul bottone
    console.log('📰 [FOOD-NEWS] Returning existing articles');

    return NextResponse.json({
      success: true,
      articles: articlesData.articles,
      date: articlesData.date,
      generated: false,
      isToday: areArticlesFromToday(articlesData)
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
