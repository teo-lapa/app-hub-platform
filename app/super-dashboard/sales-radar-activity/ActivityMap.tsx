'use client';

import { useEffect, useRef, useState } from 'react';
import type { SalesRadarActivity } from '@/lib/super-dashboard/types';

interface ActivityMapProps {
  activities: SalesRadarActivity[];
}

// Marker colors based on activity type
const MARKER_COLORS: Record<SalesRadarActivity['type'], string> = {
  lead_created: '#F97316',      // Orange
  voice_note: '#A855F7',        // Purple
  written_note: '#3B82F6',      // Blue
  stage_change: '#10B981',      // Green
  lead_archived: '#EF4444',     // Red
  lead_reactivated: '#34D399',  // Emerald
  tag_added: '#F59E0B',         // Yellow
  tag_removed: '#F59E0B',       // Yellow
  note_added: '#06B6D4',        // Cyan
  field_updated: '#6B7280'      // Gray
};

export default function ActivityMap({ activities }: ActivityMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    // Load Google Maps script
    const loadGoogleMaps = async () => {
      if (window.google?.maps) {
        setIsLoaded(true);
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setMapError('Google Maps API key non configurata');
        return;
      }

      try {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          setIsLoaded(true);
        };

        script.onerror = () => {
          setMapError('Errore nel caricamento di Google Maps');
        };

        document.head.appendChild(script);
      } catch (err) {
        setMapError('Errore nel caricamento di Google Maps');
      }
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || activities.length === 0) return;

    const initMap = async () => {
      try {
        // Calculate center from activities
        const lats = activities.map(a => a.location!.lat);
        const lngs = activities.map(a => a.location!.lng);
        const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

        // Initialize map
        const map = new google.maps.Map(mapRef.current!, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 12,
          mapId: 'sales-radar-activity-map',
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a40' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
          ],
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });

        mapInstanceRef.current = map;

        // Clear existing markers
        markersRef.current.forEach(marker => {
          marker.map = null;
        });
        markersRef.current = [];

        // Add markers for each activity
        for (const activity of activities) {
          if (!activity.location) continue;

          const color = MARKER_COLORS[activity.type];

          // Create custom marker element
          const markerElement = document.createElement('div');
          markerElement.innerHTML = `
            <div style="
              width: 32px;
              height: 32px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: transform 0.2s;
            " class="activity-marker">
              ${getMarkerIcon(activity.type)}
            </div>
          `;

          // Add hover effect
          markerElement.addEventListener('mouseenter', () => {
            const inner = markerElement.querySelector('.activity-marker') as HTMLElement;
            if (inner) inner.style.transform = 'scale(1.2)';
          });
          markerElement.addEventListener('mouseleave', () => {
            const inner = markerElement.querySelector('.activity-marker') as HTMLElement;
            if (inner) inner.style.transform = 'scale(1)';
          });

          // Create AdvancedMarkerElement
          const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: { lat: activity.location.lat, lng: activity.location.lng },
            content: markerElement,
            title: activity.targetName
          });

          // Create info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 250px; font-family: system-ui, sans-serif;">
                <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${activity.targetName}</div>
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                  ${activity.userName} - ${getActivityTypeLabel(activity.type)}
                </div>
                ${activity.preview ? `<div style="font-size: 12px; color: #4b5563; font-style: italic; margin-bottom: 8px;">"${activity.preview}"</div>` : ''}
                <a href="${process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com'}/web#id=${activity.targetId}&model=${activity.targetType === 'lead' ? 'crm.lead' : 'res.partner'}&view_type=form"
                   target="_blank"
                   style="font-size: 12px; color: #6366f1; text-decoration: none;">
                  Apri in Odoo →
                </a>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);
        }

        // Fit bounds to show all markers
        if (activities.length > 1) {
          const bounds = new google.maps.LatLngBounds();
          activities.forEach(a => {
            if (a.location) {
              bounds.extend({ lat: a.location.lat, lng: a.location.lng });
            }
          });
          map.fitBounds(bounds, 50);
        }

      } catch (err) {
        console.error('Error initializing map:', err);
        setMapError('Errore nell\'inizializzazione della mappa');
      }
    };

    initMap();
  }, [isLoaded, activities]);

  if (mapError) {
    return (
      <div className="w-full h-[400px] bg-slate-800/50 rounded-xl flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p>{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-[500px] rounded-xl overflow-hidden"
        style={{ minHeight: '400px' }}
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500" />
          <span className="text-slate-400">Lead Creati</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-purple-500" />
          <span className="text-slate-400">Note Vocali</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-slate-400">Note Scritte</span>
        </div>
      </div>

      {/* Activity Count */}
      <div className="text-center text-slate-500 text-sm">
        {activities.length} attività con posizione GPS
      </div>
    </div>
  );
}

function getMarkerIcon(type: SalesRadarActivity['type']): string {
  switch (type) {
    case 'lead_created':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    case 'voice_note':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
    case 'written_note':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    case 'stage_change':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>';
    case 'lead_archived':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    case 'lead_reactivated':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
    case 'tag_added':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/></svg>';
    case 'tag_removed':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/></svg>';
    case 'note_added':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    case 'field_updated':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
    default:
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  }
}

function getActivityTypeLabel(type: SalesRadarActivity['type']): string {
  switch (type) {
    case 'lead_created':
      return 'Lead creato';
    case 'voice_note':
      return 'Nota vocale';
    case 'written_note':
      return 'Nota scritta';
    case 'stage_change':
      return 'Cambio stato';
    case 'lead_archived':
      return 'Lead archiviato';
    case 'lead_reactivated':
      return 'Lead riattivato';
    case 'tag_added':
      return 'Tag aggiunto';
    case 'tag_removed':
      return 'Tag rimosso';
    case 'note_added':
      return 'Nota aggiunta';
    case 'field_updated':
      return 'Campo modificato';
    default:
      return 'Attività';
  }
}
