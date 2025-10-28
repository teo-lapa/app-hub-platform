'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  MapPin,
  Filter,
  Calendar,
  CheckCircle,
  Users,
  DollarSign,
  ArrowLeft,
  UserPlus
} from 'lucide-react';
import { CustomerCard } from '@/components/maestro/CustomerCard';
import { InteractionModal } from '@/components/maestro/InteractionModal';
import { CustomerSearchInput } from '@/components/maestro/CustomerSearchInput';
import { useMaestroFilters } from '@/contexts/MaestroFiltersContext';
import type { DailyPlan, CustomerWithRecommendations, CustomerAvatar } from '@/lib/maestro/types';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

interface Salesperson {
  id: number;
  name: string;
  customer_count: number;
}

interface DailyPlanResponse {
  daily_plan: DailyPlan;
  summary: {
    total_customers_to_contact: number;
    urgent_count: number;
    high_priority_count: number;
    upsell_count: number;
    routine_count: number;
    estimated_hours: number;
  };
}

interface CustomerCardData {
  id: string; // UUID from customer_avatars.id
  odoo_partner_id: number;
  name: string;
  city: string;
  health_score: number;
  churn_risk: number;
  avg_order_value: number;
  last_order_days: number;
  recommendation: string;
  suggested_products: string[];
  priority: 'urgent' | 'high' | 'medium' | 'low';
  assigned_salesperson_id?: number; // FIX: Added to show vehicle products correctly
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converte CustomerWithRecommendations (API) a CustomerCardData (UI)
 */
function mapToCardData(customer: CustomerWithRecommendations, priority: 'urgent' | 'high' | 'medium' | 'low'): CustomerCardData {
  const { avatar, recommendations } = customer;

  // Prendi la prima raccomandazione (più importante)
  const topRec = recommendations[0];

  return {
    id: avatar.id, // UUID from customer_avatars.id
    odoo_partner_id: avatar.odoo_partner_id,
    name: avatar.name,
    city: avatar.city || 'N/A',
    health_score: avatar.health_score,
    churn_risk: avatar.churn_risk_score,
    avg_order_value: avatar.avg_order_value,
    last_order_days: avatar.days_since_last_order,
    recommendation: topRec?.description || 'Contattare cliente per follow-up di routine',
    suggested_products: topRec?.suggested_products?.map(id => `Prodotto ID ${id}`) || [],
    priority,
    assigned_salesperson_id: avatar.assigned_salesperson_id ?? undefined // FIX: Include salesperson ID (convert null to undefined)
  };
}

/**
 * Calcola potenziale revenue stimato
 */
function calculatePotentialRevenue(plan: DailyPlan | null): number {
  if (!plan) return 0;

  const allCustomers = [
    ...plan.urgent_customers,
    ...plan.high_priority_customers,
    ...plan.upsell_opportunities,
    ...plan.routine_followups
  ];

  return allCustomers.reduce((total, customer) => {
    // Stima conservativa: 50% dell'avg order value
    return total + (customer.avatar.avg_order_value * 0.5);
  }, 0);
}

/**
 * Calcola distanza totale stimata (placeholder - futuro geo-routing)
 */
function calculateTotalDistance(plan: DailyPlan | null): number {
  if (!plan) return 0;

  const allCustomers = [
    ...plan.urgent_customers,
    ...plan.high_priority_customers,
    ...plan.upsell_opportunities,
    ...plan.routine_followups
  ];

  // Stima semplice: 15 km per cliente (media)
  return allCustomers.length * 15;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DailyPlanPage() {
  // Use global vendor filter from context
  const { selectedVendor } = useMaestroFilters();

  // State
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [summary, setSummary] = useState<DailyPlanResponse['summary'] | null>(null);
  const [manuallyAddedCustomers, setManuallyAddedCustomers] = useState<CustomerCardData[]>([]);

  const [loading, setLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<{id: string, name: string, odoo_partner_id: number, assigned_salesperson_id?: number} | null>(null);
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'high' | 'medium'>('all');
  const [filterCity, setFilterCity] = useState<string>('all');

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch daily plan when vendor changes
  useEffect(() => {
    async function fetchDailyPlan() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedVendor?.id) {
          params.append('salesperson_id', selectedVendor.id.toString());
        }

        const res = await fetch(`/api/maestro/daily-plan?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch daily plan');

        const data: DailyPlanResponse = await res.json();
        setDailyPlan(data.daily_plan);
        setSummary(data.summary);

        console.log('Daily plan loaded:', data);
      } catch (error) {
        console.error('Error fetching daily plan:', error);
        toast.error('Errore nel caricare il piano giornaliero');
      } finally {
        setLoading(false);
      }
    }

    fetchDailyPlan();
  }, [selectedVendor]);

  // ============================================================================
  // DATA PROCESSING
  // ============================================================================

  // Converte dati API a formato CustomerCard
  const urgentCards: CustomerCardData[] = dailyPlan?.urgent_customers.map(c => mapToCardData(c, 'urgent')) || [];
  const highPriorityCards: CustomerCardData[] = dailyPlan?.high_priority_customers.map(c => mapToCardData(c, 'high')) || [];
  const upsellCards: CustomerCardData[] = dailyPlan?.upsell_opportunities.map(c => mapToCardData(c, 'medium')) || [];
  const followUpCards: CustomerCardData[] = dailyPlan?.routine_followups.map(c => mapToCardData(c, 'low')) || [];

  // Combine manually added customers with AI recommendations
  const allDailyCards = [
    ...manuallyAddedCustomers,
    ...urgentCards,
    ...highPriorityCards
  ];

  // Filtri
  const filterByPriority = (cards: CustomerCardData[]): CustomerCardData[] => {
    if (filterPriority === 'all') return cards;
    return cards.filter(c => c.priority === filterPriority);
  };

  const filterByCity = (cards: CustomerCardData[]): CustomerCardData[] => {
    if (filterCity === 'all') return cards;
    return cards.filter(c => c.city === filterCity);
  };

  const applyFilters = (cards: CustomerCardData[]): CustomerCardData[] => {
    return filterByCity(filterByPriority(cards));
  };

  // Lista città unique per filtro
  const allCards = [...urgentCards, ...highPriorityCards, ...upsellCards, ...followUpCards];
  const cities = Array.from(new Set(allCards.map(c => c.city))).sort();

  // Calcoli
  const potentialRevenue = calculatePotentialRevenue(dailyPlan);
  const totalDistance = calculateTotalDistance(dailyPlan);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleCompleteVisit = (customerId: string) => {
    const customer = allCards.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomer({
        id: customer.id,
        name: customer.name,
        odoo_partner_id: customer.odoo_partner_id,
        assigned_salesperson_id: customer.assigned_salesperson_id // FIX: Pass salesperson ID
      });
    }
  };

  const handleAddCustomer = (customer: CustomerAvatar) => {
    // Check if customer is already in the list
    const isAlreadyAdded = [
      ...manuallyAddedCustomers,
      ...urgentCards,
      ...highPriorityCards,
      ...upsellCards,
      ...followUpCards
    ].some(c => c.id === customer.id);

    if (isAlreadyAdded) {
      toast.error('Cliente già presente nel piano giornaliero');
      return;
    }

    // Add customer to manually added list
    const newCustomerCard: CustomerCardData = {
      id: customer.id,
      odoo_partner_id: customer.odoo_partner_id,
      name: customer.name,
      city: customer.city || 'N/A',
      health_score: customer.health_score,
      churn_risk: customer.churn_risk_score,
      avg_order_value: customer.avg_order_value,
      last_order_days: customer.days_since_last_order,
      recommendation: 'Visita aggiunta manualmente',
      suggested_products: [],
      priority: 'high'
    };

    setManuallyAddedCustomers(prev => [newCustomerCard, ...prev]);
    toast.success(`${customer.name} aggiunto al piano giornaliero`);
  };

  const handleRemoveManualCustomer = (customerId: string) => {
    setManuallyAddedCustomers(prev => prev.filter(c => c.id !== customerId));
    toast.success('Cliente rimosso dalla lista');
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <Link href="/maestro-ai">
            <button className="mb-4 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Torna alla Dashboard</span>
            </button>
          </Link>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Piano Giornaliero
              </h1>
              <p className="text-slate-400">
                Visite prioritizzate AI-driven
                {selectedVendor && (
                  <span className="ml-2 text-blue-400 font-medium">
                    • Venditore: {selectedVendor.name}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Vendor Filter Badge */}
              {selectedVendor && (
                <div className="px-4 py-2 bg-blue-600/20 border border-blue-500 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-300 font-medium">{selectedVendor.name}</span>
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span className="text-white font-medium">Oggi</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        {!loading && dailyPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Visite Pianificate</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {summary?.total_customers_to_contact || 0}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Revenue Potenziale</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    CHF {Math.round(potentialRevenue).toLocaleString('de-CH')}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Distanza Totale</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {totalDistance} km
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Tempo Stimato</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {summary?.estimated_hours.toFixed(1) || 0} ore
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        {!loading && dailyPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 flex-wrap"
          >
            <Filter className="h-5 w-5 text-slate-400" />

            {/* Priority Filter */}
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tutti' },
                { value: 'urgent', label: 'Urgenti', count: summary?.urgent_count },
                { value: 'high', label: 'Alta priorità', count: summary?.high_priority_count },
                { value: 'medium', label: 'Media priorità', count: summary?.upsell_count }
              ].map(({ value, label, count }) => (
                <button
                  key={value}
                  onClick={() => setFilterPriority(value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterPriority === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {label} {count !== undefined && `(${count})`}
                </button>
              ))}
            </div>

            {/* City Filter */}
            {cities.length > 0 && (
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 outline-none cursor-pointer"
              >
                <option value="all">Tutte le città</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 mt-4">Caricamento piano giornaliero...</p>
          </div>
        )}

        {/* DA FARE OGGI - Customer Search & Manual Additions */}
        {!loading && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <UserPlus className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">
                Da Fare Oggi
              </h2>
              <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm text-blue-400 font-medium">
                {allDailyCards.length} visite pianificate
              </span>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Aggiungi clienti manualmente o visualizza le visite prioritarie suggerite dall'AI
            </p>

            {/* Customer Search Input */}
            <CustomerSearchInput
              onSelectCustomer={handleAddCustomer}
              vendorId={selectedVendor?.id || null}
              placeholder="Cerca cliente per aggiungere alla lista..."
              className="mb-6"
            />

            {/* Manually Added Customers */}
            {manuallyAddedCustomers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="h-px flex-1 bg-slate-700" />
                  <span>Aggiunti Manualmente ({manuallyAddedCustomers.length})</span>
                  <div className="h-px flex-1 bg-slate-700" />
                </div>
                {manuallyAddedCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    variant="default"
                    onComplete={handleCompleteVisit}
                    onRemove={() => handleRemoveManualCustomer(customer.id)}
                  />
                ))}
              </div>
            )}

            {/* AI-Generated Priority Customers */}
            {(urgentCards.length > 0 || highPriorityCards.length > 0) && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="h-px flex-1 bg-slate-700" />
                  <span>Priorità AI ({urgentCards.length + highPriorityCards.length})</span>
                  <div className="h-px flex-1 bg-slate-700" />
                </div>

                {/* Show urgent customers */}
                {applyFilters(urgentCards).map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    variant="urgent"
                    onComplete={handleCompleteVisit}
                  />
                ))}

                {/* Show high priority customers */}
                {applyFilters(highPriorityCards).map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    variant="default"
                    onComplete={handleCompleteVisit}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {allDailyCards.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessuna visita pianificata. Cerca un cliente per iniziare.</p>
              </div>
            )}
          </motion.section>
        )}

        {/* URGENT Section */}
        {!loading && applyFilters(urgentCards).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white">
                URGENTE - Rischio Churn Alto
              </h2>
              <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-sm text-red-400 font-medium">
                {applyFilters(urgentCards).length} clienti
              </span>
            </div>
            <div className="space-y-4">
              {applyFilters(urgentCards).map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  variant="urgent"
                  onComplete={handleCompleteVisit}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* HIGH PRIORITY Section */}
        {!loading && applyFilters(highPriorityCards).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h2 className="text-2xl font-bold text-white">
                Alta Priorità
              </h2>
              <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-sm text-orange-400 font-medium">
                {applyFilters(highPriorityCards).length} clienti
              </span>
            </div>
            <div className="space-y-4">
              {applyFilters(highPriorityCards).map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  variant="default"
                  onComplete={handleCompleteVisit}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* UPSELL OPPORTUNITIES Section */}
        {!loading && applyFilters(upsellCards).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h2 className="text-2xl font-bold text-white">
                Opportunità Upsell
              </h2>
              <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-sm text-green-400 font-medium">
                {applyFilters(upsellCards).length} clienti
              </span>
            </div>
            <div className="space-y-4">
              {applyFilters(upsellCards).map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  variant="opportunity"
                  onComplete={handleCompleteVisit}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* FOLLOW-UPS Section */}
        {!loading && applyFilters(followUpCards).length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-white">
                Follow-ups di Routine
              </h2>
              <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-sm text-blue-400 font-medium">
                {applyFilters(followUpCards).length} clienti
              </span>
            </div>
            <div className="space-y-4">
              {applyFilters(followUpCards).map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  variant="default"
                  onComplete={handleCompleteVisit}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Empty State */}
        {!loading && allCards.length === 0 && (
          <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-lg">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Nessuna visita pianificata
            </h3>
            <p className="text-slate-400">
              Ottimo lavoro! Non ci sono clienti che richiedono attenzione urgente oggi.
            </p>
          </div>
        )}
      </div>

      {/* Interaction Modal */}
      {selectedCustomer && (
        <InteractionModal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          odooPartnerId={selectedCustomer.odoo_partner_id}
          salesPersonId={selectedCustomer.assigned_salesperson_id || selectedVendor?.id} // FIX: Fallback to selectedVendor when customer has no assigned salesperson
        />
      )}
    </div>
  );
}
