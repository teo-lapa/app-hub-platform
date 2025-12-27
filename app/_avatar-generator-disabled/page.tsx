'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PhotoIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

// Voci OpenAI TTS
const VOICES = [
  { id: 'onyx', name: 'Onyx', gender: 'Maschile' },
  { id: 'nova', name: 'Nova', gender: 'Femminile' },
  { id: 'alloy', name: 'Alloy', gender: 'Neutro' },
];

export default function AvatarGeneratorPage() {
  // State
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [script, setScript] = useState('');
  const [voice, setVoice] = useState('onyx');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle photo upload
  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('La foto deve essere inferiore a 10MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPhoto(e.target?.result as string);
      reader.readAsDataURL(file);
      setError(null);
    }
  }, []);

  // Generate video
  const handleGenerate = async () => {
    if (!photo || !script.trim()) {
      setError('Carica una foto e scrivi il testo');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setStatus('Avvio generazione...');
    setError(null);
    setVideoUrl(null);

    try {
      // Start generation
      const response = await fetch('/api/avatar-generator/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoBase64: photo,
          script: script.trim(),
          voice
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella generazione');
      }

      const jobId = data.jobId;

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/avatar-generator/generate-video?jobId=${jobId}`);
          const statusData = await statusRes.json();

          if (statusData.success) {
            setProgress(statusData.progress || 0);
            setStatus(statusData.step || 'Elaborazione...');

            if (statusData.status === 'completed' && statusData.videoUrl) {
              clearInterval(pollInterval);
              setVideoUrl(statusData.videoUrl);
              setIsGenerating(false);
              setStatus('Video pronto!');
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              setError(statusData.error || 'Generazione fallita');
              setIsGenerating(false);
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setError('Timeout - riprova più tardi');
          setIsGenerating(false);
        }
      }, 300000);

    } catch (err: any) {
      setError(err.message || 'Errore nella generazione');
      setIsGenerating(false);
    }
  };

  // Download video
  const handleDownload = () => {
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `avatar-video-${Date.now()}.mp4`;
      a.click();
    }
  };

  // Reset
  const handleReset = () => {
    setVideoUrl(null);
    setProgress(0);
    setStatus('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Avatar Video Generator
          </h1>
          <p className="text-gray-600">
            Carica una foto, scrivi il testo e genera un video parlante
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1. Carica la tua foto
            </label>
            <div className="relative">
              {photo ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-indigo-200">
                  <img src={photo} alt="Avatar" className="w-full h-48 object-cover" />
                  <button
                    onClick={() => { setPhoto(null); setPhotoFile(null); }}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:bg-gray-100"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                  <PhotoIcon className="h-12 w-12 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Clicca per caricare una foto</span>
                  <span className="text-xs text-gray-400 mt-1">JPG, PNG (max 10MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Script */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              2. Scrivi il testo da far dire
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Ciao! Sono qui per presentarti i nostri prodotti..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{script.length} caratteri</span>
              <span>~{Math.ceil(script.split(/\s+/).filter(Boolean).length / 2.5)}s video</span>
            </div>
          </div>

          {/* Voice */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              3. Scegli la voce
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    voice === v.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div>{v.name}</div>
                  <div className="text-xs text-gray-500">{v.gender}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Progress */}
          {isGenerating && (
            <div className="p-4 bg-indigo-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                <span className="text-sm font-medium text-indigo-900">{status}</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-indigo-600 mt-1 text-right">{progress}%</p>
            </div>
          )}

          {/* Video Result */}
          {videoUrl && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  src={videoUrl}
                  controls
                  className="w-full aspect-video"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Scarica Video
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Generate Button */}
          {!videoUrl && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !photo || !script.trim()}
              className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all ${
                isGenerating || !photo || !script.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                <>
                  <VideoCameraIcon className="h-5 w-5" />
                  Genera Video
                </>
              )}
            </button>
          )}
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-500 mt-4">
          Powered by OpenAI + Replicate
        </p>
      </div>
    </div>
  );
}
