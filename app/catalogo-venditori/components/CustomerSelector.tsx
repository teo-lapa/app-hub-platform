'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Customer {
  id: number;
  name: string;
  ref: string;
  city: string;
  phone: string;
}

interface DeliveryAddress {
  id: number;
  address: string;
  city: string;
  cap: string;
}

interface CustomerSelectorProps {
  onCustomerSelect: (customerId: number, customerName: string) => void;
  onAddressSelect: (addressId: number | null) => void;
}

export default function CustomerSelector({ onCustomerSelect, onAddressSelect }: CustomerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Debounced search filter (300ms)
  const debouncedFilter = useCallback((term: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (term.trim() === '') {
        setFilteredCustomers([]);
        setShowDropdown(false);
      } else {
        const filtered = customers.filter(customer =>
          customer.name.toLowerCase().includes(term.toLowerCase()) ||
          customer.ref.toLowerCase().includes(term.toLowerCase()) ||
          customer.city.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredCustomers(filtered);
        setShowDropdown(true);
      }
    }, 300);
  }, [customers]);

  // Filter customers based on search term with debounce
  useEffect(() => {
    debouncedFilter(searchTerm);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debouncedFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    setError(null);
    try {
      const response = await fetch('/api/catalogo-venditori/customers');
      if (!response.ok) throw new Error('Errore nel caricamento clienti');
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchAddresses = async (customerId: number) => {
    setLoadingAddresses(true);
    setError(null);
    try {
      const response = await fetch(`/api/catalogo-venditori/customers/${customerId}/addresses`);
      if (!response.ok) throw new Error('Errore nel caricamento indirizzi');
      const data = await response.json();
      setAddresses(data.addresses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setShowDropdown(false);
    setSelectedAddressId(null);
    onCustomerSelect(customer.id, customer.name);
    fetchAddresses(customer.id);
  };

  const handleAddressChange = (addressId: string) => {
    const id = addressId === '' ? null : parseInt(addressId);
    setSelectedAddressId(id);
    onAddressSelect(id);
  };

  return (
    <div className="space-y-4">
      {/* Customer Search */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-slate-300 mb-2" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          Cerca Cliente
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchTerm && setShowDropdown(true)}
            placeholder="Cerca per nome, codice o città..."
            autoComplete="off"
            className="w-full min-h-[52px] sm:min-h-[48px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            style={{
              fontSize: '16px',
              lineHeight: '1.5',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              WebkitFontSmoothing: 'antialiased',
            }}
            disabled={loadingCustomers}
          />
          {searchTerm && !loadingCustomers && (
            <button
              onClick={() => {
                setSearchTerm('');
                setShowDropdown(false);
              }}
              className="absolute right-12 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              aria-label="Cancella ricerca"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {loadingCustomers && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && filteredCustomers.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-[300px] overflow-y-auto overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className="w-full min-h-[56px] sm:min-h-[48px] px-4 py-3 text-left active:bg-slate-600 transition-colors border-b border-slate-700 last:border-b-0"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div className="font-medium text-white" style={{ fontSize: '16px', lineHeight: '1.5' }}>{customer.name}</div>
                <div className="text-sm text-slate-400 mt-1" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                  {customer.ref} • {customer.city} • {customer.phone}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white mb-2" style={{ fontSize: '18px', lineHeight: '1.5' }}>
                {selectedCustomer.name}
              </h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Codice:</span>
                  <span className="font-mono bg-slate-900 px-2 py-1 rounded" style={{ fontSize: '14px' }}>
                    {selectedCustomer.ref}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Città:</span>
                  <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{selectedCustomer.city}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Telefono:</span>
                  <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{selectedCustomer.phone}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setSearchTerm('');
                setAddresses([]);
                setSelectedAddressId(null);
              }}
              className="min-h-[56px] min-w-[56px] sm:min-h-[48px] sm:min-w-[48px] flex items-center justify-center text-slate-400 hover:text-red-400 active:scale-95 transition-all flex-shrink-0"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              aria-label="Rimuovi cliente"
            >
              <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delivery Address Selector */}
      {selectedCustomer && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2" style={{ fontSize: '14px', lineHeight: '1.5' }}>
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Indirizzo di Consegna
          </label>
          {loadingAddresses ? (
            <div className="flex items-center justify-center min-h-[52px] sm:min-h-[48px] bg-slate-800 rounded-lg border border-slate-700">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : addresses.length > 0 ? (
            <select
              value={selectedAddressId ?? ''}
              onChange={(e) => handleAddressChange(e.target.value)}
              className="w-full min-h-[52px] sm:min-h-[48px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              style={{
                fontSize: '16px',
                lineHeight: '1.5',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                WebkitFontSmoothing: 'antialiased',
              }}
            >
              <option value="">Indirizzo principale</option>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.address}, {address.city} {address.cap}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-slate-400 bg-slate-800 rounded-lg p-4 border border-slate-700" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Nessun indirizzo alternativo disponibile
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-500">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
