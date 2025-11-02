'use client';

import { useState, useEffect } from 'react';
import {
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CreditCardIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

interface Address {
  street: string;
  street2: string;
  city: string;
  zip: string;
  state: string;
  country: string;
}

interface Profile {
  id: number;
  name: string;
  email: string;
  phone: string;
  mobile: string;
  address: Address;
  vat: string;
  creditLimit: number;
  currentCredit: number;
  availableCredit: number;
  salesPerson: string | null;
  paymentTerm: string | null;
  pricelist: string | null;
  website: string;
  notes: string;
}

export default function ProfiloPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/portale-clienti/profile');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore durante il caricamento del profilo');
      }

      setProfile(data.profile);
    } catch (err: any) {
      console.error('Errore fetch profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      currencyDisplay: 'code'
    }).format(amount);
  }

  function formatAddress(address: Address) {
    const parts = [
      address.street,
      address.street2,
      [address.zip, address.city].filter(Boolean).join(' '),
      address.state,
      address.country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Caricamento profilo...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 max-w-md w-full text-center">
          <p className="text-sm sm:text-base text-red-600 mb-3 sm:mb-4">{error || 'Profilo non trovato'}</p>
          <button
            onClick={fetchProfile}
            className="text-sm sm:text-base text-blue-600 hover:text-blue-700 font-medium"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">

        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Il Mio Profilo</h1>
          <p className="text-sm sm:text-base text-gray-600">Gestisci le tue informazioni personali e preferenze</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">

            {/* Anagrafica */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <UserCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Informazioni Personali</span>
                <span className="sm:hidden">Info Personali</span>
              </h2>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Ragione Sociale
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{profile.name}</p>
                </div>

                {profile.vat && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Partita IVA
                    </label>
                    <p className="text-sm sm:text-base text-gray-900 font-mono">{profile.vat}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contatti */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                Contatti
              </h2>

              <div className="space-y-3 sm:space-y-4">
                {profile.email && (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Email</p>
                      <a
                        href={`mailto:${profile.email}`}
                        className="text-sm sm:text-base text-blue-600 hover:text-blue-700 truncate block"
                      >
                        {profile.email}
                      </a>
                    </div>
                  </div>
                )}

                {profile.phone && (
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Telefono</p>
                      <a
                        href={`tel:${profile.phone}`}
                        className="text-gray-900 hover:text-blue-600"
                      >
                        {profile.phone}
                      </a>
                    </div>
                  </div>
                )}

                {profile.mobile && (
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Cellulare</p>
                      <a
                        href={`tel:${profile.mobile}`}
                        className="text-gray-900 hover:text-blue-600"
                      >
                        {profile.mobile}
                      </a>
                    </div>
                  </div>
                )}

                {profile.website && (
                  <div className="flex items-center gap-3">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Sito Web</p>
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {profile.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Indirizzo */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                Indirizzo
              </h2>

              <div className="space-y-1.5 sm:space-y-2">
                {profile.address.street && <p className="text-sm sm:text-base text-gray-900">{profile.address.street}</p>}
                {profile.address.street2 && <p className="text-sm sm:text-base text-gray-900">{profile.address.street2}</p>}
                <p className="text-sm sm:text-base text-gray-900">
                  {[profile.address.zip, profile.address.city].filter(Boolean).join(' ')}
                </p>
                {profile.address.state && <p className="text-sm sm:text-base text-gray-900">{profile.address.state}</p>}
                {profile.address.country && <p className="text-sm sm:text-base text-gray-700">{profile.address.country}</p>}
              </div>
            </div>

            {/* Note */}
            {profile.notes && (
              <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  Note
                </h2>
                <p className="text-sm sm:text-base text-gray-600 whitespace-pre-wrap">{profile.notes}</p>
              </div>
            )}
          </div>

          {/* Right Column - Financial & Commercial Info */}
          <div className="space-y-4 sm:space-y-6">

            {/* Situazione Credito */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <CreditCardIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Situazione Credito</span>
                <span className="sm:hidden">Credito</span>
              </h2>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    <span className="hidden sm:inline">Limite di Credito</span>
                    <span className="sm:hidden">Limite</span>
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {formatCurrency(profile.creditLimit)}
                  </p>
                </div>

                <div className="pt-3 sm:pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">
                    <span className="hidden sm:inline">Credito Utilizzato</span>
                    <span className="sm:hidden">Utilizzato</span>
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-orange-600">
                    {formatCurrency(profile.currentCredit)}
                  </p>
                </div>

                <div className="pt-3 sm:pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">
                    <span className="hidden sm:inline">Credito Disponibile</span>
                    <span className="sm:hidden">Disponibile</span>
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-green-600">
                    {formatCurrency(profile.availableCredit)}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="pt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min((profile.currentCredit / profile.creditLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((profile.currentCredit / profile.creditLimit) * 100).toFixed(1)}% utilizzato
                  </p>
                </div>
              </div>
            </div>

            {/* Info Commerciali */}
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-6 border border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <BuildingOfficeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Informazioni Commerciali</span>
                <span className="sm:hidden">Info Commerciali</span>
              </h2>

              <div className="space-y-4">
                {profile.salesPerson && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Agente di Vendita</p>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <p className="text-gray-900 font-medium">{profile.salesPerson}</p>
                    </div>
                  </div>
                )}

                {profile.paymentTerm && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Termini di Pagamento</p>
                    <p className="text-gray-900">{profile.paymentTerm}</p>
                  </div>
                )}

                {profile.pricelist && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Listino Prezzi</p>
                    <p className="text-gray-900">{profile.pricelist}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
