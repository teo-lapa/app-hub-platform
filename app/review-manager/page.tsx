'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Star,
  MessageSquare,
  TrendingUp,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface BusinessWithMetrics {
  id: number;
  name: string;
  slug: string;
  ownerName?: string;
  city?: string;
  responseMode: 'auto' | 'manual';
  isActive: boolean;
  metrics?: {
    totalReviews: number;
    averageRating: number | null;
    pendingCount?: number;
  };
}

export default function ReviewManagerPage() {
  const [businesses, setBusinesses] = useState<BusinessWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);

  // Form nuovo business
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    city: '',
    responseMode: 'manual' as 'auto' | 'manual',
    responseTone: 'friendly'
  });

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    try {
      const res = await fetch('/api/review-manager/businesses');
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.data);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddBusiness(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch('/api/review-manager/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBusiness)
      });

      const data = await res.json();
      if (data.success) {
        setBusinesses([...businesses, data.data]);
        setShowAddForm(false);
        setNewBusiness({
          name: '',
          ownerName: '',
          ownerEmail: '',
          city: '',
          responseMode: 'manual',
          responseTone: 'friendly'
        });
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Errore:', error);
      alert('Errore nella creazione');
    }
  }

  async function handleSync(businessId: number) {
    setSyncing(businessId);
    try {
      const res = await fetch('/api/review-manager/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Sync completato: ${data.data.totalNew} nuove recensioni`);
        loadBusinesses();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Errore sync:', error);
    } finally {
      setSyncing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-7 h-7 text-blue-600" />
                Review Manager Pro
              </h1>
              <p className="text-gray-600 mt-1">
                Gestisci le recensioni dei tuoi clienti da tutte le piattaforme
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Aggiungi Cliente
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Clienti Attivi</p>
                <p className="text-2xl font-bold">{businesses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Recensioni Totali</p>
                <p className="text-2xl font-bold">
                  {businesses.reduce((sum, b) => sum + (b.metrics?.totalReviews || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Da Rispondere</p>
                <p className="text-2xl font-bold">
                  {businesses.reduce((sum, b) => sum + (b.metrics?.pendingCount || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Rating Medio</p>
                <p className="text-2xl font-bold">
                  {(businesses.reduce((sum, b) => sum + (b.metrics?.averageRating ? parseFloat(String(b.metrics.averageRating)) : 0), 0) / businesses.length || 0).toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista Business */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">I Tuoi Clienti</h2>
          </div>

          {businesses.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Nessun cliente ancora</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-blue-600 hover:underline"
              >
                Aggiungi il primo cliente
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {businesses.map((business) => (
                <div
                  key={business.id}
                  className="p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {business.name.charAt(0)}
                      </div>
                      <div>
                        <Link
                          href={`/review-manager/${business.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {business.name}
                        </Link>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {business.city && <span>{business.city}</span>}
                          <span className={`flex items-center gap-1 ${
                            business.responseMode === 'auto'
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}>
                            {business.responseMode === 'auto' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {business.responseMode === 'auto' ? 'Auto' : 'Manuale'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{business.metrics?.totalReviews || 0}</p>
                          <p className="text-gray-500">Recensioni</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            {business.metrics?.averageRating ? parseFloat(String(business.metrics.averageRating)).toFixed(1) : '-'}
                          </p>
                          <p className="text-gray-500">Rating</p>
                        </div>
                        {(business.metrics?.pendingCount || 0) > 0 && (
                          <div className="text-center">
                            <p className="font-semibold text-orange-600">
                              {business.metrics?.pendingCount}
                            </p>
                            <p className="text-gray-500">Pending</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSync(business.id)}
                          disabled={syncing === business.id}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                          title="Sincronizza"
                        >
                          <RefreshCw className={`w-5 h-5 ${syncing === business.id ? 'animate-spin' : ''}`} />
                        </button>
                        <Link
                          href={`/review-manager/${business.id}/settings`}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                          title="Impostazioni"
                        >
                          <Settings className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Aggiungi Business */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Nuovo Cliente</h2>

            <form onSubmit={handleAddBusiness} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome Attivita *</label>
                <input
                  type="text"
                  required
                  value={newBusiness.name}
                  onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="es. Ristorante Da Mario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nome Proprietario</label>
                <input
                  type="text"
                  value={newBusiness.ownerName}
                  onChange={(e) => setNewBusiness({ ...newBusiness, ownerName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="es. Mario Rossi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newBusiness.ownerEmail}
                  onChange={(e) => setNewBusiness({ ...newBusiness, ownerEmail: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="mario@ristorante.it"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Citta</label>
                <input
                  type="text"
                  value={newBusiness.city}
                  onChange={(e) => setNewBusiness({ ...newBusiness, city: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Milano"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Modalita Risposta</label>
                <select
                  value={newBusiness.responseMode}
                  onChange={(e) => setNewBusiness({ ...newBusiness, responseMode: e.target.value as 'auto' | 'manual' })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="manual">Manuale (approva prima di pubblicare)</option>
                  <option value="auto">Automatica (pubblica subito)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tono Risposte</label>
                <select
                  value={newBusiness.responseTone}
                  onChange={(e) => setNewBusiness({ ...newBusiness, responseTone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="friendly">Amichevole</option>
                  <option value="professional">Professionale</option>
                  <option value="elegant">Elegante</option>
                  <option value="casual">Casual</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crea Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
