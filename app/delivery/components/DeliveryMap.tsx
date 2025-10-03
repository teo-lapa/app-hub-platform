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
  }, [mapLoaded, currentPosition]);

  useEffect(() => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add current position marker
    if (currentPosition) {
      const currentMarker = new google.maps.Marker({
        position: currentPosition,
        map: googleMapRef.current,
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        },
        title: 'La tua posizione'
      });
      markersRef.current.push(currentMarker);
    }

    // Add delivery markers
    deliveries.forEach((delivery, index) => {
      if (!delivery.latitude || !delivery.longitude) return;

      const marker = new google.maps.Marker({
        position: { lat: delivery.latitude, lng: delivery.longitude },
        map: googleMapRef.current,
        label: {
          text: String(index + 1),
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          url: delivery.state === 'done'
            ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
            : 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          labelOrigin: new google.maps.Point(16, 16)
        },
        title: delivery.partner_id[1]
      });

      // Info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <h3 style="font-weight: bold; margin-bottom: 4px;">${delivery.partner_id[1]}</h3>
            ${delivery.eta ? `<p style="font-size: 14px;">ETA: ${delivery.eta} min</p>` : ''}
            <button
              onclick="window.navigateToDelivery(${delivery.latitude}, ${delivery.longitude})"
              style="margin-top: 8px; padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;"
            >
              🗺️ Naviga
            </button>
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
