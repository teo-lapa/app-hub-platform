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
  Menu,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';

const MARKER_COLORS = {
  user: '#3B82F6',      // Blue - user position
  customer: '#10B981',   // Green - customer with orders
  contact: '#8B5CF6',    // Purple - contact in Odoo but no recent orders
  lead: '#F59E0B',       // Orange - saved lead in CRM
  prospect: '#EF4444',   // Red - never seen
  notTarget: '#FFFFFF',  // White - not in target (escluso)
};

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
  // Nuovi campi (ultimi 3 mesi)
  invoiced_3_months?: number;
  order_count_3_months?: number;
  last_order_date?: string | null;
  // Campi legacy (per compatibilità)
  total_invoiced?: number;
  order_count?: number;
  customer_rank?: number;
  last_order_amount?: number | null;
}

interface EnrichedPlace extends PlaceData {
  existsInOdoo: boolean;
  isChecking: boolean;
  odooCustomer?: OdooCustomer;
  salesData?: SalesData;
  // Additional fields for compatibility with Odoo data and live search
  isLead?: boolean;
  leadId?: number;
  notInTarget?: boolean;
  color?: 'green' | 'orange' | 'grey' | 'red';
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
  tags?: string[];
  sales_data?: SalesData;
  id?: number;
  type?: 'customer' | 'lead'; // From Odoo load - indicates if it's res.partner or crm.lead
  locationType?: 'company' | 'delivery'; // 'company' = sede legale, 'delivery' = indirizzo consegna
  parentId?: number; // ID azienda madre (per indirizzi di consegna)
  parentName?: string; // Nome azienda madre (per indirizzi di consegna)
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

/**
 * Stima dimensione del locale e potenziale fatturato mensile
 * basato su dati Google Places
 */
function estimateBusinessPotential(place: {
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  rating?: number;
}): { size: 'piccolo' | 'medio' | 'grande'; potentialMonthly: number; categories: string[] } {
  const reviews = place.user_ratings_total || 0;
  const priceLevel = place.price_level ?? 2; // Default medio
  const types = place.types || [];

  // Determina dimensione basata sul numero di recensioni
  let size: 'piccolo' | 'medio' | 'grande' = 'piccolo';
  if (reviews >= 500) {
    size = 'grande';
  } else if (reviews >= 100) {
    size = 'medio';
  }

  // Base mensile per dimensione (in CHF)
  const baseBySize = {
    piccolo: 800,   // 800 CHF/mese
    medio: 2500,    // 2500 CHF/mese
    grande: 6000,   // 6000 CHF/mese
  };

  // Moltiplicatore per tipo di locale
  let typeMultiplier = 1.0;
  const categories: string[] = [];

  // Categorie LAPA: Frigo, Secco, Frozen, Non-Food
  if (types.includes('restaurant') || types.includes('meal_delivery')) {
    typeMultiplier = 1.3;
    categories.push('Frigo', 'Secco', 'Frozen');
  }
  if (types.includes('hotel') || types.includes('lodging')) {
    typeMultiplier = 1.5;
    categories.push('Frigo', 'Secco', 'Frozen', 'Non-Food');
  }
  if (types.includes('cafe') || types.includes('bakery')) {
    typeMultiplier = 0.8;
    categories.push('Frigo', 'Secco');
  }
  if (types.includes('bar')) {
    typeMultiplier = 0.6;
    categories.push('Frigo', 'Secco');
  }
  if (types.includes('supermarket') || types.includes('grocery_or_supermarket')) {
    typeMultiplier = 2.0;
    categories.push('Frigo', 'Secco', 'Frozen', 'Non-Food');
  }

  // Moltiplicatore per fascia di prezzo (locale più costoso = più volume)
  const priceMultiplier = 0.7 + (priceLevel * 0.2); // 0.7 a 1.5

  // Calcola potenziale mensile
  const potentialMonthly = Math.round(baseBySize[size] * typeMultiplier * priceMultiplier);

  // Default categories se vuoto
  if (categories.length === 0) {
    categories.push('Frigo', 'Secco');
  }

  return { size, potentialMonthly, categories: Array.from(new Set(categories)) };
}

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
  const [radius, setRadius] = useState<number>(1000); // 1km default
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
  // Mobile-specific state
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileResults, setShowMobileResults] = useState(false);

  // Map mode: 'live' for Google search, 'static' for Odoo data
  // Default to 'static' (Odoo) mode
  const [mapMode, setMapMode] = useState<'live' | 'static'>('static');

  // Static map filters
  const [staticFilter, setStaticFilter] = useState<'all' | 'customers' | 'leads' | 'not_target' | 'active_6m'>('all');

  // Loading state for static map
  const [loadingStatic, setLoadingStatic] = useState(false);

  // All active customers button state
  const [loadingAllActive, setLoadingAllActive] = useState(false);
  const [activePeriod, setActivePeriod] = useState<'1m' | '3m' | '6m'>('3m');

  // Odoo places (from static map)
  const [odooPlaces, setOdooPlaces] = useState<any[]>([]);

  // Saving leads state
  const [savingLeads, setSavingLeads] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Note modal (vocale, scritta, non in target) - tutto in uno
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [notePlace, setNotePlace] = useState<any>(null);
  const [writtenNote, setWrittenNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notTargetExpanded, setNotTargetExpanded] = useState(false);

  // AI Analysis state
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisPlace, setAnalysisPlace] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stats
  const existingCustomers = places.filter(p => p.existsInOdoo).length;
  const newProspects = places.filter(p => !p.existsInOdoo && !p.isChecking).length;

  // Marker color helper functions
  const getMarkerColor = (place: any) => {
    if (place.notInTarget || place.color === 'grey') {
      return MARKER_COLORS.notTarget;
    }
    if (place.existsInOdoo || place.color === 'green') {
      return MARKER_COLORS.customer;
    }
    // Purple - contact in Odoo but no recent orders (type=customer but color not green)
    if (place.color === 'purple' || (place.type === 'customer' && place.color === 'orange')) {
      return MARKER_COLORS.contact;
    }
    if (place.isLead || place.color === 'orange') {
      return MARKER_COLORS.lead;
    }
    return MARKER_COLORS.prospect;
  };

  const getMarkerOpacity = (place: any) => {
    if (place.notInTarget || place.color === 'grey') {
      return 0.4; // Transparent for not in target
    }
    return 1;
  };

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

      // Auto-save all results as leads in CRM
      const newProspects = enrichedPlaces.filter(p => !p.existsInOdoo);
      if (newProspects.length > 0) {
        saveLeadsToOdoo(newProspects);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally {
      setIsSearching(false);
    }
  }, [userLocation, mapCenter, radius, placeType, keyword]);

  // Save leads to Odoo CRM
  const saveLeadsToOdoo = async (placesToSave: any[]) => {
    if (placesToSave.length === 0) return;

    setSavingLeads(true);
    try {
      const response = await fetch('/api/sales-radar/save-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: placesToSave.map(p => ({
            place_id: p.place_id,
            name: p.name,
            address: p.address || p.formatted_address || p.vicinity || '',
            phone: p.phone || p.formatted_phone_number || p.international_phone_number || '',
            website: p.website || '',
            rating: p.rating,
            user_ratings_total: p.user_ratings_total,
            types: p.types,
            latitude: p.geometry?.location?.lat || p.location?.lat || p.lat,
            longitude: p.geometry?.location?.lng || p.location?.lng || p.lng,
            google_maps_url: p.google_maps_url || p.url || '',
          }))
        })
      });

      const result = await response.json();
      console.log('✅ Lead salvati:', result.saved, 'Saltati:', result.skipped);

      // Update places to mark them as leads (orange)
      if (result.success) {
        setPlaces(prev => prev.map(p => {
          const savedResult = result.results?.find((r: any) => r.place_id === p.place_id);
          if (savedResult?.status === 'created' || savedResult?.status === 'skipped') {
            return { ...p, isLead: true, leadId: savedResult.lead_id };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('❌ Errore salvataggio lead:', error);
    } finally {
      setSavingLeads(false);
    }
  };

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

  // Load static map data from Odoo
  const loadStaticMap = async () => {
    if (!userLocation) {
      alert('Posizione GPS non disponibile');
      return;
    }

    setLoadingStatic(true);
    try {
      const params = new URLSearchParams({
        latitude: userLocation.lat.toString(),
        longitude: userLocation.lng.toString(),
        radius: radius.toString(),
        filter: staticFilter,
        ...(placeType ? { type: placeType } : {})  // placeType is '' when "Tutti i tipi" is selected
      });

      const response = await fetch(`/api/sales-radar/load-from-odoo?${params}`, {
        credentials: 'include' // Assicura che i cookie vengano inviati
      });
      const result = await response.json();

      if (result.success) {
        setOdooPlaces(result.data);
        console.log('📍 Caricati da Odoo:', result.data.length, 'luoghi');
      }
    } catch (error) {
      console.error('❌ Errore caricamento mappa statica:', error);
    } finally {
      setLoadingStatic(false);
    }
  };

  // Load ALL active customers (no radius limit)
  const loadAllActiveCustomers = async () => {
    setLoadingAllActive(true);
    try {
      const params = new URLSearchParams({
        all_active: 'true',
        period: activePeriod
      });

      const response = await fetch(`/api/sales-radar/load-from-odoo?${params}`, {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setOdooPlaces(result.data);
        console.log(`📍 Caricati ${result.data.length} clienti attivi (${activePeriod})`);

        // Mostra messaggio di successo
        const periodLabel = activePeriod === '1m' ? '1 mese' : activePeriod === '3m' ? '3 mesi' : '6 mesi';
        alert(`✅ Caricati ${result.data.length} clienti attivi negli ultimi ${periodLabel}`);
      } else {
        console.error('❌ Errore:', result.error);
        alert(`❌ Errore: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Errore caricamento clienti attivi:', error);
      alert('❌ Errore nel caricamento dei clienti attivi');
    } finally {
      setLoadingAllActive(false);
    }
  };

  // Auto-load Odoo data when in static mode and GPS is available
  useEffect(() => {
    if (mapMode === 'static' && userLocation && odooPlaces.length === 0 && !loadingStatic) {
      console.log('📍 Auto-loading Odoo data...');
      loadStaticMap();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode, userLocation]);

  // Refresh Google data for static mode
  const refreshGoogleData = async () => {
    if (!userLocation) return;

    try {
      const response = await fetch('/api/sales-radar/update-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          radius: radius
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ Aggiornati ${result.updated} lead da Google`);
        // Reload static map if in static mode
        if (mapMode === 'static') {
          loadStaticMap();
        }
      }
    } catch (error) {
      console.error('Errore aggiornamento:', error);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setAudioChunks([]);

        // Send to API for transcription
        // Usa notePlace se siamo nel modal Note, altrimenti selectedPlace
        const placeToUse = notePlace || selectedPlace;
        if (placeToUse) {
          await saveVoiceNote(audioBlob, placeToUse);

          // Se era dal modal con "Non in Target" espanso, marca come 'other' e chiudi
          if (notePlace && notTargetExpanded) {
            await markAsNotTarget('other');
            setShowNoteModal(false);
            setNotePlace(null);
            setNotTargetExpanded(false);
          }
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Errore accesso microfono:', error);
      alert('Impossibile accedere al microfono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const saveVoiceNote = async (audioBlob: Blob, place: any) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-note.webm');
    formData.append('lead_id', place.leadId || place.id || place.place_id);
    // Determina se è un partner (cliente esistente verde) o un lead (arancione)
    const isPartner = place.existsInOdoo || place.type === 'customer' || place.color === 'green';
    formData.append('lead_type', isPartner ? 'partner' : 'lead');

    try {
      const response = await fetch('/api/sales-radar/voice-note', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        alert(`Nota salvata: "${result.transcription?.substring(0, 50) || 'Audio salvato'}..."`);
      }
    } catch (error) {
      console.error('Errore salvataggio nota vocale:', error);
    }
  };

  // Open Note Modal (from InfoWindow)
  const openNoteModal = (place: any) => {
    setNotePlace(place);
    setWrittenNote('');
    setNotTargetExpanded(false);
    setShowNoteModal(true);
  };

  // Save written note to Odoo
  const saveWrittenNote = async () => {
    if (!notePlace || !writtenNote.trim()) return;

    // Determina se è un partner (cliente esistente verde) o un lead (arancione)
    const isPartner = notePlace.existsInOdoo || notePlace.type === 'customer' || notePlace.color === 'green';

    setIsSavingNote(true);
    try {
      const response = await fetch('/api/sales-radar/voice-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: notePlace.leadId || notePlace.id || notePlace.place_id,
          lead_type: isPartner ? 'partner' : 'lead',
          text_note: writtenNote.trim()
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Nota salvata!');
        setShowNoteModal(false);
        setWrittenNote('');
      }
    } catch (error) {
      console.error('Errore salvataggio nota:', error);
      alert('❌ Errore nel salvataggio');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Not in Target function (uses notePlace from the same modal)
  const markAsNotTarget = async (reason: 'closed' | 'not_interested' | 'other', note?: string) => {
    if (!notePlace) return;

    try {
      const response = await fetch('/api/sales-radar/mark-not-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: notePlace.leadId || notePlace.id || notePlace.place_id,
          reason,
          note
        })
      });

      const result = await response.json();
      if (result.success) {
        // Update local state to show grey marker
        setPlaces(prev => prev.map(p =>
          p.place_id === notePlace.place_id
            ? { ...p, notInTarget: true, color: 'grey' } as any
            : p
        ));
        setOdooPlaces(prev => prev.map(p =>
          p.id === notePlace.id
            ? { ...p, notInTarget: true, color: 'grey' }
            : p
        ));
        setShowNoteModal(false);
        setNotePlace(null);
        setNotTargetExpanded(false);
        setSelectedPlace(null);
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  // Reactivate a lead (remove from archive)
  const reactivateLead = async (place: any) => {
    if (!place) return;

    try {
      const response = await fetch('/api/sales-radar/reactivate-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: place.leadId || place.id
        })
      });

      const result = await response.json();
      if (result.success) {
        // Update local state to show orange marker (lead)
        setPlaces(prev => prev.map(p =>
          p.place_id === place.place_id
            ? { ...p, notInTarget: false, color: 'orange' } as any
            : p
        ));
        setOdooPlaces(prev => prev.map(p =>
          p.id === place.id
            ? { ...p, notInTarget: false, color: 'orange' }
            : p
        ));
        setSelectedPlace(null);
        alert('Lead riattivato con successo!');
      } else {
        alert('Errore: ' + (result.error || 'Riattivazione fallita'));
      }
    } catch (error) {
      console.error('Errore riattivazione:', error);
      alert('Errore durante la riattivazione');
    }
  };

  // Analyze client with AI
  const analyzeClient = async (place: any) => {
    if (!place) return;

    setAnalysisPlace(place);
    setAnalysisResult(null);
    setShowAnalysisModal(true);
    setIsAnalyzing(true);

    try {
      const clientType = (place.existsInOdoo || place.color === 'green') ? 'customer' : 'lead';

      const response = await fetch('/api/sales-radar/analyze-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: place.website || '',
          name: place.name || place.display_name || 'Cliente',
          client_id: place.odooCustomer?.id || place.id,
          client_type: clientType,
          address: place.address || '',
          phone: place.phone || ''
        })
      });

      const result = await response.json();
      if (result.success) {
        setAnalysisResult(result.analysis.text);
      } else {
        setAnalysisResult('Errore: ' + (result.error || 'Analisi non disponibile'));
      }
    } catch (error) {
      console.error('Errore analisi:', error);
      setAnalysisResult('Errore durante l\'analisi. Riprova più tardi.');
    } finally {
      setIsAnalyzing(false);
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
      {/* Header - Mobile Optimized */}
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 py-2 sm:px-3 text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline font-medium text-sm">Dashboard</span>
            </button>

            <div className="hidden sm:block h-8 w-px bg-gray-300" />

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2 sm:p-2.5">
                <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900">Sales Radar</h1>
                <p className="hidden sm:block text-sm text-gray-600">
                  Trova nuovi clienti nelle vicinanze
                </p>
              </div>
            </div>

            {/* Map Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMapMode('live')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mapMode === 'live'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔴 Live
              </button>
              <button
                onClick={() => {
                  setMapMode('static');
                  loadStaticMap();
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mapMode === 'static'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📍 Odoo
              </button>
            </div>
          </div>

          {/* Stats Header - 4 Colors */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="font-bold text-gray-900">{(mapMode === 'live' ? places : odooPlaces).filter((p: any) => !p.existsInOdoo && !p.isLead && p.color !== 'green' && p.color !== 'orange' && p.color !== 'grey' && !p.notInTarget).length}</span>
              <span className="text-gray-600">Nuovi</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="font-bold text-gray-900">{(mapMode === 'live' ? places : odooPlaces).filter((p: any) => p.isLead || p.color === 'orange').length}</span>
              <span className="text-gray-600">Lead</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="font-bold text-gray-900">{(mapMode === 'live' ? places : odooPlaces).filter((p: any) => p.existsInOdoo || p.color === 'green').length}</span>
              <span className="text-gray-600">Clienti</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-400"></span>
              <span className="font-bold text-gray-900">{(mapMode === 'live' ? places : odooPlaces).filter((p: any) => p.notInTarget || p.color === 'grey').length}</span>
              <span className="text-gray-600">Esclusi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile First Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar - Hidden on Mobile */}
        <div className="hidden lg:block lg:w-96 overflow-y-auto border-r bg-white p-4">
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Static Filter - Only visible in static mode */}
                {mapMode === 'static' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Filtra per Tipo
                    </label>
                    <select
                      value={staticFilter}
                      onChange={(e) => setStaticFilter(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="all">Tutti</option>
                      <option value="customers">🟢 Solo Clienti</option>
                      <option value="active_6m">🟢 Clienti Attivi (6 mesi)</option>
                      <option value="leads">🟠 Solo Lead</option>
                      <option value="not_target">⚪ Non in Target</option>
                    </select>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Buttons */}
          <div className="mb-6 space-y-2">
            <button
              onClick={searchPlaces}
              disabled={isSearching || (!userLocation && !mapCenter)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ricerca...
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-600 bg-white px-6 py-3 text-base font-semibold text-blue-600 transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className="h-5 w-5" />
                Refresh
              </button>
            )}

            {/* Refresh Google Data - Only in live mode (Google search mode) */}
            {mapMode === 'live' && (
              <button
                onClick={refreshGoogleData}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                🔄 Aggiorna Dati Google
              </button>
            )}

            {/* Load ALL Active Customers Button - Always visible in static mode */}
            {mapMode === 'static' && (
              <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <p className="text-sm font-semibold text-green-800 mb-3">
                  🗺️ Carica TUTTI i Clienti Attivi
                </p>
                <p className="text-xs text-green-600 mb-3">
                  Senza limiti di zona - mostra tutti i clienti con ordini nel periodo selezionato
                </p>
                <div className="flex gap-2">
                  <select
                    value={activePeriod}
                    onChange={(e) => setActivePeriod(e.target.value as '1m' | '3m' | '6m')}
                    className="flex-1 px-3 py-2.5 text-sm border border-green-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="1m" className="text-gray-900">Ultimo mese</option>
                    <option value="3m" className="text-gray-900">Ultimi 3 mesi</option>
                    <option value="6m" className="text-gray-900">Ultimi 6 mesi</option>
                  </select>
                  <button
                    onClick={loadAllActiveCustomers}
                    disabled={loadingAllActive}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm transition-all active:scale-95"
                  >
                    {loadingAllActive ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Caricamento...
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4" />
                        Carica Tutti
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {searchError && (
            <div className="mb-6 rounded-xl bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900 text-sm">Errore</p>
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
                  <p className="font-semibold text-blue-900 text-sm">Posizione GPS</p>
                  <p className="text-sm text-blue-700">
                    {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results List */}
          {places.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
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
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{place.name}</p>
                      {place.isChecking ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
                      ) : place.existsInOdoo ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                      )}
                    </div>

                    <p className="mb-1 text-xs text-gray-600 line-clamp-1">{place.address}</p>

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
                        {(place.salesData.invoiced_3_months ?? place.salesData.total_invoiced ?? 0) > 0 && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">
                            {(place.salesData.invoiced_3_months ?? place.salesData.total_invoiced ?? 0).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (3m)
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

        {/* Mobile Floating Action Buttons */}
        <div className="lg:hidden absolute bottom-6 left-4 right-4 z-10 flex gap-3">
          {/* Filters Button */}
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 shadow-lg border-2 border-blue-600 text-blue-600 font-semibold transition-all active:scale-95 hover:bg-blue-50"
          >
            <SlidersHorizontal className="h-5 w-5" />
            <span>Filtri</span>
          </button>

          {/* Results Button */}
          {places.length > 0 && (
            <button
              onClick={() => setShowMobileResults(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 shadow-lg text-white font-semibold transition-all active:scale-95"
            >
              <MapPin className="h-5 w-5" />
              <span>Risultati ({places.length})</span>
            </button>
          )}
        </div>

        {/* Map - Full Screen on Mobile */}
        <div className="relative flex-1" style={{ touchAction: 'none' }}>
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
              // Mobile optimizations
              gestureHandling: 'greedy',
              zoomControl: true,
              zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER,
              },
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

            {/* Business Markers - conditional based on map mode */}
            {(mapMode === 'live' ? places : odooPlaces).map((place: any, index: number) => (
              <Marker
                key={place.place_id || place.id || index}
                position={{
                  lat: place.geometry?.location?.lat || place.latitude || place.lat || place.location?.lat,
                  lng: place.geometry?.location?.lng || place.longitude || place.lng || place.location?.lng
                }}
                onClick={() => setSelectedPlace(place)}
                icon={{
                  path: place.locationType === 'delivery'
                    ? 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' // Pin icon for delivery
                    : google.maps.SymbolPath.CIRCLE,
                  scale: place.locationType === 'delivery' ? 1.5 : 10,
                  fillColor: getMarkerColor(place),
                  fillOpacity: getMarkerOpacity(place),
                  strokeColor: place.locationType === 'delivery' ? '#059669' : '#FFFFFF', // Verde scuro per consegna
                  strokeWeight: place.locationType === 'delivery' ? 1 : 2,
                  anchor: place.locationType === 'delivery' ? new google.maps.Point(12, 22) : undefined,
                }}
              />
            ))}

            {/* Info window - Mobile Optimized */}
            {selectedPlace && (
              <InfoWindow
                position={{
                  lat: selectedPlace.geometry?.location?.lat || selectedPlace.latitude || selectedPlace.lat || selectedPlace.location?.lat,
                  lng: selectedPlace.geometry?.location?.lng || selectedPlace.longitude || selectedPlace.lng || selectedPlace.location?.lng
                }}
                onCloseClick={() => setSelectedPlace(null)}
              >
                <div className="max-w-[280px] sm:max-w-xs p-2">
                  <h3 className="mb-1 text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    {selectedPlace.name}
                  </h3>

                  {/* Location type indicator (sede vs consegna) */}
                  {selectedPlace.locationType && (
                    <div className={`mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedPlace.locationType === 'delivery'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selectedPlace.locationType === 'delivery' ? (
                        <>
                          <span>🚚</span>
                          <span>Indirizzo Consegna</span>
                        </>
                      ) : (
                        <>
                          <span>🏢</span>
                          <span>Sede Legale</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Parent company link for delivery addresses */}
                  {selectedPlace.locationType === 'delivery' && selectedPlace.parentName && (
                    <div className="mb-2 text-xs text-gray-600">
                      Azienda: <span className="font-medium text-gray-800">{selectedPlace.parentName}</span>
                    </div>
                  )}

                  {/* Sales data for customers (from static mode or live mode) */}
                  {(selectedPlace.existsInOdoo || selectedPlace.sales_data || selectedPlace.color === 'green') && (selectedPlace.sales_data || selectedPlace.salesData) && (
                    <div className="bg-green-50 p-2 rounded-lg mb-2">
                      <p className="text-sm text-green-800 font-medium">
                        Fatturato (3 mesi): {(
                          (selectedPlace.sales_data?.invoiced_3_months ?? selectedPlace.salesData?.invoiced_3_months ?? selectedPlace.sales_data?.total_invoiced ?? selectedPlace.salesData?.total_invoiced) || 0
                        ).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-green-800">
                        Ordini (3 mesi): {(selectedPlace.sales_data?.order_count_3_months ?? selectedPlace.salesData?.order_count_3_months ?? selectedPlace.sales_data?.order_count ?? selectedPlace.salesData?.order_count) || 0}
                      </p>
                      {(selectedPlace.sales_data?.last_order_date || selectedPlace.salesData?.last_order_date) && (
                        <p className="text-sm text-green-700">
                          Ultimo ordine: {new Date(selectedPlace.sales_data?.last_order_date || selectedPlace.salesData?.last_order_date || '').toLocaleDateString('it-CH')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tags display */}
                  {selectedPlace.tags && selectedPlace.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {selectedPlace.tags.map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mb-3 space-y-1.5 text-sm">
                    {selectedPlace.address && (
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm leading-tight">{selectedPlace.address}</span>
                      </div>
                    )}

                    {selectedPlace.phone && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="h-4 w-4 shrink-0" />
                        <a href={`tel:${selectedPlace.phone}`} className="text-xs sm:text-sm text-blue-600 hover:underline">
                          {selectedPlace.phone}
                        </a>
                      </div>
                    )}

                    {selectedPlace.website && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Globe className="h-4 w-4 shrink-0" />
                        <a
                          href={selectedPlace.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs sm:text-sm text-blue-600 hover:underline truncate"
                        >
                          Sito Web
                        </a>
                      </div>
                    )}

                    {selectedPlace.rating && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <Star className="h-4 w-4 fill-current shrink-0" />
                        <span className="text-xs sm:text-sm">
                          {selectedPlace.rating} / 5
                          {selectedPlace.user_ratings_total && (
                            <span className="text-gray-500">
                              {' '}
                              ({selectedPlace.user_ratings_total})
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {selectedPlace.opening_hours?.open_now !== undefined && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            selectedPlace.opening_hours.open_now
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {selectedPlace.opening_hours.open_now
                            ? 'Aperto ora'
                            : 'Chiuso'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Potenziale Stimato - solo per lead/nuovi */}
                  {!selectedPlace.existsInOdoo && selectedPlace.color !== 'green' && (selectedPlace.user_ratings_total || selectedPlace.types) && (() => {
                    const potential = estimateBusinessPotential(selectedPlace);
                    return (
                      <div className="mb-3 rounded-lg bg-purple-50 p-3 border border-purple-200">
                        <div className="mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-semibold text-purple-900">
                            Potenziale Stimato
                          </span>
                        </div>
                        <div className="space-y-1 text-xs sm:text-sm text-purple-800">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Dimensione:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              potential.size === 'grande' ? 'bg-purple-200 text-purple-800' :
                              potential.size === 'medio' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {potential.size.charAt(0).toUpperCase() + potential.size.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Potenziale/mese:</span>
                            <span className="text-purple-900 font-semibold">
                              {potential.potentialMonthly.toLocaleString('it-CH')} CHF
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {potential.categories.map((cat, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Odoo Status - handles all 4 color states */}
                  {/* Customer with orders (green) OR customer without orders (purple - contact in Odoo) */}
                  {(selectedPlace.existsInOdoo || selectedPlace.color === 'green' || (selectedPlace.type === 'customer' && selectedPlace.color === 'orange')) && (selectedPlace.odooCustomer || selectedPlace.id) ? (
                    <div className={`mb-3 rounded-lg p-3 ${selectedPlace.color === 'green' ? 'bg-green-50' : 'bg-purple-50'}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 sm:h-5 sm:w-5 ${selectedPlace.color === 'green' ? 'text-green-600' : 'text-purple-600'}`} />
                        <span className={`text-sm font-semibold ${selectedPlace.color === 'green' ? 'text-green-900' : 'text-purple-900'}`}>
                          {selectedPlace.color === 'green' ? 'Cliente Attivo' : 'Contatto Odoo (no ordini recenti)'}
                        </span>
                      </div>

                      {(selectedPlace.salesData || selectedPlace.sales_data) && (
                        <div className="space-y-1 text-xs sm:text-sm text-green-800">
                          {((selectedPlace.salesData?.invoiced_3_months ?? selectedPlace.sales_data?.invoiced_3_months ?? selectedPlace.salesData?.total_invoiced ?? selectedPlace.sales_data?.total_invoiced) || 0) > 0 && (
                            <div className="flex items-center gap-2">
                              <Euro className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>
                                Fatturato (3 mesi): {(selectedPlace.salesData?.invoiced_3_months ?? selectedPlace.sales_data?.invoiced_3_months ?? selectedPlace.salesData?.total_invoiced ?? selectedPlace.sales_data?.total_invoiced ?? 0).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}

                          {((selectedPlace.salesData?.order_count_3_months ?? selectedPlace.sales_data?.order_count_3_months ?? selectedPlace.salesData?.order_count ?? selectedPlace.sales_data?.order_count) || 0) > 0 && (
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>{selectedPlace.salesData?.order_count_3_months ?? selectedPlace.sales_data?.order_count_3_months ?? selectedPlace.salesData?.order_count ?? selectedPlace.sales_data?.order_count} ordini (3 mesi)</span>
                            </div>
                          )}

                          {(selectedPlace.salesData?.last_order_date || selectedPlace.sales_data?.last_order_date) && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="text-xs">
                                Ultimo ordine: {new Date(
                                  (selectedPlace.salesData?.last_order_date || selectedPlace.sales_data?.last_order_date) as string
                                ).toLocaleDateString('it-CH')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <a
                        href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${
                          selectedPlace.locationType === 'delivery' && selectedPlace.parentId
                            ? selectedPlace.parentId
                            : (selectedPlace.odooCustomer?.id || selectedPlace.id)
                        }&model=res.partner&view_type=form`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors active:scale-95 ${
                          selectedPlace.color === 'green'
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        <ExternalLink className="h-4 w-4" />
                        {selectedPlace.locationType === 'delivery' ? 'Apri Azienda in Odoo' : 'Apri in Odoo'}
                      </a>
                    </div>
                  ) : (selectedPlace.isLead || selectedPlace.type === 'lead') ? (
                    <div className="mb-3 rounded-lg bg-orange-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                        <span className="text-sm font-semibold text-orange-900">
                          Lead CRM
                        </span>
                      </div>
                      <p className="mb-2 text-xs sm:text-sm text-orange-800">
                        Presente nel CRM come lead da convertire
                      </p>
                      {(selectedPlace.id || selectedPlace.leadId) && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${selectedPlace.leadId || selectedPlace.id}&model=${selectedPlace.type === 'customer' ? 'res.partner' : 'crm.lead'}&view_type=form`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-orange-700 active:scale-95"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Apri in Odoo
                        </a>
                      )}
                    </div>
                  ) : (selectedPlace.notInTarget || selectedPlace.color === 'grey') ? (
                    <div className="mb-3 rounded-lg bg-gray-100 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                        <span className="text-sm font-semibold text-gray-700">
                          Escluso dal Target
                        </span>
                      </div>
                      <p className="mb-2 text-xs sm:text-sm text-gray-600">
                        Non rientra nei criteri target
                      </p>
                      <button
                        onClick={() => reactivateLead(selectedPlace)}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Riattiva Lead
                      </button>
                      {(selectedPlace.id || selectedPlace.leadId) && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${selectedPlace.leadId || selectedPlace.id}&model=${selectedPlace.type === 'customer' ? 'res.partner' : 'crm.lead'}&view_type=form`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-gray-700 active:scale-95"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Apri in Odoo
                        </a>
                      )}
                    </div>
                  ) : selectedPlace.isChecking ? (
                    <div className="mb-3 rounded-lg bg-gray-50 p-3 text-center">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-gray-600" />
                      <p className="text-xs sm:text-sm text-gray-600">
                        Verifica in Odoo...
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-lg bg-red-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        <span className="text-sm font-semibold text-red-900">
                          Nuovo Prospect
                        </span>
                      </div>
                      <p className="mb-2 text-xs sm:text-sm text-red-800">
                        Non presente in Odoo
                      </p>

                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-red-700 active:scale-95"
                      >
                        <UserPlus className="h-4 w-4" />
                        Crea Contatto
                      </button>
                    </div>
                  )}

                  {selectedPlace.google_maps_url && (
                    <a
                      href={selectedPlace.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:scale-95"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Google Maps
                    </a>
                  )}

                  {/* Note Button - Opens Note Modal (show for all EXCEPT grey/excluded) */}
                  {!(selectedPlace.notInTarget || selectedPlace.color === 'grey') && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => openNoteModal(selectedPlace)}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                      >
                        📝 Aggiungi Nota
                      </button>
                      <button
                        onClick={() => analyzeClient(selectedPlace)}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center justify-center gap-2"
                      >
                        🤖 Analizza con AI
                      </button>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>

      {/* Mobile Bottom Sheet - Filters */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-2">
                <h3 className="text-base font-bold text-gray-900">Filtri Ricerca</h3>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="rounded-full p-1.5 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(70vh - 130px)' }}>
                <div className="space-y-3">
                  {/* Radius */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Raggio di Ricerca
                    </label>
                    <select
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
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
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Tipo Attività
                    </label>
                    <select
                      value={placeType}
                      onChange={(e) => setPlaceType(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
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
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Parola Chiave (opzionale)
                    </label>
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="es: pizza, sushi, hotel..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* User Location Info */}
                  {userLocation && (
                    <div className="rounded-lg bg-blue-50 p-3">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 shrink-0 text-blue-600" />
                        <p className="text-xs text-blue-700">
                          GPS: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {searchError && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <p className="text-xs text-red-700">{searchError}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - Search Button */}
              <div className="border-t bg-gray-50 px-4 py-3">
                <button
                  onClick={() => {
                    searchPlaces();
                    setShowMobileFilters(false);
                  }}
                  disabled={isSearching || (!userLocation && !mapCenter)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Ricerca...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      <span>Cerca Aziende</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet - Results */}
      <AnimatePresence>
        {showMobileResults && places.length > 0 && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileResults(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Risultati</h3>
                  <p className="text-xs text-gray-600">
                    {newProspects} prospect, {existingCustomers} clienti
                  </p>
                </div>
                <button
                  onClick={() => setShowMobileResults(false)}
                  className="rounded-full p-1.5 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Results List */}
              <div className="overflow-y-auto p-3 pb-6" style={{ maxHeight: 'calc(75vh - 90px)' }}>
                <div className="space-y-3">
                  {places.map((place) => (
                    <motion.button
                      key={place.place_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedPlace(place);
                        map?.panTo(place.location);
                        map?.setZoom(16);
                        setShowMobileResults(false);
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        selectedPlace?.place_id === place.place_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50'
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{place.name}</p>
                        {place.isChecking ? (
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
                        ) : place.existsInOdoo ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                        )}
                      </div>

                      <p className="mb-1.5 text-xs text-gray-600 line-clamp-2">{place.address}</p>

                      <div className="flex items-center gap-3 flex-wrap">
                        {place.rating && (
                          <div className="flex items-center gap-1 text-sm text-yellow-600">
                            <Star className="h-4 w-4 fill-current" />
                            <span>{place.rating}</span>
                          </div>
                        )}

                        {place.existsInOdoo && place.salesData && (
                          <>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              Cliente
                            </span>
                            {(place.salesData.invoiced_3_months ?? place.salesData.total_invoiced ?? 0) > 0 && (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                {(place.salesData.invoiced_3_months ?? place.salesData.total_invoiced ?? 0).toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (3m)
                              </span>
                            )}
                          </>
                        )}

                        {!place.existsInOdoo && !place.isChecking && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                            Nuovo Prospect
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Contact Modal - Mobile Optimized */}
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

            {/* Modal - Desktop center, Mobile bottom sheet */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex sm:items-center sm:justify-center p-0 sm:p-4"
            >
              <div className="relative w-full max-w-2xl overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <UserPlus className="h-5 w-5 sm:h-6 sm:w-6" />
                      <h3 className="text-base sm:text-xl font-bold">
                        Crea Contatto in Odoo
                      </h3>
                    </div>
                    {!isCreating && (
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className="rounded-lg p-2 transition-colors hover:bg-white/20 active:bg-white/30"
                      >
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto p-4 sm:p-6">
                  <div className="mb-4 sm:mb-6 rounded-xl bg-blue-50 p-3 sm:p-4">
                    <h4 className="mb-2 text-sm sm:text-base font-semibold text-blue-900">
                      {selectedPlace.name}
                    </h4>
                    <div className="space-y-1 text-xs sm:text-sm text-blue-800">
                      {selectedPlace.address && <p>{selectedPlace.address}</p>}
                      {selectedPlace.phone && <p>Tel: {selectedPlace.phone}</p>}
                      {selectedPlace.website && (
                        <p className="truncate">Web: {selectedPlace.website}</p>
                      )}
                    </div>
                  </div>

                  <p className="mb-4 text-sm sm:text-base text-gray-700">
                    Verrà creato un nuovo contatto in Odoo con i dati di Google
                    Places. Potrai modificare i dettagli successivamente.
                  </p>

                  <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                    <p>✓ Nome azienda</p>
                    <p>✓ Indirizzo completo</p>
                    <p>✓ Telefono</p>
                    <p>✓ Sito web</p>
                    <p>✓ Coordinate GPS</p>
                    <p>✓ Rating e recensioni Google</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 border-t bg-gray-50 p-4 sm:p-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                    className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => createContactInOdoo(selectedPlace)}
                    disabled={isCreating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white transition-colors hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Creazione...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-5 w-5" />
                        <span>Crea Contatto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Note Modal Unificato - Nota Vocale, Scritta e Non in Target */}
      {showNoteModal && notePlace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2 text-gray-900">📝 Aggiungi Nota</h3>
            <p className="text-gray-700 mb-4 font-medium">{notePlace.name}</p>

            {/* Se sta registrando, mostra UI di registrazione */}
            {isRecording ? (
              <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-white text-2xl">🎤</span>
                  </div>
                  <p className="text-red-700 font-semibold text-lg">Registrazione in corso...</p>
                  <p className="text-red-600 text-sm mt-1">Parla ora</p>
                </div>
                <button
                  onClick={() => stopRecording()}
                  className="w-full px-4 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-lg flex items-center justify-center gap-2"
                >
                  STOP - Termina Registrazione
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Nota Vocale */}
                <button
                  onClick={() => {
                    setSelectedPlace(notePlace);
                    startRecording();
                  }}
                  className="w-full px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-left font-medium flex items-center gap-3"
                >
                  <span className="text-xl">🎤</span>
                  <span>Registra nota vocale</span>
                </button>

                {/* Nota Scritta */}
                <div className="bg-green-50 rounded-lg p-3">
                  <label className="text-green-700 font-medium flex items-center gap-2 mb-2">
                    <span className="text-xl">✏️</span>
                    <span>Nota scritta</span>
                  </label>
                  <textarea
                    value={writtenNote}
                    onChange={(e) => setWrittenNote(e.target.value)}
                    placeholder="Scrivi una nota..."
                    className="w-full px-3 py-2 border border-green-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows={3}
                  />
                  {writtenNote.trim() && (
                    <button
                      onClick={saveWrittenNote}
                      disabled={isSavingNote}
                      className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                    >
                      {isSavingNote ? 'Salvataggio...' : 'Salva Nota'}
                    </button>
                  )}
                </div>

                {/* Opzioni di esclusione - tutte allo stesso livello */}
                <button
                  onClick={() => markAsNotTarget('closed')}
                  className="w-full px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-left font-medium flex items-center gap-3"
                >
                  <span className="text-xl">🔴</span>
                  <span>Chiuso definitivamente</span>
                </button>
                <button
                  onClick={() => markAsNotTarget('not_interested')}
                  className="w-full px-4 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 text-left font-medium flex items-center gap-3"
                >
                  <span className="text-xl">🟠</span>
                  <span>Non interessato</span>
                </button>
                <button
                  onClick={() => markAsNotTarget('other')}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-left font-medium flex items-center gap-3"
                >
                  <span className="text-xl">🚫</span>
                  <span>Non in Target</span>
                </button>
              </div>
            )}

            {!isRecording && (
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNotePlace(null);
                }}
                className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                Chiudi
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAnalysisModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">🤖 Analisi AI</h3>
              <button
                onClick={() => {
                  setShowAnalysisModal(false);
                  setAnalysisPlace(null);
                  setAnalysisResult(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {analysisPlace && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900">{analysisPlace.name}</p>
                {analysisPlace.address && (
                  <p className="text-sm text-gray-600">{analysisPlace.address}</p>
                )}
                {analysisPlace.website && (
                  <a
                    href={analysisPlace.website.startsWith('http') ? analysisPlace.website : `https://${analysisPlace.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {analysisPlace.website}
                  </a>
                )}
              </div>
            )}

            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
                <p className="text-gray-600 font-medium">Analisi in corso...</p>
                <p className="text-sm text-gray-500 mt-1">Sto analizzando il sito web e preparando suggerimenti</p>
              </div>
            ) : analysisResult ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {analysisResult}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              {!isAnalyzing && analysisResult && (
                <button
                  onClick={() => analyzeClient(analysisPlace)}
                  className="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
                >
                  🔄 Rianalizza
                </button>
              )}
              <button
                onClick={() => {
                  setShowAnalysisModal(false);
                  setAnalysisPlace(null);
                  setAnalysisResult(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
