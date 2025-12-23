/**
 * GENERATORE DIRETTO - SINGOLO ARTICOLO
 * Genera un articolo alla volta senza API esterna
 * Lo script principale chiamerà Claude Code per generare ogni articolo
 */

import { writeFileSync } from 'fs';

interface ArticleSpec {
  id: string;
  topic: string;
  primary_keywords: string[];
  product_focus: string;
  word_count: number;
}

// Prendi l'articolo spec come input dalla command line
const articleIndex = parseInt(process.argv[2] || '0');

// Lista completa dei 60 articoli (come in generate-all-60-articles.ts)
const ARTICLES: ArticleSpec[] = [
  // BLOCCO 1: PRODOTTI STELLA (30 articoli)
  {
    id: 'fiordilatte-pizza-napoletana',
    topic: 'Fiordilatte per Pizza Napoletana STG: La Scelta dei Maestri Pizzaioli',
    primary_keywords: ['fiordilatte pizza napoletana', 'mozzarella pizza stg', 'fiordilatte pizzeria'],
    product_focus: 'Fiordilatte STG LAPA',
    word_count: 1200
  },
  {
    id: 'burrata-andria-dop',
    topic: 'Burrata di Andria DOP: Il Gioiello Cremoso della Puglia',
    primary_keywords: ['burrata andria dop', 'burrata ristoranti', 'burrata pugliese'],
    product_focus: 'Burrata Andria DOP LAPA',
    word_count: 1000
  },
  {
    id: 'fior-latte-gerola',
    topic: 'Fior di Latte Gerola: Tradizione Valtellinese per la Cucina d\'Elite',
    primary_keywords: ['fior di latte gerola', 'formaggi valtellina', 'mozzarella valtellinese'],
    product_focus: 'Fior di Latte Gerola LAPA',
    word_count: 900
  },
  // ... altri articoli ...
];

function main() {
  if (articleIndex < 0 || articleIndex >= ARTICLES.length) {
    console.error(`Invalid article index: ${articleIndex}. Valid range: 0-${ARTICLES.length - 1}`);
    process.exit(1);
  }

  const article = ARTICLES[articleIndex];

  console.log(`\nArticolo da generare:`);
  console.log(`ID: ${article.id}`);
  console.log(`Topic: ${article.topic}`);
  console.log(`Keywords: ${article.primary_keywords.join(', ')}`);
  console.log(`Word count: ${article.word_count}`);
  console.log(`\nQuesto script deve essere chiamato da Claude Code per generare il contenuto.`);
}

main();
