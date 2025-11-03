'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, AlertCircle, CheckCircle, XCircle, Save, X } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface SupplierCadence {
  id: string;
  supplier_id: number;
  supplier_name: string;
  cadence_type: 'fixed_days' | 'weekly' | 'biweekly' | 'monthly';
  cadence_value: number;
  is_active: boolean;
  next_order_date: string | null;
  last_order_date: string | null;
  average_lead_time_days: number;
  days_until_next_order: number | null;
  status: 'on_time' | 'due_soon' | 'overdue' | 'inactive';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  notes: string | null;
}

interface EditingCadence {
  id: string;
  cadence_value: number;
  is_active: boolean;
  notes: string;
}

export default function GestioneCadenzeFornitori() {
  const [suppliers, setSuppliers] = useState<SupplierCadence[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<SupplierCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Track ALL changes in a Map: supplier_id -> changes
  const [changes, setChanges] = useState<Map<string, Partial<EditingCadence>>>(new Map());

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, searchTerm, filterStatus]);

  async function loadSuppliers() {
    try {
      setLoading(true);
      const response = await fetch('/api/supplier-cadence');
      const data = await response.json();

      if (data.suppliers) {
        setSuppliers(data.suppliers);
      }
    } catch (error) {
      console.error('Errore caricamento fornitori:', error);
      setMessage({ type: 'error', text: 'Errore durante il caricamento dei fornitori' });
    } finally {
      setLoading(false);
    }
  }

  function filterSuppliers() {
    let filtered = [...suppliers];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'urgent') {
        filtered = filtered.filter(s => s.urgency === 'critical' || s.urgency === 'high');
      } else if (filterStatus === 'active') {
        filtered = filtered.filter(s => s.is_active);
      } else if (filterStatus === 'inactive') {
        filtered = filtered.filter(s => !s.is_active);
      } else {
        filtered = filtered.filter(s => s.status === filterStatus);
      }
    }

    // Sort: ATTIVI IN CIMA, poi per urgency
    filtered.sort((a, b) => {
      // Prima ordina per is_active (attivi prima)
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1; // attivi (-1) vanno prima di inattivi (1)
      }
      // Se uguale is_active, ordina per urgency
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    setFilteredSuppliers(filtered);
  }

  // Track change for a supplier
  function handleChange(supplierId: string, field: keyof EditingCadence, value: any) {
    setChanges(prev => {
      const newChanges = new Map(prev);
      const existing = newChanges.get(supplierId) || {};
      newChanges.set(supplierId, { ...existing, [field]: value });
      return newChanges;
    });
  }

  // Get value for display (from changes or original)
  function getValue(supplier: SupplierCadence, field: keyof EditingCadence): any {
    const change = changes.get(supplier.id);
    if (change && field in change) {
      return change[field];
    }
    return supplier[field as keyof SupplierCadence];
  }

  // Check if supplier has changes
  function hasChanges(supplierId: string): boolean {
    return changes.has(supplierId);
  }

  // Discard all changes
  function discardChanges() {
    setChanges(new Map());
    setMessage({ type: 'success', text: 'Modifiche annullate' });
    setTimeout(() => setMessage(null), 2000);
  }

  // Save ALL changes at once
  async function saveAllChanges() {
    if (changes.size === 0) {
      setMessage({ type: 'error', text: 'Nessuna modifica da salvare' });
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    try {
      setSaving(true);
      let successCount = 0;
      let errorCount = 0;

      // Save each changed supplier
      const changesArray = Array.from(changes.entries());
      for (const [supplierId, changeData] of changesArray) {
        try {
          const response = await fetch(`/api/supplier-cadence/${supplierId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cadence_value: changeData.cadence_value,
              cadence_type: 'fixed_days',
              is_active: changeData.is_active,
              notes: changeData.notes || null
            })
          });

          const data = await response.json();
          if (data.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      // Reload suppliers and clear changes
      await loadSuppliers();
      setChanges(new Map());

      // Show result message
      if (errorCount === 0) {
        setMessage({ type: 'success', text: `✅ ${successCount} fornitori aggiornati con successo` });
      } else {
        setMessage({ type: 'error', text: `⚠️ ${successCount} aggiornati, ${errorCount} errori` });
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore salvataggio:', error);
      setMessage({ type: 'error', text: 'Errore durante il salvataggio' });
    } finally {
      setSaving(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'overdue': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'due_soon': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'on_time': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  }

  function getUrgencyIcon(urgency: string) {
    switch (urgency) {
      case 'critical': return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case 'medium': return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'low': return <CheckCircle className="w-5 h-5 text-green-400" />;
      default: return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'overdue': return 'In ritardo';
      case 'due_soon': return 'In scadenza';
      case 'on_time': return 'In regola';
      case 'inactive': return 'Inattivo';
      default: return status;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">🔄 Caricamento cadenze fornitori...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-400" />
                Gestione Cadenze Fornitori
              </h1>
              <p className="text-white/60 mt-1">
                Visualizza e modifica le cadenze di riordino per tutti i fornitori
              </p>
            </div>
          </div>

          {/* Save Buttons */}
          <div className="flex gap-3">
            {changes.size > 0 && (
              <>
                <button
                  onClick={discardChanges}
                  disabled={saving}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 border border-white/20 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                  Annulla ({changes.size})
                </button>
                <button
                  onClick={saveAllChanges}
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all flex items-center gap-2 font-semibold shadow-lg disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Salvataggio...' : `Salva Tutto (${changes.size})`}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Cerca fornitore</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome fornitore..."
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Filtra per stato</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="all" className="bg-slate-800 text-white">Tutti</option>
                <option value="urgent" className="bg-slate-800 text-white">Urgenti</option>
                <option value="overdue" className="bg-slate-800 text-white">In ritardo</option>
                <option value="due_soon" className="bg-slate-800 text-white">In scadenza</option>
                <option value="on_time" className="bg-slate-800 text-white">In regola</option>
                <option value="active" className="bg-slate-800 text-white">Attivi</option>
                <option value="inactive" className="bg-slate-800 text-white">Inattivi</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-4 text-sm">
            <span className="text-white/60">
              Totale: <span className="font-bold text-white">{suppliers.length}</span> fornitori
            </span>
            <span className="text-white/60">
              Mostrati: <span className="font-bold text-white">{filteredSuppliers.length}</span>
            </span>
            <span className="text-white/60">
              Urgenti: <span className="font-bold text-red-400">
                {suppliers.filter(s => s.urgency === 'critical' || s.urgency === 'high').length}
              </span>
            </span>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Stato</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Fornitore</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Cadenza (gg)</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Prossimo Ordine</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Lead Time</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Attivo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white/80">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className={`hover:bg-white/5 transition-colors ${
                      hasChanges(supplier.id) ? 'bg-yellow-500/10 border-l-4 border-yellow-400' : ''
                    }`}
                  >
                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getUrgencyIcon(supplier.urgency)}
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(supplier.status)}`}>
                          {getStatusLabel(supplier.status)}
                        </span>
                      </div>
                    </td>

                    {/* Supplier Name */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{supplier.supplier_name}</div>
                      {supplier.days_until_next_order !== null && (
                        <div className={`text-sm ${
                          supplier.days_until_next_order < 0
                            ? 'text-red-400'
                            : supplier.days_until_next_order === 0
                            ? 'text-orange-400'
                            : 'text-white/60'
                        }`}>
                          {supplier.days_until_next_order < 0
                            ? `${Math.abs(supplier.days_until_next_order)} giorni di ritardo`
                            : supplier.days_until_next_order === 0
                            ? 'Ordine oggi!'
                            : `${supplier.days_until_next_order} giorni`}
                        </div>
                      )}
                    </td>

                    {/* Cadence - Always Editable */}
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={getValue(supplier, 'cadence_value')}
                        onChange={(e) => handleChange(supplier.id, 'cadence_value', parseInt(e.target.value) || 1)}
                        className={`w-20 px-2 py-1 bg-white/10 border rounded text-white text-center ${
                          hasChanges(supplier.id) ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-white/20'
                        }`}
                        min="1"
                        max="365"
                      />
                    </td>

                    {/* Next Order Date */}
                    <td className="px-6 py-4">
                      {supplier.next_order_date ? (
                        <span className="text-white/80">
                          {new Date(supplier.next_order_date).toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      ) : (
                        <span className="text-white/40">N/A</span>
                      )}
                    </td>

                    {/* Lead Time */}
                    <td className="px-6 py-4">
                      <span className="text-white/80">{supplier.average_lead_time_days} giorni</span>
                    </td>

                    {/* Active Status - Always Editable */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={getValue(supplier, 'is_active')}
                          onChange={(e) => handleChange(supplier.id, 'is_active', e.target.checked)}
                          className={`w-5 h-5 rounded cursor-pointer transition-all ${
                            hasChanges(supplier.id) ? 'ring-2 ring-yellow-400/50' : ''
                          }`}
                        />
                        {getValue(supplier, 'is_active') ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </td>

                    {/* Notes - Always Editable */}
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={getValue(supplier, 'notes') || ''}
                        onChange={(e) => handleChange(supplier.id, 'notes', e.target.value)}
                        placeholder="Note..."
                        className={`w-full px-2 py-1 bg-white/10 border rounded text-white text-sm ${
                          hasChanges(supplier.id) ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-white/20'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSuppliers.length === 0 && (
            <div className="text-center py-12 text-white/60">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun fornitore trovato con i filtri selezionati</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
