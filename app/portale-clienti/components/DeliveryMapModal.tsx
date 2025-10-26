'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { motion, AnimatePresence } from 'framer-motion';

interface DeliveryMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: number;
  deliveryName: string;
}

interface DeliveryLocation {
  destinationCoordinates: { lat: number; lng: number } | null;
  gpsPosition: { lat: number; lng: number } | null;
  destinationAddress: string;
  partnerName: string;
  driverName: string | null;
  vehiclePlate: string | null;
  state: string;
}

export function DeliveryMapModal({ isOpen, onClose, deliveryId, deliveryName }: DeliveryMapModalProps) {
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchLocation = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/portale-clienti/deliveries/${deliveryId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setLocation({
            destinationCoordinates: data.delivery.destinationCoordinates,
            gpsPosition: data.delivery.gpsPosition,
            destinationAddress: data.delivery.destinationAddress,
            partnerName: data.delivery.partnerName,
            driverName: data.delivery.driverName,
            vehiclePlate: data.delivery.vehiclePlate,
            state: data.delivery.state,
          });
        }
      } catch (error) {
        console.error('Errore recupero location:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocation();
  }, [isOpen, deliveryId]);

  // Auto-refresh GPS ogni 30 secondi
  useEffect(() => {
    if (!isOpen || !location) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/portale-clienti/deliveries/${deliveryId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setLocation(prev => prev ? {
            ...prev,
            gpsPosition: data.delivery.gpsPosition,
          } : null);
        }
      } catch (error) {
        console.error('Errore refresh GPS:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen, location, deliveryId]);

  const mapCenter = location?.gpsPosition || location?.destinationCoordinates || { lat: 45.4642, lng: 9.1900 };

  const mapContainerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '0.5rem',
  };

  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  Tracking Consegna
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {deliveryName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Caricamento mappa...</p>
                  </div>
                </div>
              ) : location && (location.destinationCoordinates || location.gpsPosition) ? (
                <>
                  {/* Info consegna */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {location.destinationAddress && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📍 Destinazione</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {location.destinationAddress}
                        </p>
                      </div>
                    )}
                    {location.driverName && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">👤 Autista</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {location.driverName}
                          {location.vehiclePlate && (
                            <span className="text-gray-600 dark:text-gray-400 ml-2">
                              🚗 {location.vehiclePlate}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Google Maps */}
                  <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={mapCenter}
                      zoom={13}
                      options={mapOptions}
                    >
                      {/* Marker destinazione (verde) */}
                      {location.destinationCoordinates && (
                        <Marker
                          position={{
                            lat: location.destinationCoordinates.lat,
                            lng: location.destinationCoordinates.lng,
                          }}
                          icon={{
                            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="20" cy="20" r="18" fill="#10b981" stroke="#059669" stroke-width="2"/>
                                <text x="20" y="28" font-size="24" text-anchor="middle" fill="white">📍</text>
                              </svg>
                            `),
                          }}
                          title={location.partnerName}
                        />
                      )}

                      {/* Marker autista (blu) */}
                      {location.gpsPosition && (
                        <Marker
                          position={{
                            lat: location.gpsPosition.lat,
                            lng: location.gpsPosition.lng,
                          }}
                          icon={{
                            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                              <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="25" cy="25" r="22" fill="#3b82f6" stroke="#1e40af" stroke-width="3"/>
                                <text x="25" y="34" font-size="28" text-anchor="middle" fill="white">🚚</text>
                              </svg>
                            `),
                          }}
                          title="Autista in arrivo"
                        />
                      )}
                    </GoogleMap>
                  </LoadScript>

                  {/* Legenda */}
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                        📍
                      </div>
                      <span className="text-gray-600 dark:text-gray-400">Destinazione</span>
                    </div>
                    {location.gpsPosition && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
                          🚚
                        </div>
                        <span className="text-gray-600 dark:text-gray-400">Autista (aggiornato in tempo reale)</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[500px]">
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">
                      📍 Posizione GPS non disponibile per questa consegna
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
