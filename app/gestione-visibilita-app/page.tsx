'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Settings, Eye, EyeOff, Users, UserMinus, Database } from 'lucide-react';
import Link from 'next/link';
import ExclusionModal from '@/components/visibility/ExclusionModal';

type DevelopmentStatus = 'in_sviluppo' | 'pronta';

interface GroupSettings {
  enabled: boolean;
  excluded: number[];
  excludedEmails?: string[]; // NEW: email degli utenti esclusi
}

interface AppVisibility {
  id: string;
  name: string;
  icon: string;
  category: string;
  developmentStatus: DevelopmentStatus;
  visible: boolean;
  groups: {
    dipendenti: GroupSettings;
    clienti: GroupSettings;
  };
}

interface User {
  id: number;
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  city?: string;
  country?: string;
}

export default function GestioneVisibilitaAppPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppVisibility[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'dipendenti' | 'clienti'>('dipendenti');
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    checkAuthAndLoadApps();
  }, []);

  const checkAuthAndLoadApps = async () => {
    try {
      // Verifica autenticazione
      const authResponse = await fetch('/api/auth/me');
      const authData = await authResponse.json();

      // Solo paul@lapa.ch può accedere
      if (!authData.data?.user || authData.data.user.email !== 'paul@lapa.ch') {
        router.push('/');
        return;
      }

      setIsAuthorized(true);

      // Carica lista app e visibilità
      const response = await fetch('/api/apps/visibility');
      const data = await response.json();

      if (data.success) {
        // Assicurati che ogni app abbia la struttura groups
        const normalizedApps = data.apps.map((app: any) => ({
          ...app,
          developmentStatus: app.developmentStatus || 'pronta',
          visible: app.visible !== undefined ? app.visible : true,
          groups: app.groups || {
            dipendenti: { enabled: true, excluded: [] },
            clienti: { enabled: true, excluded: [] }
          }
        }));
        setApps(normalizedApps);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (employees.length > 0) return; // Already loaded

    setLoadingUsers(true);
    try {
      const response = await fetch('/api/odoo/employees');
      const data = await response.json();

      if (data.success) {
        setEmployees(data.data);
      }
    } catch (error) {
      console.error('Errore caricamento dipendenti:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadCustomers = async () => {
    if (customers.length > 0) return; // Already loaded

    setLoadingUsers(true);
    try {
      const response = await fetch('/api/odoo/customers');
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error('Errore caricamento clienti:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleDevelopmentStatus = (appId: string) => {
    setApps(apps.map(app =>
      app.id === appId
        ? {
            ...app,
            developmentStatus: app.developmentStatus === 'in_sviluppo' ? 'pronta' : 'in_sviluppo'
          }
        : app
    ));
  };

  const toggleVisibility = (appId: string) => {
    setApps(apps.map(app =>
      app.id === appId ? { ...app, visible: !app.visible } : app
    ));
  };

  const toggleGroup = (appId: string, group: 'dipendenti' | 'clienti') => {
    setApps(apps.map(app =>
      app.id === appId
        ? {
            ...app,
            groups: {
              ...app.groups,
              [group]: {
                ...app.groups[group],
                enabled: !app.groups[group].enabled
              }
            }
          }
        : app
    ));
  };

  const openExclusionModal = async (appId: string, type: 'dipendenti' | 'clienti') => {
    setCurrentAppId(appId);
    setModalType(type);

    // Load users if not already loaded
    if (type === 'dipendenti') {
      await loadEmployees();
    } else {
      await loadCustomers();
    }

    setModalOpen(true);
  };

  const handleSaveExclusions = (excludedIds: number[], excludedEmails: string[]) => {
    if (!currentAppId) return;

    console.log(`💾 handleSaveExclusions for app ${currentAppId}:`, {
      type: modalType,
      excludedIds,
      excludedEmails
    });

    setApps(apps.map(app =>
      app.id === currentAppId
        ? {
            ...app,
            groups: {
              ...app.groups,
              [modalType]: {
                ...app.groups[modalType],
                excluded: excludedIds,
                excludedEmails // NEW: Save emails too
              }
            }
          }
        : app
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // 🔍 DEBUG: Log completo dello stato prima di inviare
    console.log('🚀 handleSave - Stato completo apps:', JSON.stringify(apps, null, 2));
    const stellaApp = apps.find(a => a.id === 's17');
    if (stellaApp) {
      console.log('🌟 Stella AI Assistant (s17) groups:', stellaApp.groups);
      console.log('  dipendenti.excluded:', stellaApp.groups.dipendenti.excluded);
      console.log('  dipendenti.excludedEmails:', stellaApp.groups.dipendenti.excludedEmails);
    }

    try {
      const response = await fetch('/api/apps/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps })
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Impostazioni salvate con successo!' });
      } else {
        setMessage({ type: 'error', text: 'Errore nel salvataggio' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncDatabase = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/maestro/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthsBack: 4,
          dryRun: false
        })
      });

      const data = await response.json();

      if (data.success) {
        const stats = data.after?.status || {};
        const customersSynced = data.sync?.customers?.synced || 0;
        const customersErrors = data.sync?.customers?.errors || 0;
        const suppliersSynced = data.sync?.suppliers?.synced || 0;
        const suppliersErrors = data.sync?.suppliers?.errors || 0;
        const withCadence = data.sync?.suppliers?.withCadence || 0;
        const withoutCadence = data.sync?.suppliers?.withoutCadence || 0;

        setMessage({
          type: 'success',
          text: `Database sincronizzato! Clienti: ${customersSynced} sincronizzati (${customersErrors} errori). Fornitori: ${suppliersSynced} sincronizzati (${suppliersErrors} errori) - ${withCadence} con cadenza attiva, ${withoutCadence} inattivi. Totale DB: ${stats.totalCustomers || 0} clienti, ${stats.totalSuppliers || 0} fornitori.`
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Errore nella sincronizzazione' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione durante la sincronizzazione' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const groupedApps = apps.reduce((acc, app) => {
    if (!acc[app.category]) {
      acc[app.category] = [];
    }
    acc[app.category].push(app);
    return acc;
  }, {} as Record<string, AppVisibility[]>);

  const currentApp = apps.find(app => app.id === currentAppId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/profile"
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Indietro</span>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">Gestione Visibilità App</h1>
                <p className="text-slate-300 mt-1">Sistema di visibilità a 3 livelli</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncDatabase}
                disabled={syncing}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50"
              >
                <Database className="h-5 w-5" />
                <span>{syncing ? 'Sincronizzazione...' : 'Sincronizza Database'}</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-blue-600 transition-all disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                <span>{saving ? 'Salvataggio...' : 'Salva Modifiche'}</span>
              </button>
            </div>
          </div>

          {/* Messaggio di conferma */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                : 'bg-red-500/20 border border-red-500/50 text-red-300'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* Contenuto */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {Object.entries(groupedApps).map(([category, categoryApps]) => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <span className="bg-gradient-to-r from-emerald-500 to-blue-500 text-transparent bg-clip-text">
                {category}
              </span>
              <span className="ml-3 text-sm text-slate-400">({categoryApps.length} app)</span>
            </h2>

            <div className="space-y-4">
              {categoryApps.map((app) => (
                <div
                  key={app.id}
                  className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 p-6"
                >
                  {/* App Header */}
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{app.icon}</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white">{app.name}</h3>

                      {/* Level 1: Development Status */}
                      <div className="mt-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-300 mb-2">
                              1. Stato Sviluppo
                            </div>
                            <button
                              onClick={() => toggleDevelopmentStatus(app.id)}
                              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                app.developmentStatus === 'in_sviluppo'
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
                              }`}
                            >
                              {app.developmentStatus === 'in_sviluppo' ? '🚧 In Sviluppo' : '✅ Pronta'}
                            </button>
                          </div>

                          {/* Show visibility toggle only for "In Sviluppo" */}
                          {app.developmentStatus === 'in_sviluppo' && (
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-300">Visibile:</span>
                              <button
                                onClick={() => toggleVisibility(app.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                  app.visible
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {app.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                {app.visible ? 'Sì' : 'No'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Level 2 & 3: Groups and Exclusions (only if "Pronta" or visible) */}
                      {(app.developmentStatus === 'pronta' || app.visible) && (
                        <div className="mt-4 space-y-3">
                          <div className="text-sm font-semibold text-slate-300">
                            2. Gruppi Utenti
                          </div>

                          {/* Dipendenti Group */}
                          <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={app.groups.dipendenti.enabled}
                                  onChange={() => toggleGroup(app.id, 'dipendenti')}
                                  className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                />
                                <span className="text-white font-medium">
                                  🏢 Dipendenti Interni
                                </span>
                                {app.groups.dipendenti.enabled && (
                                  <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                                    Abilitato
                                  </span>
                                )}
                              </div>

                              {app.groups.dipendenti.enabled && (
                                <button
                                  onClick={() => openExclusionModal(app.id, 'dipendenti')}
                                  className="flex items-center gap-2 px-4 py-2 bg-slate-600/50 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                  <UserMinus className="h-4 w-4" />
                                  <span>Escludi specifici</span>
                                  {app.groups.dipendenti.excluded.length > 0 && (
                                    <span className="ml-1 px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
                                      {app.groups.dipendenti.excluded.length}
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Clienti Group */}
                          <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={app.groups.clienti.enabled}
                                  onChange={() => toggleGroup(app.id, 'clienti')}
                                  className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                />
                                <span className="text-white font-medium">
                                  👤 Clienti Portal
                                </span>
                                {app.groups.clienti.enabled && (
                                  <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded">
                                    Abilitato
                                  </span>
                                )}
                              </div>

                              {app.groups.clienti.enabled && (
                                <button
                                  onClick={() => openExclusionModal(app.id, 'clienti')}
                                  className="flex items-center gap-2 px-4 py-2 bg-slate-600/50 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                  <UserMinus className="h-4 w-4" />
                                  <span>Escludi specifici</span>
                                  {app.groups.clienti.excluded.length > 0 && (
                                    <span className="ml-1 px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
                                      {app.groups.clienti.excluded.length}
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Info box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">ℹ️ Come funziona il sistema a 3 livelli</h3>
          <div className="space-y-3 text-slate-300">
            <div>
              <strong className="text-white">Livello 1 - Stato Sviluppo:</strong>
              <ul className="mt-1 ml-4 space-y-1 text-sm">
                <li>• <strong>In Sviluppo:</strong> L'app è in fase di sviluppo. Puoi scegliere se renderla visibile o no.</li>
                <li>• <strong>Pronta:</strong> L'app è pronta per la produzione. Si applica il controllo gruppi.</li>
              </ul>
            </div>
            <div>
              <strong className="text-white">Livello 2 - Gruppi Utenti:</strong>
              <ul className="mt-1 ml-4 space-y-1 text-sm">
                <li>• <strong>Dipendenti Interni:</strong> Utenti dal modello hr.employee di Odoo</li>
                <li>• <strong>Clienti Portal:</strong> Utenti dal modello res.partner (con flag cliente) di Odoo</li>
              </ul>
            </div>
            <div>
              <strong className="text-white">Livello 3 - Esclusioni Specifiche:</strong>
              <ul className="mt-1 ml-4 space-y-1 text-sm">
                <li>• Per ogni gruppo abilitato, puoi escludere specifici utenti</li>
                <li>• Usa il pulsante "Escludi specifici" per aprire la lista e selezionare chi escludere</li>
              </ul>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Solo tu (paul@lapa.ch) puoi accedere a questa pagina di gestione.
            </p>
          </div>
        </div>
      </div>

      {/* Exclusion Modal */}
      {currentApp && (
        <ExclusionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`${currentApp.name} - ${modalType === 'dipendenti' ? 'Dipendenti' : 'Clienti'}`}
          users={modalType === 'dipendenti' ? employees : customers}
          excludedIds={currentApp.groups[modalType].excluded}
          excludedEmails={currentApp.groups[modalType].excludedEmails || []}
          onSave={handleSaveExclusions}
          loading={loadingUsers}
          type={modalType}
        />
      )}
    </div>
  );
}
