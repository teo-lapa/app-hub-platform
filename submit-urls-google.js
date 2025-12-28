// URLs to submit to Google Search Console
const newPages = [
    // Thematic pages
    'https://www.lapa.ch/italienischer-lebensmittel-grosshaendler-zuerich',
    'https://www.lapa.ch/pizza-zutaten-grosshandel-zuerich',
    'https://www.lapa.ch/lieferant-italienische-restaurants-schweiz',
    // Local pages
    'https://www.lapa.ch/italienischer-grosshaendler-bern',
    'https://www.lapa.ch/italienischer-grosshaendler-basel',
    'https://www.lapa.ch/italienischer-grosshaendler-luzern',
    'https://www.lapa.ch/italienischer-grosshaendler-st-gallen',
    'https://www.lapa.ch/italienischer-grosshaendler-winterthur'
];

console.log('=== URLs da sottomettere a Google Search Console ===\n');
console.log('Vai su: https://search.google.com/search-console\n');
console.log('Per ogni URL:');
console.log('1. Menu → "Controllo URL"');
console.log('2. Incolla URL');
console.log('3. Clicca "Richiedi indicizzazione"\n');
console.log('URLs:\n');
newPages.forEach((url, i) => console.log(`${i+1}. ${url}`));
