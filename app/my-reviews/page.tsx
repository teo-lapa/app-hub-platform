'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  MessageSquare,
  Send,
  RefreshCw,
  Sparkles,
  Check,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Filter,
  TrendingUp,
  AlertCircle,
  Copy,
  Edit3,
  ExternalLink
} from 'lucide-react';

interface Review {
  id: number;
  platform: string;
  reviewerName: string;
  rating: number | null;
  content: string;
  reviewDate: string;
  responseStatus: 'pending' | 'ai_generated' | 'approved' | 'published' | 'ignored';
  sentimentLabel: string | null;
  aiSuggestedResponse: string | null;
  finalResponse: string | null;
}

interface BusinessInfo {
  id: number;
  name: string;
  responseMode: 'auto' | 'manual';
  responseTone: string;
  responseLanguage: string;
}

interface Stats {
  total: number;
  pending: number;
  averageRating: number;
  positiveCount: number;
  negativeCount: number;
}

export default function MyReviewsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [editingResponse, setEditingResponse] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    try {
      // Verifica autenticazione
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();

      if (!authData.success) {
        router.push('/login?redirect=/my-reviews');
        return;
      }

      setUserEmail(authData.data.user?.email || authData.data.email);

      // Carica il business dell'utente
      const businessRes = await fetch(`/api/review-manager/my-business`);
      const businessData = await businessRes.json();

      if (!businessData.success || !businessData.data) {
        setError('Non hai un account Review Manager attivo. Contatta l\'amministratore.');
        setLoading(false);
        return;
      }

      setBusiness(businessData.data);
      await loadReviews(businessData.data.id);
      await loadStats(businessData.data.id);
    } catch (err) {
      console.error('Errore:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews(businessId: number) {
    const res = await fetch(`/api/review-manager/reviews?businessId=${businessId}`);
    const data = await res.json();
    if (data.success) {
      setReviews(data.data);
    }
  }

  async function loadStats(businessId: number) {
    const res = await fetch(`/api/review-manager/stats?businessId=${businessId}`);
    const data = await res.json();
    if (data.success) {
      setStats(data.data);
    }
  }

  async function handleSync() {
    if (!business) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/review-manager/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id })
      });
      const data = await res.json();
      if (data.success) {
        await loadReviews(business.id);
        await loadStats(business.id);
        alert(`Sincronizzazione completata! ${data.data.totalNew} nuove recensioni`);
      }
    } catch (err) {
      console.error('Errore sync:', err);
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerateResponse(reviewId: number) {
    setGenerating(reviewId);
    try {
      const res = await fetch(`/api/review-manager/reviews/${reviewId}/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setReviews(reviews.map(r =>
          r.id === reviewId
            ? { ...r, aiSuggestedResponse: data.data.response, responseStatus: 'ai_generated' }
            : r
        ));
      }
    } catch (err) {
      console.error('Errore generazione:', err);
    } finally {
      setGenerating(null);
    }
  }

  async function handlePublishResponse(reviewId: number, response: string) {
    setPublishing(reviewId);
    try {
      const res = await fetch(`/api/review-manager/reviews/${reviewId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(reviews.map(r =>
          r.id === reviewId
            ? { ...r, finalResponse: response, responseStatus: 'published' }
            : r
        ));
        alert('Risposta pubblicata con successo!');
      } else {
        alert(data.error || 'Errore nella pubblicazione');
      }
    } catch (err) {
      console.error('Errore pubblicazione:', err);
    } finally {
      setPublishing(null);
      setEditingResponse(null);
    }
  }

  async function handleApprove(reviewId: number) {
    try {
      const res = await fetch(`/api/review-manager/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if (res.ok) {
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, responseStatus: 'approved' } : r
        ));
      }
    } catch (err) {
      console.error('Errore approvazione:', err);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copiato negli appunti!');
  }

  const filteredReviews = reviews.filter(r => {
    if (filter === 'pending' && !['pending', 'ai_generated', 'approved'].includes(r.responseStatus)) return false;
    if (filter === 'published' && r.responseStatus !== 'published') return false;
    if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
    return true;
  });

  const platforms = Array.from(new Set(reviews.map(r => r.platform)));

  function getPlatformIcon(platform: string) {
    switch (platform) {
      case 'google': return '🔍';
      case 'instagram': return '📸';
      case 'facebook': return '👤';
      case 'tiktok': return '🎵';
      default: return '📝';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">Da rispondere</span>;
      case 'ai_generated':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Risposta AI pronta</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Approvata</span>;
      case 'published':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Pubblicata</span>;
      case 'ignored':
        return <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">Ignorata</span>;
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Accesso non disponibile</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/" className="text-blue-600 hover:underline">Torna alla home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                Le Mie Recensioni
              </h1>
              <p className="text-sm text-gray-500">{business?.name}</p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizzando...' : 'Sincronizza'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <MessageSquare className="w-4 h-4" />
                Totale
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <div className="flex items-center gap-2 text-orange-500 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Da rispondere
              </div>
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <div className="flex items-center gap-2 text-yellow-500 text-sm mb-1">
                <Star className="w-4 h-4" />
                Rating medio
              </div>
              <p className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <div className="flex items-center gap-2 text-green-500 text-sm mb-1">
                <ThumbsUp className="w-4 h-4" />
                Positive
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.positiveCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border">
              <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
                <ThumbsDown className="w-4 h-4" />
                Negative
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.negativeCount}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Filtri:</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Tutte
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  filter === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Da rispondere
              </button>
              <button
                onClick={() => setFilter('published')}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  filter === 'published' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Pubblicate
              </button>
            </div>
            {platforms.length > 1 && (
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="border rounded-lg px-3 py-1 text-sm"
              >
                <option value="all">Tutte le piattaforme</option>
                {platforms.map(p => (
                  <option key={p} value={p}>{getPlatformIcon(p)} {p}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {reviews.length === 0
                  ? 'Nessuna recensione ancora. Clicca "Sincronizza" per importare le recensioni.'
                  : 'Nessuna recensione corrisponde ai filtri selezionati.'
                }
              </p>
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Review Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getPlatformIcon(review.platform)}</span>
                      <div>
                        <p className="font-semibold">{review.reviewerName}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="capitalize">{review.platform}</span>
                          <span>•</span>
                          <span>{new Date(review.reviewDate).toLocaleDateString('it-IT')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {review.rating !== null && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      {getStatusBadge(review.responseStatus)}
                    </div>
                  </div>
                </div>

                {/* Review Content */}
                <div className="p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{review.content}</p>

                  {review.sentimentLabel && (
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        review.sentimentLabel === 'positive' ? 'bg-green-100 text-green-700' :
                        review.sentimentLabel === 'negative' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        Sentiment: {review.sentimentLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* AI Response Section */}
                {(review.aiSuggestedResponse || review.finalResponse) && (
                  <div className="p-4 bg-blue-50 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {review.finalResponse ? 'Risposta pubblicata' : 'Risposta AI generata'}
                      </span>
                    </div>

                    {editingResponse === review.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          className="w-full border rounded-lg p-3 text-sm min-h-[100px]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePublishResponse(review.id, editedText)}
                            disabled={publishing === review.id}
                            className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            {publishing === review.id ? 'Pubblicando...' : 'Pubblica'}
                          </button>
                          <button
                            onClick={() => setEditingResponse(null)}
                            className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">
                          {review.finalResponse || review.aiSuggestedResponse}
                        </p>
                        {!review.finalResponse && review.aiSuggestedResponse && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handlePublishResponse(review.id, review.aiSuggestedResponse!)}
                              disabled={publishing === review.id}
                              className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              Pubblica così
                            </button>
                            <button
                              onClick={() => {
                                setEditingResponse(review.id);
                                setEditedText(review.aiSuggestedResponse!);
                              }}
                              className="flex items-center gap-1 border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                            >
                              <Edit3 className="w-3 h-3" />
                              Modifica
                            </button>
                            <button
                              onClick={() => copyToClipboard(review.aiSuggestedResponse!)}
                              className="flex items-center gap-1 border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                            >
                              <Copy className="w-3 h-3" />
                              Copia
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {review.responseStatus === 'pending' && (
                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateResponse(review.id)}
                        disabled={generating === review.id}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
                      >
                        <Sparkles className={`w-4 h-4 ${generating === review.id ? 'animate-pulse' : ''}`} />
                        {generating === review.id ? 'Generando...' : 'Genera risposta AI'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
