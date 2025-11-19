/**
 * Web Search Service
 *
 * Cerca informazioni aziendali su Internet usando:
 * 1. Google Custom Search API (primario)
 * 2. Tavily API (fallback)
 */

interface CompanySearchResult {
  found: boolean;
  legalName?: string;
  website?: string;
  address?: {
    street?: string;
    zip?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  uid?: string; // P.IVA / UID
  businessActivity?: string;
  companyType?: string;
  creditInfo?: string;
  source: string;
  searchQuery: string;
  rawData?: any;
}

/**
 * Cerca un'azienda usando Google Custom Search API
 */
async function searchWithGoogle(
  companyName: string,
  location?: string
): Promise<CompanySearchResult> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.warn('[Google Search] API key o Search Engine ID mancanti');
    throw new Error('Google Search not configured');
  }

  // Costruisci query ottimizzata
  let query = `${companyName}`;
  if (location) {
    query += ` ${location}`;
  }
  query += ' Svizzera Switzerland';

  console.log('[Google Search] 🔍 Company name:', companyName);
  console.log('[Google Search] 📍 Location:', location);
  console.log('[Google Search] 🔎 Final query:', query);
  console.log('[Google Search] 🚀 Starting search...');

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('cx', searchEngineId);
    url.searchParams.append('q', query);
    url.searchParams.append('num', '5'); // Top 5 risultati

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google Search] API Error:', response.status, errorText);
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('[Google Search] ✅ Total results:', data.searchInformation?.totalResults || 0);
    console.log('[Google Search] 📊 Items found:', data.items?.length || 0);

    if (!data.items || data.items.length === 0) {
      console.log('[Google Search] ❌ No results found for query:', query);
      return {
        found: false,
        source: 'google_custom_search',
        searchQuery: query
      };
    }

    // Analizza i risultati
    const firstResult = data.items[0];

    console.log('[Google Search] ✅ Found:', firstResult.title);

    // Estrai nome pulito (rimuovi " - ", " | ", " – " e tutto dopo)
    let cleanName = firstResult.title
      ?.replace(/\s*[\|\-–]\s*.*/g, '')  // Rimuovi tutto dopo | - –
      ?.replace(/\s+\(.*?\)/g, '')        // Rimuovi parentesi
      ?.trim() || companyName;

    // Se il nome contiene ancora parole comuni di titoli web, usa il company name originale
    const webTitleWords = ['home', 'official', 'website', 'swiss', 'switzerland', 'svizzera'];
    if (webTitleWords.some(word => cleanName.toLowerCase().includes(word))) {
      cleanName = companyName;
    }

    return {
      found: true,
      legalName: cleanName,
      website: firstResult.link,
      businessActivity: firstResult.snippet,
      source: 'google_custom_search',
      searchQuery: query,
      rawData: data.items.slice(0, 3) // Primi 3 risultati
    };

  } catch (error: any) {
    console.error('[Google Search] Error:', error.message);
    throw error;
  }
}

/**
 * Cerca un'azienda usando Tavily API (fallback)
 */
async function searchWithTavily(
  companyName: string,
  location?: string
): Promise<CompanySearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.warn('[Tavily] API key mancante');
    throw new Error('Tavily not configured');
  }

  let query = `${companyName}`;
  if (location) {
    query += ` ${location}`;
  }
  query += ' Switzerland company information';

  console.log('[Tavily] Query:', query);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_domains: [],
        exclude_domains: [],
        max_results: 5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Tavily] API Error:', response.status, errorText);
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('[Tavily] Results:', data.results?.length || 0);

    if (!data.results || data.results.length === 0) {
      return {
        found: false,
        source: 'tavily',
        searchQuery: query
      };
    }

    const firstResult = data.results[0];

    return {
      found: true,
      legalName: firstResult.title?.replace(/[|\-–].*$/, '').trim() || companyName,
      website: firstResult.url,
      businessActivity: firstResult.content || data.answer,
      source: 'tavily',
      searchQuery: query,
      rawData: data.results.slice(0, 3)
    };

  } catch (error: any) {
    console.error('[Tavily] Error:', error.message);
    throw error;
  }
}

/**
 * Cerca informazioni aziendali (con fallback automatico)
 */
export async function searchCompanyInfo(
  companyName: string,
  location?: string
): Promise<CompanySearchResult> {
  console.log('[Web Search] Searching for:', companyName, location || '');

  // Prova Google prima
  try {
    const result = await searchWithGoogle(companyName, location);
    if (result.found) {
      console.log('[Web Search] ✓ Found with Google');
      return result;
    }
  } catch (error: any) {
    console.warn('[Web Search] Google failed, trying Tavily...', error.message);
  }

  // Fallback a Tavily
  try {
    const result = await searchWithTavily(companyName, location);
    if (result.found) {
      console.log('[Web Search] ✓ Found with Tavily');
      return result;
    }
  } catch (error: any) {
    console.warn('[Web Search] Tavily failed', error.message);
  }

  // Nessun risultato
  console.log('[Web Search] ✗ No results found');
  return {
    found: false,
    source: 'none',
    searchQuery: `${companyName} ${location || ''}`
  };
}
