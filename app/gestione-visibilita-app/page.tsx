'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Save } from 'lucide-react';
import Link from 'next/link';

type VisibilityGroup = 'all' | 'internal' | 'portal' | 'none';

interface AppVisibility {
  id: string;
  name: string;
  icon: string;
  category: string;
  visible: boolean;
  visibilityGroup: VisibilityGroup;
}

export default function GestioneVisibilitaAppPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppVisibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
        setApps(data.apps);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = (appId: string) => {
    setApps(apps.map(app =>
      app.id === appId ? { ...app, visible: !app.visible } : app
    ));
  };

  const changeVisibilityGroup = (appId: string, group: VisibilityGroup) => {
    setApps(apps.map(app =>
      app.id === appId ? { ...app, visibilityGroup: group, visible: group !== 'none' } : app
    ));
  };

  const getVisibilityGroupLabel = (group: VisibilityGroup) => {
    const labels = {
      all: 'Tutti gli utenti',
      internal: 'Solo utenti interni',
      portal: 'Solo utenti portale',
      none: 'Nessuno'
    };
    return labels[group];
  };

  const getVisibilityGroupColor = (group: VisibilityGroup) => {
    const colors = {
      all: 'bg-green-500/20 text-green-400 border-green-500/30',
      internal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      portal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      none: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[group];
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

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
                <p className="text-slate-300 mt-1">Controlla quali app sono visibili nel dashboard</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              <span>{saving ? 'Salvataggio...' : 'Salva Modifiche'}</span>
            </button>
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

            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/30">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">App</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Nome</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Visibilità</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Gruppo</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Azione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {categoryApps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-3xl">{app.icon}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white font-medium">{app.name}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            app.visible
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {app.visible ? 'Visibile' : 'Nascosta'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select
                            value={app.visibilityGroup}
                            onChange={(e) => changeVisibilityGroup(app.id, e.target.value as VisibilityGroup)}
                            className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="all">👥 Tutti</option>
                            <option value="internal">🏢 Solo Interni</option>
                            <option value="portal">👤 Solo Portale</option>
                            <option value="none">🚫 Nessuno</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleVisibility(app.id)}
                            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                              app.visible
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            }`}
                          >
                            {app.visible ? (
                              <>
                                <EyeOff className="h-4 w-4" />
                                <span>Nascondi</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4" />
                                <span>Mostra</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

        {/* Info box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">ℹ️ Come funziona la visibilità per gruppo</h3>
          <div className="space-y-2 text-slate-300">
            <p><strong>👥 Tutti:</strong> L'app è visibile a tutti gli utenti (interni e portale)</p>
            <p><strong>🏢 Solo Interni:</strong> L'app è visibile solo a dipendenti e amministratori</p>
            <p><strong>👤 Solo Portale:</strong> L'app è visibile solo a utenti del portale (clienti)</p>
            <p><strong>🚫 Nessuno:</strong> L'app è nascosta a tutti</p>
            <p className="mt-4 text-sm text-slate-400">Solo tu (paul@lapa.ch) puoi accedere a questa pagina di gestione.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
