'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, Palette, FileText, Video, Check, Sparkles } from 'lucide-react';

// Import components
import PhotoUploader from './components/PhotoUploader';
import OutfitSelector from './components/OutfitSelector';
import BackgroundSelector from './components/BackgroundSelector';
import ScriptEditor from './components/ScriptEditor';
import VideoPreview from './components/VideoPreview';
import GenerationProgress from './components/GenerationProgress';

interface AvatarData {
  photo: File | null;
  photoPreview: string | null;
  outfit: string;
  outfitCustom: string;
  background: string;
  backgroundCustom: string;
  script: string;
  voice: string;
  videoUrl: string | null;
}

interface GenerationState {
  isGenerating: boolean;
  jobId: string | null;
  progress: number;
  step: string;
  error: string | null;
  provider: string | null;
  estimatedCost: string | null;
}

// Map voice UI options to OpenAI TTS voices
const voiceMap: Record<string, string> = {
  male: 'onyx',      // Deep male voice
  female: 'nova',    // Warm female voice
  neutral: 'alloy',  // Neutral voice
};

export default function AvatarGeneratorPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarData, setAvatarData] = useState<AvatarData>({
    photo: null,
    photoPreview: null,
    outfit: 'business',
    outfitCustom: '',
    background: 'modern-office',
    backgroundCustom: '',
    script: '',
    voice: 'male',
    videoUrl: null,
  });

  const [generation, setGeneration] = useState<GenerationState>({
    isGenerating: false,
    jobId: null,
    progress: 0,
    step: '',
    error: null,
    provider: null,
    estimatedCost: null,
  });

  const steps = [
    { number: 1, title: 'Upload Foto', icon: Upload, description: 'Carica la tua foto' },
    { number: 2, title: 'Personalizza Look', icon: Palette, description: 'Scegli outfit e sfondo' },
    { number: 3, title: 'Scrivi Script', icon: FileText, description: 'Crea il tuo messaggio' },
    { number: 4, title: 'Genera Video', icon: Video, description: 'Anteprima e download' },
  ];

  // Poll for video generation status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (generation.isGenerating && generation.jobId) {
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/avatar-generator/generate-video?jobId=${generation.jobId}`);
          const data = await response.json();

          if (data.success) {
            setGeneration(prev => ({
              ...prev,
              progress: data.progress || prev.progress,
              step: data.step || prev.step,
              provider: data.provider || prev.provider,
            }));

            if (data.status === 'completed' && data.videoUrl) {
              setGeneration(prev => ({
                ...prev,
                isGenerating: false,
                progress: 100,
              }));
              setAvatarData(prev => ({
                ...prev,
                videoUrl: data.videoUrl,
              }));
            } else if (data.status === 'failed') {
              setGeneration(prev => ({
                ...prev,
                isGenerating: false,
                error: data.error || 'Errore durante la generazione del video',
              }));
            }
          }
        } catch (error) {
          console.error('Error polling video status:', error);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [generation.isGenerating, generation.jobId]);

  const handlePhotoSelect = useCallback((file: File | null, preview: string) => {
    setAvatarData(prev => ({
      ...prev,
      photo: file,
      photoPreview: preview,
    }));
  }, []);

  const handleOutfitChange = useCallback((outfit: string, customDescription?: string) => {
    setAvatarData(prev => ({
      ...prev,
      outfit,
      outfitCustom: customDescription || '',
    }));
  }, []);

  const handleBackgroundChange = useCallback((background: string, customDescription?: string) => {
    setAvatarData(prev => ({
      ...prev,
      background,
      backgroundCustom: customDescription || '',
    }));
  }, []);

  const handleScriptChange = useCallback((script: string) => {
    setAvatarData(prev => ({ ...prev, script }));
  }, []);

  const handleVoiceChange = useCallback((voice: string) => {
    setAvatarData(prev => ({ ...prev, voice }));
  }, []);

  const handleGenerateVideo = async () => {
    if (!avatarData.photoPreview || !avatarData.script) {
      setGeneration(prev => ({
        ...prev,
        error: 'Foto e script sono obbligatori',
      }));
      return;
    }

    setGeneration({
      isGenerating: true,
      jobId: null,
      progress: 0,
      step: 'Inizializzazione...',
      error: null,
      provider: null,
      estimatedCost: null,
    });

    try {
      // Determine outfit and background values
      const outfitValue = avatarData.outfit === 'custom'
        ? avatarData.outfitCustom
        : avatarData.outfit;

      const backgroundValue = avatarData.background === 'custom'
        ? avatarData.backgroundCustom
        : avatarData.background;

      const response = await fetch('/api/avatar-generator/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoBase64: avatarData.photoPreview,
          script: avatarData.script,
          outfit: outfitValue,
          background: backgroundValue,
          voice: voiceMap[avatarData.voice] || 'alloy',
          provider: 'sora', // Try Sora first, will fallback to Veo
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneration(prev => ({
          ...prev,
          jobId: data.jobId,
          estimatedCost: data.estimatedCost,
        }));
      } else {
        setGeneration(prev => ({
          ...prev,
          isGenerating: false,
          error: data.error || 'Errore durante l\'avvio della generazione',
        }));
      }
    } catch (error: any) {
      setGeneration(prev => ({
        ...prev,
        isGenerating: false,
        error: error.message || 'Errore di rete',
      }));
    }
  };

  const handleRegenerate = () => {
    setAvatarData(prev => ({ ...prev, videoUrl: null }));
    setGeneration({
      isGenerating: false,
      jobId: null,
      progress: 0,
      step: '',
      error: null,
      provider: null,
      estimatedCost: null,
    });
  };

  const handleDownload = () => {
    if (avatarData.videoUrl) {
      const link = document.createElement('a');
      link.href = avatarData.videoUrl;
      link.download = `avatar-video-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return avatarData.photo !== null;
      case 2:
        return avatarData.outfit && avatarData.background;
      case 3:
        return avatarData.script.trim().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  // Calculate generation step for progress component
  const getGenerationStep = () => {
    if (generation.progress < 15) return 1;
    if (generation.progress < 35) return 2;
    if (generation.progress < 95) return 3;
    return 4;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-purple-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              Powered by OpenAI Sora 2 & Google Veo 3.1
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Avatar Video Generator
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Crea video professionali con avatar AI super realistici. Carica una foto, personalizza il look e genera video con lip-sync perfetto.
          </p>
        </motion.div>

        {/* Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isActive ? 1.1 : 1,
                      }}
                      className={`
                        relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
                        ${isCompleted
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/50'
                          : isActive
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50'
                          : 'bg-white dark:bg-slate-800 text-slate-400 border-2 border-slate-200 dark:border-slate-700'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                    <div className="mt-3 text-center">
                      <p className={`text-sm font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 hidden md:block">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-1 mx-4 relative top-[-24px]">
                      <div className="h-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{
                            width: currentStep > step.number ? '100%' : '0%',
                          }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <motion.div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 md:p-12 min-h-[500px] border border-slate-200 dark:border-slate-800"
          layout
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Photo Upload */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
                  Carica la tua foto
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Carica una foto frontale chiara. L'AI creerà un avatar realistico basato sulla tua immagine.
                </p>
                <PhotoUploader
                  onPhotoSelect={handlePhotoSelect}
                  currentPhoto={avatarData.photoPreview || undefined}
                />
              </motion.div>
            )}

            {/* Step 2: Look Customization */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Personalizza il look
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Scegli outfit e sfondo per il tuo avatar video.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Outfit
                  </h3>
                  <OutfitSelector
                    selectedOutfit={avatarData.outfit}
                    onOutfitChange={handleOutfitChange}
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Sfondo
                  </h3>
                  <BackgroundSelector
                    selectedBackground={avatarData.background}
                    onBackgroundChange={handleBackgroundChange}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Script Editor */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  Scrivi il tuo script
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Scrivi il testo che il tuo avatar dirà nel video. Scegli anche la voce.
                </p>
                <ScriptEditor
                  script={avatarData.script}
                  onScriptChange={handleScriptChange}
                  voice={avatarData.voice}
                  onVoiceChange={handleVoiceChange}
                />
              </motion.div>
            )}

            {/* Step 4: Generate & Preview */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full space-y-6"
              >
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  Genera il tuo video
                </h2>

                {/* Show generation progress */}
                {generation.isGenerating && (
                  <div className="space-y-6">
                    <GenerationProgress
                      currentStep={getGenerationStep()}
                      progress={generation.progress}
                    />
                    {generation.provider && (
                      <p className="text-center text-sm text-slate-600">
                        Provider: <span className="font-semibold">{generation.provider === 'sora' ? 'OpenAI Sora 2' : 'Google Veo 3.1'}</span>
                      </p>
                    )}
                    {generation.estimatedCost && (
                      <p className="text-center text-sm text-slate-600">
                        Costo stimato: <span className="font-semibold">${generation.estimatedCost}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Show video preview or generate button */}
                {!generation.isGenerating && (
                  <>
                    <VideoPreview
                      videoUrl={avatarData.videoUrl || undefined}
                      isLoading={false}
                      error={generation.error}
                      onRegenerate={handleRegenerate}
                      onDownload={handleDownload}
                    />

                    {!avatarData.videoUrl && !generation.error && (
                      <div className="space-y-4">
                        {/* Summary */}
                        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Riepilogo</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500 dark:text-slate-400">Outfit</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">{avatarData.outfit}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-slate-400">Sfondo</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">{avatarData.background.replace('-', ' ')}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-slate-400">Voce</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">{avatarData.voice === 'male' ? 'Maschile' : avatarData.voice === 'female' ? 'Femminile' : 'Neutro'}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-slate-400">Parole script</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200">{avatarData.script.split(/\s+/).filter(Boolean).length}</p>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleGenerateVideo}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
                        >
                          <Sparkles className="w-5 h-5" />
                          Genera Video Avatar
                        </button>

                        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                          La generazione richiede 1-3 minuti. Costo: ~$0.10-0.75/secondo di video
                        </p>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 max-w-4xl mx-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`
              px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300
              ${currentStep === 1
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 shadow-md hover:shadow-lg'
              }
            `}
          >
            <ArrowLeft className="w-5 h-5" />
            Indietro
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNext}
            disabled={currentStep === 4 || !canProceed()}
            className={`
              px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300
              ${currentStep === 4 || !canProceed()
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
              }
            `}
          >
            Avanti
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
