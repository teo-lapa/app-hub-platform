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
    formatted?: string; // Indirizzo completo formattato
  };
  uid?: string; // P.IVA / UID
  businessActivity?: string;
  companyType?: string;
  creditInfo?: string;
  source: string;
  searchQuery: string;
  // Dati aggiuntivi da Google Places
  phone?: string;
  openingHours?: string[]; // Array di stringi tipo "Lunedì: 08:00-18:00"
  rating?: number;
  totalRatings?: number;
  businessTypes?: string[]; // ["restaurant", "food", "point_of_interest"]
  priceLevel?: number; // 0-4
  placeId?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  rawData?: any;
}

/**
 * Cerca un'azienda usando Google Places API per dati strutturati
 */
async function searchWithGooglePlaces(
  companyName: string,
  location?: string
): Promise<CompanySearchResult> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn('[Google Places] API key mancante');
    throw new Error('Google Places not configured');
  }

  // Costruisci query
  let query = companyName;
  if (location) {
    query += ` ${location}`;
  }
  query += ' Switzerland';

  console.log('[Google Places] 🔍 Searching for:', query);

  try {
    // Step 1: Text Search per trovare il place_id
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.append('key', apiKey);
    searchUrl.searchParams.append('query', query);
    searchUrl.searchParams.append('language', 'it');

    const searchResponse = await fetch(searchUrl.toString());

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('[Google Places] Search API Error:', searchResponse.status, errorText);
      throw new Error(`Google Places Search error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' || !searchData.results || searchData.results.length === 0) {
      console.log('[Google Places] ❌ No results found');
      return {
        found: false,
        source: 'google_places',
        searchQuery: query
      };
    }

    const place = searchData.results[0];
    console.log('[Google Places] ✅ Found place:', place.name);

    // Step 2: Place Details per ottenere dati completi
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.append('key', apiKey);
    detailsUrl.searchParams.append('place_id', place.place_id);
    detailsUrl.searchParams.append('fields', 'name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,types,price_level,geometry,address_components,business_status');
    detailsUrl.searchParams.append('language', 'it');

    const detailsResponse = await fetch(detailsUrl.toString());

    if (!detailsResponse.ok) {
      console.warn('[Google Places] Details API Error, using basic data');
      // Usa solo i dati base dal search
      return buildResultFromSearchData(place, query);
    }

    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result) {
      console.warn('[Google Places] Details not available, using basic data');
      return buildResultFromSearchData(place, query);
    }

    const details = detailsData.result;
    console.log('[Google Places] ✅ Got detailed data');

    // Estrai ZIP code e componenti indirizzo
    let zip = '';
    let street = '';
    let city = '';
    let country = '';

    if (details.address_components) {
      for (const component of details.address_components) {
        if (component.types.includes('postal_code')) {
          zip = component.long_name;
        }
        if (component.types.includes('route')) {
          street = component.long_name;
        }
        if (component.types.includes('street_number')) {
          street = component.long_name + (street ? ' ' + street : '');
        }
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('country')) {
          country = component.long_name;
        }
      }
    }

    // Formatta orari di apertura
    let openingHours: string[] | undefined;
    if (details.opening_hours?.weekday_text) {
      openingHours = details.opening_hours.weekday_text;
    }

    return {
      found: true,
      legalName: details.name || companyName,
      website: details.website,
      address: {
        street: street || undefined,
        zip: zip || undefined,
        city: city || undefined,
        country: country || undefined,
        formatted: details.formatted_address
      },
      phone: details.formatted_phone_number,
      openingHours: openingHours,
      rating: details.rating,
      totalRatings: details.user_ratings_total,
      businessTypes: details.types,
      priceLevel: details.price_level,
      placeId: place.place_id,
      coordinates: details.geometry?.location ? {
        lat: details.geometry.location.lat,
        lng: details.geometry.location.lng
      } : undefined,
      businessActivity: place.formatted_address, // Fallback
      source: 'google_places',
      searchQuery: query,
      rawData: { search: place, details }
    };

  } catch (error: any) {
    console.error('[Google Places] Error:', error.message);
    throw error;
  }
}

/**
 * Costruisce un risultato base dai dati di ricerca (quando Details non è disponibile)
 */
function buildResultFromSearchData(place: any, query: string): CompanySearchResult {
  return {
    found: true,
    legalName: place.name,
    address: {
      formatted: place.formatted_address
    },
    rating: place.rating,
    totalRatings: place.user_ratings_total,
    businessTypes: place.types,
    placeId: place.place_id,
    coordinates: place.geometry?.location ? {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    } : undefined,
    businessActivity: place.formatted_address,
    source: 'google_places',
    searchQuery: query,
    rawData: { search: place }
  };
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

  // Prova Google Places prima (dati strutturati completi)
  try {
    const result = await searchWithGooglePlaces(companyName, location);
    if (result.found) {
      console.log('[Web Search] ✓ Found with Google Places (rich data)');
      return result;
    }
  } catch (error: any) {
    console.warn('[Web Search] Google Places failed, trying Custom Search...', error.message);
  }

  // Fallback a Google Custom Search (dati base)
  try {
    const result = await searchWithGoogle(companyName, location);
    if (result.found) {
      console.log('[Web Search] ✓ Found with Google Custom Search');
      return result;
    }
  } catch (error: any) {
    console.warn('[Web Search] Google Custom Search failed, trying Tavily...', error.message);
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
