'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Customer {
  id: number;
  name: string;
  ref: string;
  city: string;
  phone: string;
  pricelist?: string;
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

interface CustomerStats {
  totalRevenue: number;
  averageOrderValue: number;
  orderCount: number;
}

interface GlobalStats {
  averageOrderValue: number;
  orderCount: number;
}

export default function CustomerSelector({ onCustomerSelect, onAddressSelect }: CustomerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // RICERCA LIVE su Odoo invece di caricare tutti i clienti
  const searchCustomersLive = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setFilteredCustomers([]);
      setShowDropdown(false);
      return;
    }

    setLoadingCustomers(true);
    setError(null);

    try {
      console.log(`🔍 Ricerca live clienti: "${term}"`);

      const response = await fetch(`/api/clienti/search?q=${encodeURIComponent(term)}&userId=7`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Trovati ${data.count} clienti`);

        // Transform API data to match component interface
        const transformedCustomers = (data.results || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          ref: c.id.toString(),
          city: c.city || '',
          phone: c.phone || '',
          pricelist: c.pricelist || null
        }));

        console.log('📋 Clienti trasformati:', transformedCustomers);
        setFilteredCustomers(transformedCustomers);
        setShowDropdown(true);
        console.log('✅ Dropdown dovrebbe essere visibile ora');
      } else {
        console.error('❌ Errore ricerca:', data.error);
        setFilteredCustomers([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('❌ Errore ricerca live:', err);
      setError(err instanceof Error ? err.message : 'Errore ricerca');
      setFilteredCustomers([]);
      setShowDropdown(false);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  // Debounced LIVE search (500ms)
  const debouncedLiveSearch = useCallback((term: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchCustomersLive(term);
    }, 500);
  }, [searchCustomersLive]);

  // Search when term changes
  useEffect(() => {
    debouncedLiveSearch(searchTerm);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debouncedLiveSearch]);

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


  const fetchAddresses = async (customerId: number) => {
    setLoadingAddresses(true);
    setError(null);
    try {
      const response = await fetch('/api/catalogo-venditori/customer-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      if (!response.ok) throw new Error('Errore nel caricamento indirizzi');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel caricamento indirizzi');
      }

      // Transform API data to match component interface
      const transformedAddresses = (data.data || []).map((a: any) => ({
        id: a.id,
        address: `${a.street || ''} ${a.street2 || ''}`.trim(),
        city: a.city || '',
        cap: a.zip || ''
      }));

      setAddresses(transformedAddresses);
      console.log(`✅ Loaded ${transformedAddresses.length} addresses for customer ${customerId}`);

      // SELEZIONE AUTOMATICA del primo indirizzo
      if (transformedAddresses.length > 0) {
        const firstAddressId = transformedAddresses[0].id;
        setSelectedAddressId(firstAddressId);
        onAddressSelect(firstAddressId);
        console.log(`🎯 Auto-selezionato primo indirizzo: ${firstAddressId}`);
      }
    } catch (err) {
      console.error('❌ Error loading addresses:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Fetch global stats (once)
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const response = await fetch('/api/catalogo-venditori/global-stats');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.stats) {
            setGlobalStats(data.stats);
            console.log('✅ Statistiche globali caricate:', data.stats);
          }
        }
      } catch (err) {
        console.error('❌ Error loading global stats:', err);
      }
    };
    fetchGlobalStats();
  }, []);

  // Fetch customer stats when customer is selected
  const fetchCustomerStats = async (customerId: number) => {
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/catalogo-venditori/customer-stats?customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          setCustomerStats(data.stats);
          console.log('✅ Statistiche cliente caricate:', data.stats);
        } else {
          setCustomerStats(null);
        }
      }
    } catch (err) {
      console.error('❌ Error loading customer stats:', err);
      setCustomerStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  // Calculate customer position (same logic as review-prices)
  const getCustomerPosition = () => {
    if (!customerStats || !globalStats || globalStats.averageOrderValue === 0) {
      return null;
    }

    const ratio = customerStats.averageOrderValue / globalStats.averageOrderValue;

    let position;
    let label;
    let color;

    if (ratio < 0.5) {
      position = ratio * 40; // 0-20%
      label = 'Molto Sotto Media';
      color = 'rgb(239, 68, 68)'; // red
    } else if (ratio < 0.9) {
      position = 20 + ((ratio - 0.5) / 0.4) * 25; // 20-45%
      label = 'Sotto Media';
      color = 'rgb(251, 191, 36)'; // yellow
    } else if (ratio < 1.1) {
      position = 45 + ((ratio - 0.9) / 0.2) * 10; // 45-55%
      label = 'Media';
      color = 'rgb(59, 130, 246)'; // blue
    } else if (ratio < 1.5) {
      position = 55 + ((ratio - 1.1) / 0.4) * 25; // 55-80%
      label = 'Sopra Media';
      color = 'rgb(34, 197, 94)'; // green
    } else {
      position = 80 + Math.min((ratio - 1.5) / 1.5 * 20, 20); // 80-100%
      label = 'Molto Sopra Media';
      color = 'rgb(168, 85, 247)'; // purple
    }

    return {
      position: Math.min(Math.max(position, 0), 100),
      label,
      color,
      customerAvg: customerStats.averageOrderValue,
      globalAvg: globalStats.averageOrderValue
    };
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer.name);
    setShowDropdown(false);
    setSelectedAddressId(null);
    setCustomerStats(null); // Reset stats
    onCustomerSelect(customer.id, customer.name);
    fetchAddresses(customer.id);
    fetchCustomerStats(customer.id); // Load stats
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
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchTerm && setShowDropdown(true)}
            placeholder="🔍 Cerca in TUTTI i clienti Odoo..."
            autoComplete="off"
            className="w-full min-h-[52px] sm:min-h-[48px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            style={{
              fontSize: '16px',
              lineHeight: '1.5',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              WebkitFontSmoothing: 'antialiased',
            }}
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
          <div className="absolute z-[9999] w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-[300px] overflow-y-auto overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
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
                {selectedCustomer.pricelist && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Livello:</span>
                    <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                      {selectedCustomer.pricelist}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Città:</span>
                  <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{selectedCustomer.city}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Telefono:</span>
                  <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{selectedCustomer.phone}</span>
                </div>

                {/* Customer Importance Bar */}
                {(() => {
                  const position = getCustomerPosition();
                  if (!position && !loadingStats) return null;

                  if (loadingStats) {
                    return (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-slate-400">Caricamento importanza cliente...</span>
                      </div>
                    );
                  }

                  if (!position) return null;

                  return (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-slate-400" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                          Importanza Cliente (ultimi 3 mesi)
                        </p>
                        <p className="text-xs text-slate-400" style={{ fontSize: '11px', lineHeight: '1.5' }}>
                          CHF {position.customerAvg.toFixed(0)} vs {position.globalAvg.toFixed(0)}
                        </p>
                      </div>

                      {/* Position Bar */}
                      <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600">
                        {/* Gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-blue-500 via-green-500 to-purple-500 opacity-40"></div>

                        {/* Customer position marker */}
                        <div
                          className="absolute top-0 bottom-0 w-1 -ml-0.5 transition-all duration-300"
                          style={{
                            left: `${position.position}%`,
                            backgroundColor: position.color,
                            boxShadow: `0 0 8px ${position.color}`
                          }}
                        />
                      </div>

                      {/* Label */}
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-slate-500">Molto Sotto</p>
                        <p
                          className="text-xs font-bold"
                          style={{ color: position.color, fontSize: '11px', lineHeight: '1.5' }}
                        >
                          {position.label}
                        </p>
                        <p className="text-[10px] text-slate-500">Molto Sopra</p>
                      </div>

                      {/* Additional stats */}
                      {customerStats && customerStats.orderCount > 0 && (
                        <div className="mt-2 text-[10px] text-slate-400 bg-slate-700/30 rounded px-2 py-1">
                          {customerStats.orderCount} ordini • CHF {customerStats.totalRevenue.toFixed(0)} totale
                        </div>
                      )}
                    </div>
                  );
                })()}
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
