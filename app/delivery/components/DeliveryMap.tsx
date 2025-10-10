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
  const vehicleMarkerRef = useRef<google.maps.Marker | null>(null);
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
      gestureHandling: 'greedy',
      // Disabilita animazioni eccessive per evitare tremolii
      disableDefaultUI: false,
      clickableIcons: false
    };

    googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);
  }, [mapLoaded]);

  // Aggiorna il marker del veicolo separatamente per evitare tremolii
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;

    if (currentPosition) {
      // Se il marker esiste già, aggiorna solo la posizione
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setPosition(currentPosition);
      } else {
        // Altrimenti crea il marker
        vehicleMarkerRef.current = new google.maps.Marker({
          position: currentPosition,
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                <!-- Ombra -->
                <ellipse cx="32" cy="58" rx="18" ry="4" fill="#000000" opacity="0.3"/>

                <!-- Cerchio blu di sfondo -->
                <circle cx="32" cy="30" r="26" fill="#3b82f6" stroke="#1e40af" stroke-width="3"/>

                <!-- Emoji camion gigante -->
                <text x="32" y="42" font-size="36" text-anchor="middle" font-family="Arial, sans-serif">🚚</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(64, 64),
            anchor: new google.maps.Point(32, 58),
            labelOrigin: new google.maps.Point(32, 30)
          },
          title: '🚚 Il tuo furgone',
          zIndex: 1000,
          optimized: true
        });
      }
    }
  }, [currentPosition, mapLoaded]);

  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;

    console.log('🗺️ [MAP] Aggiornamento markers con', deliveries.length, 'consegne');

    // Clear existing markers (solo marker delle consegne, non il veicolo)
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add delivery markers
    deliveries.forEach((delivery, index) => {
      if (!delivery.lat || !delivery.lng) {
        console.log('⚠️ [MAP] Consegna senza coordinate:', delivery.customerName);
        return;
      }

      // Determina colore e opacità in base allo stato
      const isBackorder = (delivery as any).isBackorder || false;
      const isCompleted = delivery.completed || delivery.state === 'done';

      let markerColor = '#3b82f6'; // Blu - da consegnare
      let borderColor = '#1e40af';
      let markerOpacity = 1.0;

      if (isBackorder) {
        markerColor = '#f59e0b'; // Arancione - residuo
        borderColor = '#d97706';
        markerOpacity = 0.6;
      } else if (isCompleted) {
        markerColor = '#10b981'; // Verde - completato
        borderColor = '#059669';
        markerOpacity = 0.6;
      }

      // Crea un marker SVG più piccolo e professionale (pin style)
      const pinIcon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="52" viewBox="0 0 28 40">
            <g opacity="${markerOpacity}">
              <!-- Pin shadow -->
              <ellipse cx="14" cy="38" rx="6" ry="2" fill="#000000" opacity="0.2"/>
              <!-- Pin body -->
              <path d="M14 1 C 8 1, 3 6, 3 12 C 3 20, 14 36, 14 36 C 14 36, 25 20, 25 12 C 25 6, 20 1, 14 1 Z"
                    fill="${markerColor}" stroke="${borderColor}" stroke-width="1.5"/>
              <!-- Pin inner circle (white background for number) -->
              <circle cx="14" cy="12" r="7" fill="white"/>
              <!-- Number text -->
              <text x="14" y="16" font-family="Arial, sans-serif" font-size="10" font-weight="bold"
                    text-anchor="middle" fill="${borderColor}">${index + 1}</text>
            </g>
          </svg>
        `),
        scaledSize: new google.maps.Size(36, 52),
        anchor: new google.maps.Point(18, 48),
        labelOrigin: new google.maps.Point(18, 16)
      };

      const marker = new google.maps.Marker({
        position: { lat: delivery.lat, lng: delivery.lng },
        map: googleMapRef.current,
        icon: pinIcon,
        title: delivery.customerName,
        optimized: true, // Abilita rendering ottimizzato per evitare tremolii
        zIndex: isCompleted ? 1 : 10
      });

      // Info window - Migliorato con più dettagli
      const statusBadge = isBackorder ?
        '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">RESIDUO</span>' :
        isCompleted ?
        '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">✓ COMPLETATO</span>' :
        '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">DA CONSEGNARE</span>';

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 180px; max-width: 240px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 600; color: #666;">#${index + 1}</span>
              ${statusBadge}
            </div>
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1f2937;">${delivery.customerName}</div>
            ${(delivery as any).address ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">📍 ${(delivery as any).address}</div>` : ''}
            ${(delivery as any).note ? `<div style="font-size: 11px; color: #f59e0b; background: #fffbeb; padding: 4px 6px; border-radius: 4px; margin-top: 4px; border-left: 2px solid #f59e0b;"><strong>Nota:</strong> ${(delivery as any).note}</div>` : ''}
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

    // Fit bounds to show all markers solo al primo caricamento
    if (markersRef.current.length > 0 && deliveries.length > 0) {
      const bounds = new google.maps.LatLngBounds();

      // Aggiungi tutti i marker delle consegne
      markersRef.current.forEach(marker => {
        const position = marker.getPosition();
        if (position) {
          bounds.extend(position);
        }
      });

      // Aggiungi anche il marker del veicolo se esiste
      if (vehicleMarkerRef.current) {
        const vehiclePos = vehicleMarkerRef.current.getPosition();
        if (vehiclePos) {
          bounds.extend(vehiclePos);
        }
      }

      googleMapRef.current.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50
      });
      console.log('🎯 [MAP] Bounds aggiustati per mostrare tutti i markers');
    }
  }, [deliveries, onMarkerClick, mapLoaded]);

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
