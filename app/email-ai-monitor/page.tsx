'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Email {
  id: string;
  sender_email: string;
  sender_name: string | null;
  subject: string;
  snippet: string;
  ai_summary: string | null;
  urgency_level: 'urgent' | 'important' | 'normal' | 'low';
  is_spam: boolean;
  is_client: boolean;
  is_supplier: boolean;
  email_category: string;
  ai_keywords: string[];
  received_date: string;
  is_read: boolean;
}

export default function EmailAIMonitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingNew, setFetchingNew] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [connectionId, setConnectionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check for success/error messages from OAuth callback
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'gmail_connected') {
      alert('Gmail connesso con successo!');
      // Rimuovi query params dall'URL senza ricaricare la pagina
      window.history.replaceState({}, '', '/email-ai-monitor');
      // Check connection con delay per dare tempo al cookie di essere settato
      setTimeout(() => checkConnection(), 100);
      return;
    }

    if (error) {
      alert(`Errore: ${error}`);
    }

    // Get connection_id from cookie or fetch from API
    checkConnection();
  }, [searchParams]); // ✅ Aggiungi searchParams come dependency

  useEffect(() => {
    if (connectionId) {
      fetchEmails();
    }
  }, [filter, connectionId]);

  const checkConnection = async () => {
    try {
      // Check cookie con regex più robusto
      const match = document.cookie.match(/(?:^|;\s*)gmail_connection_id=([^;]*)/);

      if (match && match[1]) {
        const id = decodeURIComponent(match[1]);
        console.log('[Email-AI] ✅ Found gmail_connection_id:', id);
        setConnectionId(id);
        setIsConnected(true);
      } else {
        console.log('[Email-AI] ❌ No gmail_connection_id cookie found');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('[Email-AI] ❌ Failed to check connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    if (!connectionId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/email-ai/inbox?connectionId=${connectionId}&filter=${filter}&limit=50`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }

      const data = await response.json();
      setEmails(data.emails || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
      alert('Errore nel caricamento email');
    } finally {
      setLoading(false);
    }
  };

  const fetchNewEmails = async () => {
    if (!connectionId) return;

    setFetchingNew(true);
    try {
      const response = await fetch('/api/email-ai/fetch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          maxResults: 10,
          query: 'is:unread'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch new emails');
      }

      const data = await response.json();
      alert(`Processate ${data.processed} nuove email!`);

      // Refresh list
      fetchEmails();
    } catch (error) {
      console.error('Error fetching new emails:', error);
      alert('Errore nel fetch di nuove email');
    } finally {
      setFetchingNew(false);
    }
  };

  const connectGmail = () => {
    window.location.href = '/api/email-ai/auth/gmail';
  };

  const getUrgencyBadge = (urgency: string) => {
    const badges = {
      urgent: 'bg-red-500 text-white',
      important: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      low: 'bg-gray-400 text-white'
    };
    return badges[urgency as keyof typeof badges] || badges.normal;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      sales: '💼',
      support: '🆘',
      invoice: '💸',
      order: '📦',
      delivery: '🚚',
      marketing: '📢',
      newsletter: '📰',
      notification: '🔔',
      other: '📧'
    };
    return icons[category] || icons.other;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">📧 Email AI Monitor</h1>
              <p className="text-gray-400 mt-1">
                Gmail intelligente con classificazione AI automatica
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition flex items-center gap-2"
            >
              ← Torna al Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Connection Status & Actions */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isConnected ? (
              <button
                onClick={connectGmail}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition"
              >
                🔗 Connetti Gmail
              </button>
            ) : (
              <>
                <div className="px-4 py-2 bg-green-500/20 border border-green-500 rounded-lg">
                  ✅ Gmail Connesso
                </div>
                <button
                  onClick={fetchNewEmails}
                  disabled={fetchingNew}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 rounded-lg font-semibold transition"
                >
                  {fetchingNew ? '⏳ Caricamento...' : '🔄 Fetch Nuove Email'}
                </button>
              </>
            )}
          </div>

          {/* Filters */}
          {isConnected && (
            <div className="flex gap-2">
              {['all', 'urgent', 'important', 'unread', 'client', 'supplier'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filter === f
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">⏳</div>
            <div className="text-xl">Caricamento email...</div>
          </div>
        ) : !isConnected ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📧</div>
            <div className="text-2xl mb-4">Connetti Gmail per iniziare</div>
            <p className="text-gray-400">
              Il sistema analizzerà automaticamente le tue email con AI
            </p>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-2xl mb-4">Nessuna email da mostrare</div>
            <p className="text-gray-400">Cambia filtro o fetch nuove email</p>
          </div>
        ) : (
          <div className="space-y-4">
            {emails.map(email => (
              <div
                key={email.id}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:bg-white/15 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {getCategoryIcon(email.email_category)}
                      </span>
                      <div>
                        <div className="font-bold text-lg">
                          {email.sender_name || email.sender_email}
                        </div>
                        <div className="text-sm text-gray-400">
                          {email.sender_email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getUrgencyBadge(
                        email.urgency_level
                      )}`}
                    >
                      {email.urgency_level.toUpperCase()}
                    </span>
                    <div className="text-xs text-gray-400">
                      {new Date(email.received_date).toLocaleString('it-IT')}
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div className="font-semibold text-lg mb-2">{email.subject}</div>

                {/* AI Summary */}
                {email.ai_summary && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                    <div className="text-xs text-blue-300 font-bold mb-1">
                      AI RIASSUNTO
                    </div>
                    <div className="text-sm">{email.ai_summary}</div>
                  </div>
                )}

                {/* Snippet */}
                <div className="text-gray-300 text-sm mb-3">{email.snippet}</div>

                {/* Keywords & Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {email.is_client && (
                    <span className="px-2 py-1 bg-green-500/20 border border-green-500 text-green-300 rounded text-xs font-bold">
                      👤 CLIENTE
                    </span>
                  )}
                  {email.is_supplier && (
                    <span className="px-2 py-1 bg-purple-500/20 border border-purple-500 text-purple-300 rounded text-xs font-bold">
                      🏭 FORNITORE
                    </span>
                  )}
                  {email.ai_keywords?.slice(0, 3).map(keyword => (
                    <span
                      key={keyword}
                      className="px-2 py-1 bg-white/10 rounded text-xs"
                    >
                      #{keyword}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
