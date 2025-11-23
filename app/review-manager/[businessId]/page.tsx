'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  MessageSquare,
  RefreshCw,
  Check,
  X,
  Send,
  Sparkles,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

// Platform icons
const PlatformIcon = ({ platform }: { platform: string }) => {
  const icons: Record<string, string> = {
    google: '🔵',
    instagram: '📸',
    tiktok: '🎵',
    facebook: '👤',
    trustpilot: '⭐'
  };
  return <span>{icons[platform] || '🌐'}</span>;
};

interface Review {
  id: number;
  platform: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  rating?: number;
  content: string;
  language: string;
  sentimentLabel?: string;
  responseStatus: string;
  aiSuggestedResponse?: string;
  finalResponse?: string;
  reviewDate?: string;
}

interface Business {
  id: number;
  name: string;
  responseMode: string;
  responseTone: string;
  metrics?: {
    totalReviews: number;
    averageRating: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
}

export default function BusinessReviewsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const resolvedParams = use(params);
  const businessId = parseInt(resolvedParams.businessId);

  const [business, setBusiness] = useState<Business | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [generatingAI, setGeneratingAI] = useState<number | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [editingResponse, setEditingResponse] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    loadData();
  }, [businessId]);

  async function loadData() {
    try {
      // Load business details
      const bizRes = await fetch(`/api/review-manager/businesses/${businessId}`);
      const bizData = await bizRes.json();
      if (bizData.success) {
        setBusiness(bizData.data);
      }

      // Load reviews
      const reviewsRes = await fetch(`/api/review-manager/reviews?businessId=${businessId}&pageSize=100`);
      const reviewsData = await reviewsRes.json();
      if (reviewsData.success) {
        setReviews(reviewsData.data);
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/review-manager/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sincronizzazione completata!\n${data.data.totalNew} nuove recensioni`);
        loadData();
      }
    } catch (error) {
      console.error('Errore sync:', error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerateAI(reviewId: number) {
    setGeneratingAI(reviewId);
    try {
      const res = await fetch(`/api/review-manager/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_ai' })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, ...data.data, aiSuggestedResponse: data.aiResponse?.response } : r
        ));
      }
    } catch (error) {
      console.error('Errore AI:', error);
    } finally {
      setGeneratingAI(null);
    }
  }

  async function handleApprove(reviewId: number, customResponse?: string) {
    try {
      const res = await fetch(`/api/review-manager/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          finalResponse: customResponse
        })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, responseStatus: 'approved', finalResponse: customResponse || r.aiSuggestedResponse } : r
        ));
        setEditingResponse(null);
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  }

  async function handlePublish(reviewId: number) {
    setPublishing(reviewId);
    try {
      const res = await fetch('/api/review-manager/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', reviewId })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, responseStatus: 'published' } : r
        ));
        alert('Risposta pubblicata!');
      } else {
        alert(data.error || 'Errore pubblicazione');
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setPublishing(null);
    }
  }

  async function handleReject(reviewId: number) {
    try {
      const res = await fetch(`/api/review-manager/reviews/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, responseStatus: 'rejected' } : r
        ));
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  }

  // Filtra recensioni
  const filteredReviews = reviews.filter(r => {
    if (filter !== 'all' && r.responseStatus !== filter) return false;
    if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
    return true;
  });

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
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/review-manager"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">{business?.name}</h1>
                <p className="text-sm text-gray-500">
                  {business?.metrics?.totalReviews || 0} recensioni totali
                </p>
              </div>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizzando...' : 'Sincronizza'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border text-center">
            <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {business?.metrics?.averageRating?.toFixed(1) || '-'}
            </p>
            <p className="text-sm text-gray-500">Rating Medio</p>
          </div>
          <div className="bg-white rounded-xl p-4 border text-center">
            <div className="w-6 h-6 bg-green-100 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-green-600 text-xs">+</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {business?.metrics?.positiveCount || 0}
            </p>
            <p className="text-sm text-gray-500">Positive</p>
          </div>
          <div className="bg-white rounded-xl p-4 border text-center">
            <div className="w-6 h-6 bg-gray-100 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-gray-600 text-xs">=</span>
            </div>
            <p className="text-2xl font-bold text-gray-600">
              {business?.metrics?.neutralCount || 0}
            </p>
            <p className="text-sm text-gray-500">Neutre</p>
          </div>
          <div className="bg-white rounded-xl p-4 border text-center">
            <div className="w-6 h-6 bg-red-100 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="text-red-600 text-xs">-</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {business?.metrics?.negativeCount || 0}
            </p>
            <p className="text-sm text-gray-500">Negative</p>
          </div>
          <div className="bg-white rounded-xl p-4 border text-center">
            <Clock className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">
              {reviews.filter(r => r.responseStatus === 'pending').length}
            </p>
            <p className="text-sm text-gray-500">Da Rispondere</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Filtra:</span>
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">Tutti gli stati</option>
              <option value="pending">Da rispondere</option>
              <option value="ai_generated">AI generata</option>
              <option value="approved">Approvate</option>
              <option value="published">Pubblicate</option>
              <option value="rejected">Ignorate</option>
            </select>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">Tutte le piattaforme</option>
              <option value="google">Google</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nessuna recensione trovata</p>
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Review Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={review.platform} />
                      <div>
                        <p className="font-medium">{review.reviewerName}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {review.rating && (
                            <span className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < review.rating!
                                      ? 'text-yellow-500 fill-yellow-500'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </span>
                          )}
                          {review.reviewDate && (
                            <span>
                              {new Date(review.reviewDate).toLocaleDateString('it-IT')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        review.responseStatus === 'pending' ? 'bg-orange-100 text-orange-700' :
                        review.responseStatus === 'ai_generated' ? 'bg-purple-100 text-purple-700' :
                        review.responseStatus === 'approved' ? 'bg-blue-100 text-blue-700' :
                        review.responseStatus === 'published' ? 'bg-green-100 text-green-700' :
                        review.responseStatus === 'rejected' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {review.responseStatus === 'pending' && <Clock className="w-3 h-3 inline mr-1" />}
                        {review.responseStatus === 'ai_generated' && <Sparkles className="w-3 h-3 inline mr-1" />}
                        {review.responseStatus === 'approved' && <Check className="w-3 h-3 inline mr-1" />}
                        {review.responseStatus === 'published' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {review.responseStatus === 'rejected' && <XCircle className="w-3 h-3 inline mr-1" />}
                        {review.responseStatus}
                      </span>

                      {/* Sentiment */}
                      {review.sentimentLabel && (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          review.sentimentLabel === 'positive' ? 'bg-green-100 text-green-700' :
                          review.sentimentLabel === 'negative' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {review.sentimentLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Review Content */}
                <div className="p-4">
                  <p className="text-gray-700 mb-4">{review.content || '(nessun testo)'}</p>

                  {/* AI Response */}
                  {review.aiSuggestedResponse && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 text-purple-700 text-sm font-medium mb-2">
                        <Sparkles className="w-4 h-4" />
                        Risposta AI suggerita
                      </div>
                      {editingResponse === review.id ? (
                        <textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          className="w-full border rounded-lg p-2 text-sm"
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-gray-700">
                          {review.finalResponse || review.aiSuggestedResponse}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {review.responseStatus === 'pending' && (
                      <button
                        onClick={() => handleGenerateAI(review.id)}
                        disabled={generatingAI === review.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Sparkles className={`w-4 h-4 ${generatingAI === review.id ? 'animate-pulse' : ''}`} />
                        {generatingAI === review.id ? 'Generando...' : 'Genera AI'}
                      </button>
                    )}

                    {(review.responseStatus === 'ai_generated' || review.responseStatus === 'pending') && review.aiSuggestedResponse && (
                      <>
                        {editingResponse === review.id ? (
                          <>
                            <button
                              onClick={() => handleApprove(review.id, editedText)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                            >
                              <Check className="w-4 h-4" />
                              Salva
                            </button>
                            <button
                              onClick={() => setEditingResponse(null)}
                              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
                            >
                              Annulla
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(review.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                            >
                              <Check className="w-4 h-4" />
                              Approva
                            </button>
                            <button
                              onClick={() => {
                                setEditingResponse(review.id);
                                setEditedText(review.aiSuggestedResponse || '');
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
                            >
                              Modifica
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleReject(review.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          <X className="w-4 h-4" />
                          Ignora
                        </button>
                      </>
                    )}

                    {review.responseStatus === 'approved' && (
                      <button
                        onClick={() => handlePublish(review.id)}
                        disabled={publishing === review.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send className={`w-4 h-4 ${publishing === review.id ? 'animate-pulse' : ''}`} />
                        {publishing === review.id ? 'Pubblicando...' : 'Pubblica'}
                      </button>
                    )}

                    {review.responseStatus === 'published' && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Risposta pubblicata
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
