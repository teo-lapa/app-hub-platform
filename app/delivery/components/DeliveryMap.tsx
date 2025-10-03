'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delivery } from '../types';

interface DeliveryMapProps {
  deliveries: Delivery[];
  currentPosition: { lat: number; lng: number } | null;
  onMarkerClick?: (delivery: Delivery) => void;
}

export default function DeliveryMap({ deliveries, currentPosition, onMarkerClick }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapLoaded(true);
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google) return;

    // Only initialize map once - don't re-create on position changes!
    if (googleMapRef.current) return;

    // Initialize map
    const mapOptions: google.maps.MapOptions = {
      zoom: 12,
      center: currentPosition || { lat: 45.4642, lng: 9.1900 }, // Default to Milan
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy'
    };

    googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);
  }, [mapLoaded]);

  useEffect(() => {
    if (!googleMapRef.current) return;

    console.log('🗺️ [MAP] Aggiornamento markers con', deliveries.length, 'consegne');

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add current position marker - FURGONCINO ROSSO
    if (currentPosition) {
      const currentMarker = new google.maps.Marker({
        position: currentPosition,
        map: googleMapRef.current,
        icon: {
          // SVG path di un furgone per delivery
          path: 'M4,16 L4,6 C4,4.9 4.9,4 6,4 L10,4 L10,2 L14,2 L14,4 L18,4 C19.1,4 20,4.9 20,6 L20,16 M6,18.5 C6,17.67 6.67,17 7.5,17 C8.33,17 9,17.67 9,18.5 C9,19.33 8.33,20 7.5,20 C6.67,20 6,19.33 6,18.5 M15,18.5 C15,17.67 15.67,17 16.5,17 C17.33,17 18,17.67 18,18.5 C18,19.33 17.33,20 16.5,20 C15.67,20 15,19.33 15,18.5 M18,16 L18,11 L22,11 L22,13.5 L24,15 L24,16 M2,16 L2,15 L4,15 L4,16',
          fillColor: '#dc2626',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.2,
          anchor: new google.maps.Point(12, 12)
        },
        title: 'Il tuo furgone',
        zIndex: 1000
      });
      markersRef.current.push(currentMarker);
    }

    // Add delivery markers
    deliveries.forEach((delivery, index) => {
      if (!delivery.lat || !delivery.lng) {
        console.log('⚠️ [MAP] Consegna senza coordinate:', delivery.customerName);
        return;
      }

      // Determina colore e opacità in base allo stato
      // Blu = da consegnare (assigned)
      // Verde = completato (done)
      // Arancione = con residuo (isBackorder)
      // Trasparente = completato o con residuo
      const isBackorder = (delivery as any).isBackorder || false;
      const isCompleted = delivery.completed || delivery.state === 'done';

      let markerColor = '#3b82f6'; // Blu - da consegnare
      let markerOpacity = 1.0;

      if (isBackorder) {
        markerColor = '#f59e0b'; // Arancione - residuo
        markerOpacity = 0.5; // Trasparente
      } else if (isCompleted) {
        markerColor = '#10b981'; // Verde - completato
        markerOpacity = 0.5; // Trasparente
      }

      const marker = new google.maps.Marker({
        position: { lat: delivery.lat, lng: delivery.lng },
        map: googleMapRef.current,
        label: {
          text: String(index + 1),
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColor,
          fillOpacity: markerOpacity,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 12,
          labelOrigin: new google.maps.Point(0, 0)
        },
        title: delivery.customerName
      });

      // Info window - Compatto con solo nome cliente e note
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 6px; max-width: 200px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${delivery.customerName}</div>
            ${(delivery as any).note ? `<div style="font-size: 11px; color: #666; margin-bottom: 6px; font-style: italic;">${(delivery as any).note}</div>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current!, marker);
        if (onMarkerClick) {
          onMarkerClick(delivery);
        }
      });

      markersRef.current.push(marker);
    });

    console.log('✅ [MAP] Creati', markersRef.current.length, 'markers sulla mappa');

    // Fit bounds to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach(marker => {
        const position = marker.getPosition();
        if (position) {
          bounds.extend(position);
        }
      });
      googleMapRef.current.fitBounds(bounds);
      console.log('🎯 [MAP] Bounds aggiustati per mostrare tutti i markers');
    }
  }, [deliveries, currentPosition, onMarkerClick]);

  return (
    <div className="h-full w-full relative">
      <div ref={mapRef} className="h-full w-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-3" />
            <div className="text-gray-600">Caricamento mappa...</div>
          </div>
        </div>
      )}
    </div>
  );
}
