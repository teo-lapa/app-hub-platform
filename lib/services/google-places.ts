// Google Places API Service
// Fornisce funzionalità per cercare aziende nelle vicinanze usando Google Places API

export interface PlaceLocation {
  lat: number;
  lng: number;
}

export interface PlaceGeometry {
  location: PlaceLocation;
  viewport?: {
    northeast: PlaceLocation;
    southwest: PlaceLocation;
  };
}

export interface PlaceOpeningHours {
  open_now?: boolean;
  weekday_text?: string[];
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

export interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  geometry: PlaceGeometry;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: PlaceOpeningHours;
  photos?: PlacePhoto[];
  business_status?: string;

  // Dettagli aggiuntivi (richiedono Place Details API)
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
}

export interface NearbySearchParams {
  location: PlaceLocation;
  radius: number; // in metri
  type?: string; // es: 'restaurant', 'cafe', 'store'
  keyword?: string;
  minprice?: number; // 0-4
  maxprice?: number; // 0-4
  opennow?: boolean;
}

export interface PlaceDetailsParams {
  place_id: string;
  fields?: string[]; // campi specifici da richiedere
}

export interface TextSearchParams {
  query: string;
  location?: PlaceLocation;
  radius?: number;
  type?: string;
}

/**
 * Cerca aziende nelle vicinanze usando Google Places Nearby Search
 */
export async function searchNearbyPlaces(
  params: NearbySearchParams,
  apiKey: string
): Promise<PlaceResult[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');

  // Parametri obbligatori
  url.searchParams.append('location', `${params.location.lat},${params.location.lng}`);
  url.searchParams.append('radius', params.radius.toString());
  url.searchParams.append('key', apiKey);

  // Parametri opzionali
  if (params.type) {
    url.searchParams.append('type', params.type);
  }
  if (params.keyword) {
    url.searchParams.append('keyword', params.keyword);
  }
  if (params.minprice !== undefined) {
    url.searchParams.append('minprice', params.minprice.toString());
  }
  if (params.maxprice !== undefined) {
    url.searchParams.append('maxprice', params.maxprice.toString());
  }
  if (params.opennow) {
    url.searchParams.append('opennow', 'true');
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API status: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    return data.results || [];
  } catch (error) {
    console.error('Error searching nearby places:', error);
    throw error;
  }
}

/**
 * Ottiene dettagli completi di un luogo usando Place ID
 */
export async function getPlaceDetails(
  params: PlaceDetailsParams,
  apiKey: string
): Promise<PlaceResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');

  url.searchParams.append('place_id', params.place_id);
  url.searchParams.append('key', apiKey);

  // Campi da richiedere (se non specificati, richiede tutti i Basic fields)
  const fields = params.fields || [
    'place_id',
    'name',
    'formatted_address',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'url',
    'geometry',
    'rating',
    'user_ratings_total',
    'opening_hours',
    'types',
    'business_status',
    'price_level',
    'photos'
  ];

  url.searchParams.append('fields', fields.join(','));

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.warn(`Google Places Details API status: ${data.status}`);
      return null;
    }

    return data.result || null;
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}

/**
 * Cerca luoghi usando query testuale
 */
export async function textSearchPlaces(
  params: TextSearchParams,
  apiKey: string
): Promise<PlaceResult[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');

  url.searchParams.append('query', params.query);
  url.searchParams.append('key', apiKey);

  if (params.location) {
    url.searchParams.append('location', `${params.location.lat},${params.location.lng}`);
  }
  if (params.radius) {
    url.searchParams.append('radius', params.radius.toString());
  }
  if (params.type) {
    url.searchParams.append('type', params.type);
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API status: ${data.status}`);
    }

    return data.results || [];
  } catch (error) {
    console.error('Error in text search:', error);
    throw error;
  }
}

/**
 * Ottiene URL di una foto usando photo_reference
 */
export function getPhotoUrl(
  photoReference: string,
  maxWidth: number,
  apiKey: string
): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
}

/**
 * Converte tipo Google Places in italiano
 */
export function translatePlaceType(type: string): string {
  const translations: Record<string, string> = {
    'restaurant': 'Ristorante',
    'cafe': 'Caffè',
    'bar': 'Bar',
    'food': 'Alimentari',
    'store': 'Negozio',
    'bakery': 'Panetteria',
    'supermarket': 'Supermercato',
    'meal_delivery': 'Delivery',
    'meal_takeaway': 'Asporto',
    'grocery_or_supermarket': 'Alimentari',
    'lodging': 'Alloggio',
    'hotel': 'Hotel',
    'shopping_mall': 'Centro Commerciale',
    'clothing_store': 'Abbigliamento',
    'electronics_store': 'Elettronica',
    'furniture_store': 'Arredamento',
    'home_goods_store': 'Casa',
    'hardware_store': 'Ferramenta',
    'beauty_salon': 'Centro Estetico',
    'hair_care': 'Parrucchiere',
    'spa': 'Centro Benessere',
    'gym': 'Palestra',
    'night_club': 'Locale Notturno',
    'park': 'Parco',
    'museum': 'Museo',
    'movie_theater': 'Cinema',
    'library': 'Biblioteca',
    'school': 'Scuola',
    'university': 'Università',
    'hospital': 'Ospedale',
    'pharmacy': 'Farmacia',
    'doctor': 'Medico',
    'dentist': 'Dentista',
    'veterinary_care': 'Veterinario',
    'car_dealer': 'Concessionario',
    'car_rental': 'Autonoleggio',
    'car_repair': 'Officina',
    'car_wash': 'Autolavaggio',
    'gas_station': 'Distributore',
    'parking': 'Parcheggio',
    'laundry': 'Lavanderia',
    'atm': 'Bancomat',
    'bank': 'Banca',
    'post_office': 'Ufficio Postale',
    'florist': 'Fiorista',
    'jewelry_store': 'Gioielleria',
    'book_store': 'Libreria',
    'pet_store': 'Negozio Animali',
    'shoe_store': 'Calzature'
  };

  return translations[type] || type;
}

/**
 * Formatta orari di apertura in modo leggibile
 */
export function formatOpeningHours(openingHours?: PlaceOpeningHours): string[] {
  if (!openingHours?.weekday_text) {
    return ['Orari non disponibili'];
  }

  return openingHours.weekday_text.map(text => {
    // Traduci giorni in italiano
    return text
      .replace('Monday', 'Lunedì')
      .replace('Tuesday', 'Martedì')
      .replace('Wednesday', 'Mercoledì')
      .replace('Thursday', 'Giovedì')
      .replace('Friday', 'Venerdì')
      .replace('Saturday', 'Sabato')
      .replace('Sunday', 'Domenica')
      .replace('Closed', 'Chiuso')
      .replace('Open 24 hours', 'Aperto 24h');
  });
}

/**
 * Calcola distanza tra due punti (Haversine formula)
 */
export function calculateDistance(
  point1: PlaceLocation,
  point2: PlaceLocation
): number {
  const R = 6371; // Raggio della Terra in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
    Math.cos(toRad(point2.lat)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance; // in km
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formatta distanza in modo leggibile
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
