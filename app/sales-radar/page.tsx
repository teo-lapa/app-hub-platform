'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Search,
  RefreshCw,
  Filter,
  Building2,
  Phone,
  Globe,
  Star,
  Clock,
  ExternalLink,
  Navigation,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Euro,
  ShoppingCart,
  Calendar,
  TrendingUp,
  UserPlus,
  AlertCircle,
  X,
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';

// Types
interface Location {
  lat: number;
  lng: number;
}

interface PlaceData {
  place_id: string;
  name: string;
  address: string;
  phone: string;
  international_phone: string;
  website: string;
  google_maps_url: string;
  location: Location;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  business_status: string;
  price_level?: number;
}

interface OdooCustomer {
  id: number;
  name: string;
  display_name: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  state: string;
  website: string;
  vat: string;
  is_company: boolean;
}

interface SalesData {
  total_invoiced: number;
  order_count: number;
  customer_rank: number;
  last_order_date: string | null;
  last_order_amount: number | null;
}

interface EnrichedPlace extends PlaceData {
  existsInOdoo: boolean;
  isChecking: boolean;
  odooCustomer?: OdooCustomer;
  salesData?: SalesData;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter: Location = {
  lat: 46.8182, // Centro Svizzera (Berna)
  lng: 8.2275,
};

const PLACE_TYPES = [
  { value: '', label: 'Tutti i tipi' },
  { value: 'restaurant', label: 'Ristoranti' },
  { value: 'cafe', label: 'Caffè' },
  { value: 'bar', label: 'Bar' },
  { value: 'bakery', label: 'Panetterie' },
  { value: 'supermarket', label: 'Supermercati' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'lodging', label: 'Alloggi' },
  { value: 'food', label: 'Alimentari' },
  { value: 'store', label: 'Negozi' },
  { value: 'shopping_mall', label: 'Centri Commerciali' },
];

const RADIUS_OPTIONS = [
  { value: 1000, label: '1 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: 25000, label: '25 km' },
];

export default function SalesRadarPage() {
  const router = useRouter();

  // Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [mapCenter, setMapCenter] = useState<Location>(defaultCenter);

  // Search params
  const [radius, setRadius] = useState<number>(5000); // 5km default
  const [placeType, setPlaceType] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');

  // Results
  const [places, setPlaces] = useState<EnrichedPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // UI state
  const [selectedPlace, setSelectedPlace] = useState<EnrichedPlace | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Stats
  const existingCustomers = places.filter(p => p.existsInOdoo).length;
  const newProspects = places.filter(p => !p.existsInOdoo && !p.isChecking).length;

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          setMapCenter(location);
          console.log('📍 GPS Location:', location);
        },
        (error) => {
          console.warn('⚠️ Geolocation error:', error);
          // Usa posizione default (centro Svizzera)
        }
      );
    }
  }, []);

  // Search places
  const searchPlaces = useCallback(async () => {
    if (!userLocation && !mapCenter) {
      setSearchError('Posizione GPS non disponibile');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setPlaces([]);
    setSelectedPlace(null);

    try {
      const searchLocation = userLocation || mapCenter;

      console.log('🔍 Searching places:', { searchLocation, radius, placeType, keyword });

      const response = await fetch('/api/sales-radar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: searchLocation,
          radius,
          type: placeType || undefined,
          keyword: keyword || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore ricerca');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Ricerca fallita');
      }

      console.log(`✅ Found ${result.count} places`);

      // Inizializza con isChecking = false
      const enrichedPlaces: EnrichedPlace[] = result.data.map((place: PlaceData) => ({
        ...place,
        existsInOdoo: false,
        isChecking: false,
      }));

      setPlaces(enrichedPlaces);

      // Check each place in Odoo (in background)
      enrichedPlaces.forEach((place, index) => {
        checkIfExistsInOdoo(place, index);
      });

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally {
      setIsSearching(false);
    }
  }, [userLocation, mapCenter, radius, placeType, keyword]);

  // Check if place exists in Odoo
  const checkIfExistsInOdoo = async (place: PlaceData, index: number) => {
    try {
      // Set checking state
      setPlaces((prev) => {
        const newPlaces = [...prev];
        newPlaces[index] = { ...newPlaces[index], isChecking: true };
        return newPlaces;
      });

      const params = new URLSearchParams({
        name: place.name,
      });

      if (place.phone) params.append('phone', place.phone);
      if (place.website) params.append('website', place.website);
      if (place.address) params.append('address', place.address);

      const response = await fetch(`/api/sales-radar/check-customer?${params}`);

      if (!response.ok) {
        throw new Error('Check failed');
      }

      const result = await response.json();

      setPlaces((prev) => {
        const newPlaces = [...prev];
        newPlaces[index] = {
          ...newPlaces[index],
          isChecking: false,
          existsInOdoo: result.exists,
          odooCustomer: result.customer,
          salesData: result.sales_data,
        };
        return newPlaces;
      });

    } catch (error) {
      console.error(`⚠️ Error checking ${place.name}:`, error);
      setPlaces((prev) => {
        const newPlaces = [...prev];
        newPlaces[index] = { ...newPlaces[index], isChecking: false };
        return newPlaces;
      });
    }
  };

  // Create contact in Odoo
  const createContactInOdoo = async (place: EnrichedPlace) => {
    setIsCreating(true);
    try {
      console.log('🏢 Creating contact:', place.name);

      const response = await fetch('/api/sales-radar/create-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: place.name,
          phone: place.phone,
          website: place.website,
          address: place.address,
          types: place.types,
          rating: place.rating,
          google_maps_url: place.google_maps_url,
          place_id: place.place_id,
          latitude: place.location.lat,
          longitude: place.location.lng,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore creazione');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Creazione fallita');
      }

      console.log('✅ Contact created:', result.contact);

      // Update place as existing in Odoo
      setPlaces((prev) =>
        prev.map((p) =>
          p.place_id === place.place_id
            ? {
                ...p,
                existsInOdoo: true,
                odooCustomer: result.contact,
              }
            : p
        )
      );

      setShowCreateModal(false);
      setSelectedPlace(null);

      // Show success message (you could add a toast here)
      alert(`✅ Contatto creato in Odoo!\n\nApri Odoo per vedere i dettagli.`);

    } catch (error) {
      console.error('❌ Create error:', error);
      alert(`❌ Errore: ${error instanceof Error ? error.message : 'Creazione fallita'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-600" />
          <h2 className="mb-2 text-2xl font-bold text-red-900">
            Errore caricamento Google Maps
          </h2>
          <p className="text-red-700">Verifica la configurazione API Key</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-blue-600" />
          <p className="text-lg text-gray-700">Caricamento Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </button>

            <div className="h-8 w-px bg-gray-300" />

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sales Radar</h1>
                <p className="text-sm text-gray-600">
                  Trova nuovi clienti nelle vicinanze
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{newProspects}</div>
              <div className="text-xs text-gray-600">Nuovi Prospect</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {existingCustomers}
              </div>
              <div className="text-xs text-gray-600">Già Clienti</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{places.length}</div>
              <div className="text-xs text-gray-600">Totale Trovati</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Filters & Controls */}
        <div className="w-96 overflow-y-auto border-r bg-white p-4">
          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mb-4 flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-100"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri Ricerca
            </span>
            {showFilters ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 space-y-4"
              >
                {/* Radius */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Raggio di Ricerca
                  </label>
                  <select
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {RADIUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Place Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Tipo Attività
                  </label>
                  <select
                    value={placeType}
                    onChange={(e) => setPlaceType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {PLACE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Keyword */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Parola Chiave (opzionale)
                  </label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="es: pizza, sushi, hotel..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Buttons */}
          <div className="mb-6 space-y-2">
            <button
              onClick={searchPlaces}
              disabled={isSearching || (!userLocation && !mapCenter)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ricerca in corso...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Cerca Aziende
                </>
              )}
            </button>

            {places.length > 0 && (
              <button
                onClick={searchPlaces}
                disabled={isSearching}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-600 bg-white px-6 py-3 font-semibold text-blue-600 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-5 w-5" />
                Refresh
              </button>
            )}
          </div>

          {/* Error */}
          {searchError && (
            <div className="mb-6 rounded-xl bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Errore</p>
                  <p className="text-sm text-red-700">{searchError}</p>
                </div>
              </div>
            </div>
          )}

          {/* User Location Info */}
          {userLocation && (
            <div className="mb-6 rounded-xl bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">Posizione GPS</p>
                  <p className="text-sm text-blue-700">
                    {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results List */}
          {places.length > 0 && (
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">
                Risultati ({places.length})
              </h3>

              <div className="space-y-2">
                {places.map((place) => (
                  <motion.button
                    key={place.place_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      setSelectedPlace(place);
                      map?.panTo(place.location);
                      map?.setZoom(16);
                    }}
                    className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                      selectedPlace?.place_id === place.place_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <p className="font-semibold text-gray-900">{place.name}</p>
                      {place.isChecking ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
                      ) : place.existsInOdoo ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                      )}
                    </div>

                    <p className="mb-1 text-xs text-gray-600">{place.address}</p>

                    {place.rating && (
                      <div className="flex items-center gap-1 text-xs text-yellow-600">
                        <Star className="h-3 w-3 fill-current" />
                        <span>{place.rating}</span>
                      </div>
                    )}

                    {place.existsInOdoo && place.salesData && (
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">
                          Cliente
                        </span>
                        {place.salesData.total_invoiced > 0 && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">
                            €{place.salesData.total_invoiced.toFixed(0)}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative flex-1">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={userLocation ? 13 : 10}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: '#3B82F6',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                }}
              />
            )}

            {/* Search radius circle */}
            {userLocation && (
              <Circle
                center={userLocation}
                radius={radius}
                options={{
                  fillColor: '#3B82F6',
                  fillOpacity: 0.1,
                  strokeColor: '#3B82F6',
                  strokeOpacity: 0.3,
                  strokeWeight: 2,
                }}
              />
            )}

            {/* Place markers */}
            {places.map((place) => (
              <Marker
                key={place.place_id}
                position={place.location}
                onClick={() => setSelectedPlace(place)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: place.existsInOdoo ? '#10B981' : '#EF4444',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 2,
                }}
              />
            ))}

            {/* Info window */}
            {selectedPlace && (
              <InfoWindow
                position={selectedPlace.location}
                onCloseClick={() => setSelectedPlace(null)}
              >
                <div className="max-w-xs p-2">
                  <h3 className="mb-2 text-lg font-bold text-gray-900">
                    {selectedPlace.name}
                  </h3>

                  <div className="mb-3 space-y-1.5 text-sm">
                    {selectedPlace.address && (
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{selectedPlace.address}</span>
                      </div>
                    )}

                    {selectedPlace.phone && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{selectedPlace.phone}</span>
                      </div>
                    )}

                    {selectedPlace.website && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Globe className="h-4 w-4 shrink-0" />
                        <a
                          href={selectedPlace.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Sito Web
                        </a>
                      </div>
                    )}

                    {selectedPlace.rating && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <Star className="h-4 w-4 fill-current shrink-0" />
                        <span>
                          {selectedPlace.rating} / 5
                          {selectedPlace.user_ratings_total && (
                            <span className="text-gray-500">
                              {' '}
                              ({selectedPlace.user_ratings_total} recensioni)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {selectedPlace.opening_hours?.open_now !== undefined && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span
                          className={
                            selectedPlace.opening_hours.open_now
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {selectedPlace.opening_hours.open_now
                            ? 'Aperto ora'
                            : 'Chiuso'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Odoo Status */}
                  {selectedPlace.existsInOdoo && selectedPlace.odooCustomer ? (
                    <div className="mb-3 rounded-lg bg-green-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-900">
                          Cliente Esistente
                        </span>
                      </div>

                      {selectedPlace.salesData && (
                        <div className="space-y-1 text-sm text-green-800">
                          {selectedPlace.salesData.total_invoiced > 0 && (
                            <div className="flex items-center gap-2">
                              <Euro className="h-4 w-4" />
                              <span>
                                Fatturato: €
                                {selectedPlace.salesData.total_invoiced.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {selectedPlace.salesData.order_count > 0 && (
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="h-4 w-4" />
                              <span>Ordini: {selectedPlace.salesData.order_count}</span>
                            </div>
                          )}

                          {selectedPlace.salesData.last_order_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                Ultimo ordine:{' '}
                                {new Date(
                                  selectedPlace.salesData.last_order_date
                                ).toLocaleDateString('it-IT')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <a
                        href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${selectedPlace.odooCustomer.id}&model=res.partner&view_type=form`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Apri in Odoo
                      </a>
                    </div>
                  ) : selectedPlace.isChecking ? (
                    <div className="mb-3 rounded-lg bg-gray-50 p-3 text-center">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-gray-600" />
                      <p className="text-sm text-gray-600">
                        Verifica in Odoo...
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-lg bg-red-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="font-semibold text-red-900">
                          Nuovo Prospect
                        </span>
                      </div>
                      <p className="mb-2 text-sm text-red-800">
                        Non presente in Odoo
                      </p>

                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                      >
                        <UserPlus className="h-4 w-4" />
                        Crea Contatto in Odoo
                      </button>
                    </div>
                  )}

                  <a
                    href={selectedPlace.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Google Maps
                  </a>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>

      {/* Create Contact Modal */}
      <AnimatePresence>
        {showCreateModal && selectedPlace && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isCreating && setShowCreateModal(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserPlus className="h-6 w-6" />
                      <h3 className="text-xl font-bold">
                        Crea Contatto in Odoo
                      </h3>
                    </div>
                    {!isCreating && (
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className="rounded-lg p-2 transition-colors hover:bg-white/20"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-y-auto p-6">
                  <div className="mb-6 rounded-xl bg-blue-50 p-4">
                    <h4 className="mb-2 font-semibold text-blue-900">
                      {selectedPlace.name}
                    </h4>
                    <div className="space-y-1 text-sm text-blue-800">
                      {selectedPlace.address && <p>{selectedPlace.address}</p>}
                      {selectedPlace.phone && <p>Tel: {selectedPlace.phone}</p>}
                      {selectedPlace.website && (
                        <p>Web: {selectedPlace.website}</p>
                      )}
                    </div>
                  </div>

                  <p className="mb-4 text-gray-700">
                    Verrà creato un nuovo contatto in Odoo con i dati di Google
                    Places. Potrai modificare i dettagli successivamente.
                  </p>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>✓ Nome azienda</p>
                    <p>✓ Indirizzo completo</p>
                    <p>✓ Telefono</p>
                    <p>✓ Sito web</p>
                    <p>✓ Coordinate GPS</p>
                    <p>✓ Rating e recensioni Google</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 border-t bg-gray-50 p-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                    className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => createContactInOdoo(selectedPlace)}
                    disabled={isCreating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creazione...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-5 w-5" />
                        Crea Contatto
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
