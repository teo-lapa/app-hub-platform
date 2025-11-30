'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Save,
  Check,
  X,
  ExternalLink,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface Platform {
  platform: string;
  label: string;
  isConnected: boolean;
  credentials?: {
    platformAccountId?: string;
    platformAccountName?: string;
    googlePlaceId?: string;
    lastSyncAt?: string;
    syncError?: string;
  };
}

interface Business {
  id: number;
  name: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
  responseMode: 'auto' | 'manual';
  responseTone: 'friendly' | 'elegant' | 'professional' | 'casual';
  responseLanguages: string[];
}

export default function BusinessSettingsPage({
  params,
}: {
  params: { businessId: string };
}) {
  const businessId = parseInt(params.businessId);

  const [business, setBusiness] = useState<Business | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Form stato
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: '',
    city: '',
    responseMode: 'manual' as 'auto' | 'manual',
    responseTone: 'friendly' as 'friendly' | 'elegant' | 'professional' | 'casual',
    responseLanguages: ['IT']
  });

  // API Keys form
  const [apiKeys, setApiKeys] = useState<Record<string, Record<string, string>>>({
    google: { googlePlaceId: '', accessToken: '' },
    instagram: { platformPageId: '', accessToken: '' },
    tiktok: { accessToken: '' },
    facebook: { platformPageId: '', accessToken: '' }
  });

  useEffect(() => {
    loadData();
  }, [businessId]);

  async function loadData() {
    try {
      // Load business
      const bizRes = await fetch(`/api/review-manager/businesses/${businessId}`);
      const bizData = await bizRes.json();
      if (bizData.success) {
        setBusiness(bizData.data);
        setFormData({
          name: bizData.data.name || '',
          ownerName: bizData.data.ownerName || '',
          ownerEmail: bizData.data.ownerEmail || '',
          ownerPhone: bizData.data.ownerPhone || '',
          address: bizData.data.address || '',
          city: bizData.data.city || '',
          responseMode: bizData.data.responseMode || 'manual',
          responseTone: bizData.data.responseTone || 'friendly',
          responseLanguages: bizData.data.responseLanguages || ['IT']
        });
      }

      // Load platforms
      const platRes = await fetch(`/api/review-manager/platforms?businessId=${businessId}`);
      const platData = await platRes.json();
      if (platData.success) {
        setPlatforms(platData.data);

        // Pre-fill API keys if connected
        const keys: Record<string, Record<string, string>> = { ...apiKeys };
        platData.data.forEach((p: Platform) => {
          if (p.credentials) {
            keys[p.platform] = {
              ...keys[p.platform],
              googlePlaceId: p.credentials.googlePlaceId || '',
              platformPageId: p.credentials.platformAccountId || '',
              platformAccountName: p.credentials.platformAccountName || ''
            };
          }
        });
        setApiKeys(keys);
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/review-manager/businesses/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        alert('Impostazioni salvate!');
        setBusiness(data.data);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Errore:', error);
      alert('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectPlatform(platform: string) {
    setConnectingPlatform(platform);

    try {
      const keys = apiKeys[platform];

      const res = await fetch('/api/review-manager/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          platform,
          googlePlaceId: keys.googlePlaceId,
          platformAccountId: keys.platformPageId,
          platformAccountName: keys.platformAccountName,
          accessToken: keys.accessToken
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`${platform} connesso!`);
        loadData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Errore:', error);
      alert('Errore nella connessione');
    } finally {
      setConnectingPlatform(null);
    }
  }

  async function handleDisconnectPlatform(platform: string) {
    if (!confirm(`Vuoi disconnettere ${platform}?`)) return;

    try {
      const res = await fetch(
        `/api/review-manager/platforms?businessId=${businessId}&platform=${platform}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (error) {
      console.error('Errore:', error);
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/review-manager/${businessId}`}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Impostazioni - {business?.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Impostazioni Generali */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Informazioni Cliente</h2>
          </div>
          <form onSubmit={handleSaveSettings} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome Attivita</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Proprietario</label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefono</label>
                <input
                  type="text"
                  value={formData.ownerPhone}
                  onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Indirizzo</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Citta</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <hr />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Modalita Risposta</label>
                <select
                  value={formData.responseMode}
                  onChange={(e) => setFormData({ ...formData, responseMode: e.target.value as 'auto' | 'manual' })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="manual">Manuale (approva prima)</option>
                  <option value="auto">Automatica (pubblica subito)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.responseMode === 'auto'
                    ? 'Le risposte AI verranno pubblicate automaticamente'
                    : 'Dovrai approvare ogni risposta prima della pubblicazione'
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tono Risposte</label>
                <select
                  value={formData.responseTone}
                  onChange={(e) => setFormData({ ...formData, responseTone: e.target.value as 'friendly' | 'elegant' | 'professional' | 'casual' })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="friendly">Amichevole</option>
                  <option value="professional">Professionale</option>
                  <option value="elegant">Elegante</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salva Impostazioni'}
            </button>
          </form>
        </div>

        {/* Piattaforme */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Piattaforme Collegate</h2>
            <p className="text-sm text-gray-500">
              Configura le API per ogni piattaforma da cui vuoi importare recensioni
            </p>
          </div>

          <div className="divide-y">
            {/* Google */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔵</span>
                  <div>
                    <p className="font-medium">Google My Business</p>
                    <p className="text-sm text-gray-500">Recensioni Google Maps</p>
                  </div>
                </div>
                {platforms.find(p => p.platform === 'google')?.isConnected ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Connesso
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Non connesso
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Google Place ID
                    <a
                      href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 inline-flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      Come trovarlo
                    </a>
                  </label>
                  <input
                    type="text"
                    value={apiKeys.google.googlePlaceId}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      google: { ...apiKeys.google, googlePlaceId: e.target.value }
                    })}
                    placeholder="ChIJ..."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Access Token (OAuth)</label>
                  <input
                    type="password"
                    value={apiKeys.google.accessToken}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      google: { ...apiKeys.google, accessToken: e.target.value }
                    })}
                    placeholder="ya29...."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnectPlatform('google')}
                    disabled={connectingPlatform === 'google'}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {connectingPlatform === 'google' ? 'Connettendo...' : 'Connetti'}
                  </button>
                  {platforms.find(p => p.platform === 'google')?.isConnected && (
                    <button
                      onClick={() => handleDisconnectPlatform('google')}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      Disconnetti
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Instagram */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📸</span>
                  <div>
                    <p className="font-medium">Instagram</p>
                    <p className="text-sm text-gray-500">Commenti sui post</p>
                  </div>
                </div>
                {platforms.find(p => p.platform === 'instagram')?.isConnected ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Connesso
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Non connesso
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Instagram Business Account ID</label>
                  <input
                    type="text"
                    value={apiKeys.instagram.platformPageId}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      instagram: { ...apiKeys.instagram, platformPageId: e.target.value }
                    })}
                    placeholder="17841..."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Access Token (Meta Graph API)</label>
                  <input
                    type="password"
                    value={apiKeys.instagram.accessToken}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      instagram: { ...apiKeys.instagram, accessToken: e.target.value }
                    })}
                    placeholder="EAAx..."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnectPlatform('instagram')}
                    disabled={connectingPlatform === 'instagram'}
                    className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {connectingPlatform === 'instagram' ? 'Connettendo...' : 'Connetti'}
                  </button>
                  {platforms.find(p => p.platform === 'instagram')?.isConnected && (
                    <button
                      onClick={() => handleDisconnectPlatform('instagram')}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      Disconnetti
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* TikTok */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎵</span>
                  <div>
                    <p className="font-medium">TikTok</p>
                    <p className="text-sm text-gray-500">Commenti sui video</p>
                  </div>
                </div>
                {platforms.find(p => p.platform === 'tiktok')?.isConnected ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Connesso
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Non connesso
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Access Token (TikTok for Business)</label>
                  <input
                    type="password"
                    value={apiKeys.tiktok.accessToken}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      tiktok: { ...apiKeys.tiktok, accessToken: e.target.value }
                    })}
                    placeholder="act...."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnectPlatform('tiktok')}
                    disabled={connectingPlatform === 'tiktok'}
                    className="flex items-center gap-1 px-3 py-1.5 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {connectingPlatform === 'tiktok' ? 'Connettendo...' : 'Connetti'}
                  </button>
                  {platforms.find(p => p.platform === 'tiktok')?.isConnected && (
                    <button
                      onClick={() => handleDisconnectPlatform('tiktok')}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      Disconnetti
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Facebook */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="font-medium">Facebook</p>
                    <p className="text-sm text-gray-500">
                      Recensioni pagina
                      <span className="text-orange-600 ml-1">(solo lettura)</span>
                    </p>
                  </div>
                </div>
                {platforms.find(p => p.platform === 'facebook')?.isConnected ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Connesso
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Non connesso
                  </span>
                )}
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 text-sm">
                <p className="text-orange-800">
                  <strong>Nota:</strong> Facebook NON permette di rispondere alle recensioni via API.
                  Puoi solo leggere le recensioni e copiare la risposta suggerita manualmente.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Facebook Page ID</label>
                  <input
                    type="text"
                    value={apiKeys.facebook.platformPageId}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      facebook: { ...apiKeys.facebook, platformPageId: e.target.value }
                    })}
                    placeholder="123456789..."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Page Access Token</label>
                  <input
                    type="password"
                    value={apiKeys.facebook.accessToken}
                    onChange={(e) => setApiKeys({
                      ...apiKeys,
                      facebook: { ...apiKeys.facebook, accessToken: e.target.value }
                    })}
                    placeholder="EAAx..."
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnectPlatform('facebook')}
                    disabled={connectingPlatform === 'facebook'}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {connectingPlatform === 'facebook' ? 'Connettendo...' : 'Connetti'}
                  </button>
                  {platforms.find(p => p.platform === 'facebook')?.isConnected && (
                    <button
                      onClick={() => handleDisconnectPlatform('facebook')}
                      className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      Disconnetti
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
