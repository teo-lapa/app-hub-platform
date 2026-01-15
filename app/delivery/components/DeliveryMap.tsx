'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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
  const hasInitializedBounds = useRef(false); // Per fare fitBounds solo la prima volta
  const [mapLoaded, setMapLoaded] = useState(false);
  const prevDeliveriesRef = useRef<string>(''); // Per tracciare cambiamenti reali

  useEffect(() => {
    // Load Google Maps script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`;
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

    // Previeni zoom della pagina quando si interagisce con la mappa
    const mapElement = mapRef.current;
    if (mapElement) {
      // Blocca touchmove per prevenire scroll/zoom della pagina
      mapElement.addEventListener('touchmove', (e) => {
        e.preventDefault();
      }, { passive: false });

      // Blocca gesture events (pinch-to-zoom) sulla pagina
      mapElement.addEventListener('gesturestart', (e) => {
        e.preventDefault();
      });
      mapElement.addEventListener('gesturechange', (e) => {
        e.preventDefault();
      });
      mapElement.addEventListener('gestureend', (e) => {
        e.preventDefault();
      });
    }
  }, [mapLoaded]);

  // Aggiorna il marker del veicolo separatamente per evitare tremolii
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;

    if (currentPosition) {
      // Se il marker esiste già, aggiorna solo la posizione con animazione smooth
      if (vehicleMarkerRef.current) {
        const newPosition = new google.maps.LatLng(currentPosition.lat, currentPosition.lng);
        vehicleMarkerRef.current.setPosition(newPosition);
      } else {
        // Altrimenti crea il marker
        vehicleMarkerRef.current = new google.maps.Marker({
          position: currentPosition,
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 64 64">
                <!-- Ombra -->
                <ellipse cx="32" cy="58" rx="18" ry="4" fill="#000000" opacity="0.3"/>

                <!-- Cerchio blu di sfondo -->
                <circle cx="32" cy="30" r="26" fill="#3b82f6" stroke="#1e40af" stroke-width="3"/>

                <!-- Emoji camion -->
                <text x="32" y="42" font-size="36" text-anchor="middle" font-family="Arial, sans-serif">🚚</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 36),
            labelOrigin: new google.maps.Point(20, 20)
          },
          title: '🚚 Il tuo furgone',
          zIndex: 1000,
          optimized: false // Disabilita per evitare tremolii
        });
      }
    }
  }, [currentPosition, mapLoaded]);

  // Crea una chiave stabile per i deliveries basata su id e stato
  const deliveriesKey = useMemo(() => {
    return deliveries
      .map(d => `${d.id}-${d.state}-${d.completed}`)
      .sort()
      .join('|');
  }, [deliveries]);

  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;

    // Controlla se i deliveries sono realmente cambiati
    if (prevDeliveriesRef.current === deliveriesKey) {
      console.log('🗺️ [MAP] Deliveries non cambiati, skip aggiornamento markers');
      return;
    }

    console.log('🗺️ [MAP] Aggiornamento markers con', deliveries.length, 'consegne');
    prevDeliveriesRef.current = deliveriesKey;

    // Clear existing markers (solo marker delle consegne, non il veicolo)
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add delivery markers
    deliveries.forEach((delivery, index) => {
      if (!delivery.lat || !delivery.lng) {
        console.log('⚠️ [MAP] Consegna senza coordinate:', delivery.customerName);
        return;
      }

      // Determina colore e opacità in base allo stato e tipo
      const isBackorder = (delivery as any).isBackorder || false;
      const isCompleted = delivery.completed || delivery.state === 'done';
      const isPickup = delivery.type === 'pickup';

      let markerColor = '#3b82f6'; // Blu - da consegnare
      let borderColor = '#1e40af';
      let markerOpacity = 1.0;
      let markerIcon = '📦';

      if (isPickup) {
        markerColor = '#9333ea'; // Viola - ritiro
        borderColor = '#7c3aed';
        markerIcon = '📥';
        if (isCompleted) {
          markerOpacity = 0.6;
        }
      } else if (isBackorder) {
        markerColor = '#f59e0b'; // Arancione - residuo
        borderColor = '#d97706';
        markerOpacity = 0.6;
      } else if (isCompleted) {
        markerColor = '#10b981'; // Verde - completato
        borderColor = '#059669';
        markerOpacity = 0.6;
      }

      // Crea un marker SVG - diverso per pickup vs delivery
      const pinIcon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="52" viewBox="0 0 28 40">
            <g opacity="${markerOpacity}">
              <!-- Pin shadow -->
              <ellipse cx="14" cy="38" rx="6" ry="2" fill="#000000" opacity="0.2"/>
              <!-- Pin body -->
              <path d="M14 1 C 8 1, 3 6, 3 12 C 3 20, 14 36, 14 36 C 14 36, 25 20, 25 12 C 25 6, 20 1, 14 1 Z"
                    fill="${markerColor}" stroke="${borderColor}" stroke-width="1.5"/>
              <!-- Pin inner circle (white background for number/icon) -->
              <circle cx="14" cy="12" r="7" fill="white"/>
              <!-- Number/Icon text -->
              <text x="14" y="16" font-family="Arial, sans-serif" font-size="${isPickup ? '12' : '10'}" font-weight="bold"
                    text-anchor="middle" fill="${borderColor}">${isPickup ? '📥' : index + 1}</text>
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
        title: isPickup ? `📥 RITIRO: ${delivery.supplier || delivery.customerName}` : delivery.customerName,
        optimized: false,
        zIndex: isCompleted ? 1 : (isPickup ? 15 : 10)
      });

      // Info window - diversa per pickup vs delivery
      let statusBadge: string;
      let actionButton: string;
      let displayName: string;
      let addressLabel: string;

      if (isPickup) {
        statusBadge = isCompleted ?
          '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">✓ RITIRATO</span>' :
          '<span style="background: #9333ea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">📥 RITIRO</span>';
        actionButton = `
          <button
            id="pickup-btn-${delivery.id}"
            style="flex: 1; background: #9333ea; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;"
          >
            📥 Ritira
          </button>
        `;
        displayName = `🏭 ${delivery.supplier || delivery.customerName}`;
        addressLabel = 'Fornitore';
      } else {
        statusBadge = isBackorder ?
          '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">RESIDUO</span>' :
          isCompleted ?
          '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">✓ COMPLETATO</span>' :
          '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">DA CONSEGNARE</span>';
        actionButton = `
          <button
            id="scarico-btn-${delivery.id}"
            style="flex: 1; background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;"
          >
            📦 Scarico
          </button>
        `;
        displayName = delivery.customerName;
        addressLabel = 'Cliente';
      }

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px; max-width: 280px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 600; color: #666;">${isPickup ? 'RITIRO' : '#' + (index + 1)}</span>
              ${statusBadge}
            </div>
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: ${isPickup ? '#7c3aed' : '#1f2937'};">${displayName}</div>
            ${(delivery as any).address ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">📍 ${(delivery as any).address}</div>` : ''}
            ${delivery.purchase_order ? `<div style="font-size: 11px; color: #9333ea; margin-bottom: 6px;">📋 ${delivery.purchase_order}</div>` : ''}
            ${(delivery as any).note ? `<div style="font-size: 11px; color: #f59e0b; background: #fffbeb; padding: 4px 6px; border-radius: 4px; margin-top: 4px; border-left: 2px solid #f59e0b;"><strong>Nota:</strong> ${(delivery as any).note}</div>` : ''}

            <div style="display: flex; gap: 6px; margin-top: 12px;">
              <button
                onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${delivery.lat},${delivery.lng}', '_blank')"
                style="flex: 1; background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;"
              >
                🧭 Naviga
              </button>
              ${actionButton}
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current!, marker);

        // Dopo che l'InfoWindow è aperta, aggiungi listener al pulsante
        google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
          if (isPickup) {
            const pickupBtn = document.getElementById(`pickup-btn-${delivery.id}`);
            if (pickupBtn && onMarkerClick) {
              pickupBtn.addEventListener('click', () => {
                onMarkerClick(delivery);
                infoWindow.close();
              });
            }
          } else {
            const scaricoBtn = document.getElementById(`scarico-btn-${delivery.id}`);
            if (scaricoBtn && onMarkerClick) {
              scaricoBtn.addEventListener('click', () => {
                onMarkerClick(delivery);
                infoWindow.close();
              });
            }
          }
        });
      });

      markersRef.current.push(marker);
    });

    console.log('✅ [MAP] Creati', markersRef.current.length, 'markers sulla mappa');

    // Fit bounds to show all markers SOLO la prima volta (non ogni volta che cambiano i deliveries)
    if (markersRef.current.length > 0 && deliveries.length > 0 && !hasInitializedBounds.current) {
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
      hasInitializedBounds.current = true; // Segna come inizializzato
      console.log('🎯 [MAP] Bounds aggiustati per mostrare tutti i markers (SOLO PRIMA VOLTA)');
    }
  }, [deliveriesKey, onMarkerClick, mapLoaded, deliveries]);

  return (
    <div className="h-full w-full relative" style={{ touchAction: 'none' }}>
      <div ref={mapRef} className="h-full w-full" style={{ touchAction: 'none' }} />
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
