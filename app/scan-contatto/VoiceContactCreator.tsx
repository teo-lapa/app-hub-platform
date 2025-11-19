'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Square,
  Check,
  X,
  Loader2,
  Edit3,
  Save,
  SkipForward,
  Volume2,
  AlertCircle,
  User,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

// Types
interface ContactFormData {
  name: string;
  phone: string;
  mobile: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  state: string;
  country: string;
  comment: string;
}

interface Question {
  id: keyof ContactFormData;
  question: string;
  icon: React.ElementType;
  optional: boolean;
  placeholder: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'name',
    question: 'Come si chiama il contatto?',
    icon: User,
    optional: false,
    placeholder: 'Es: Mario Rossi',
  },
  {
    id: 'phone',
    question: 'Qual è il numero di telefono?',
    icon: Phone,
    optional: true,
    placeholder: 'Es: 091 123 45 67',
  },
  {
    id: 'mobile',
    question: 'Qual è il numero di cellulare?',
    icon: Phone,
    optional: true,
    placeholder: 'Es: 079 123 45 67',
  },
  {
    id: 'email',
    question: "Qual è l'indirizzo email?",
    icon: Mail,
    optional: true,
    placeholder: 'Es: mario@example.com',
  },
  {
    id: 'street',
    question: "Qual è l'indirizzo (via)?",
    icon: MapPin,
    optional: true,
    placeholder: 'Es: Via Roma 10',
  },
  {
    id: 'zip',
    question: 'Qual è il CAP?',
    icon: MapPin,
    optional: true,
    placeholder: 'Es: 6900',
  },
  {
    id: 'city',
    question: 'In quale città?',
    icon: MapPin,
    optional: true,
    placeholder: 'Es: Lugano',
  },
  {
    id: 'state',
    question: 'Provincia o Cantone?',
    icon: MapPin,
    optional: true,
    placeholder: 'Es: Ticino',
  },
  {
    id: 'country',
    question: 'In quale paese?',
    icon: MapPin,
    optional: true,
    placeholder: 'Es: Svizzera',
  },
  {
    id: 'comment',
    question: 'Vuoi aggiungere delle note?',
    icon: User,
    optional: true,
    placeholder: 'Es: Cliente preferito',
  },
];

interface VoiceContactCreatorProps {
  onComplete: (data: ContactFormData) => void;
  onCancel: () => void;
}

export default function VoiceContactCreator({
  onComplete,
  onCancel,
}: VoiceContactCreatorProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phone: '',
    mobile: '',
    email: '',
    street: '',
    zip: '',
    city: '',
    state: '',
    country: '',
    comment: '',
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentQuestion = QUESTIONS[currentQuestionIndex];

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });

        await transcribeAudio(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(
        'Impossibile accedere al microfono. Controlla i permessi del browser.'
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Errore durante la trascrizione');
      }

      const result = await response.json();

      if (result.success && result.text) {
        setTranscribedText(result.text);
        setIsEditing(true);
      } else {
        throw new Error('Nessun testo trascritto');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante la trascrizione'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const confirmAnswer = () => {
    if (!transcribedText.trim() && !currentQuestion.optional) {
      setError('Questa domanda è obbligatoria');
      return;
    }

    setFormData({
      ...formData,
      [currentQuestion.id]: transcribedText.trim(),
    });

    setTranscribedText('');
    setIsEditing(false);

    // Next question or summary
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowSummary(true);
    }
  };

  const skipQuestion = () => {
    if (!currentQuestion.optional) {
      setError('Questa domanda è obbligatoria');
      return;
    }

    setTranscribedText('');
    setIsEditing(false);

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowSummary(true);
    }
  };

  const goBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setTranscribedText('');
      setIsEditing(false);
    }
  };

  const handleComplete = () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Il nome è obbligatorio');
      return;
    }

    onComplete(formData);
  };

  if (showSummary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-md"
      >
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Riepilogo Contatto
        </h2>

        <div className="mb-6 space-y-4">
          {QUESTIONS.map((q) => {
            const value = formData[q.id];
            if (!value) return null;

            const Icon = q.icon;
            return (
              <div key={q.id} className="flex items-start gap-3">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {q.question}
                  </p>
                  <p className="text-gray-900">{value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowSummary(false)}
            className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            Modifica
          </button>
          <button
            onClick={handleComplete}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white transition-all hover:from-blue-700 hover:to-indigo-700"
          >
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Crea Contatto
            </span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-md"
    >
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Domanda {currentQuestionIndex + 1} di {QUESTIONS.length}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(
              ((currentQuestionIndex + 1) / QUESTIONS.length) * 100
            )}
            %
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
            style={{
              width: `${((currentQuestionIndex + 1) / QUESTIONS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 p-4">
            {currentQuestion && (
              <currentQuestion.icon className="h-12 w-12 text-blue-600" />
            )}
          </div>
        </div>
        <h3 className="mb-2 text-2xl font-bold text-gray-900">
          {currentQuestion.question}
        </h3>
        {currentQuestion.optional && (
          <p className="text-sm text-gray-500">(Opzionale)</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Transcribed Text */}
      <AnimatePresence mode="wait">
        {transcribedText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-6"
          >
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Testo trascritto:
            </label>
            {isEditing ? (
              <input
                type="text"
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="w-full rounded-lg border-2 border-blue-300 bg-white px-4 py-3 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            ) : (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-gray-900">
                {transcribedText}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording State */}
      {isRecording && (
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />
              <div className="relative rounded-full bg-red-500 p-3">
                <Volume2 className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-700">
            Registrazione in corso...
          </p>
        </div>
      )}

      {/* Transcribing State */}
      {isTranscribing && (
        <div className="mb-6 text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-gray-700">
            Trascrizione in corso...
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {!transcribedText && !isTranscribing && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`w-full rounded-xl px-6 py-4 font-semibold text-white transition-all ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isRecording ? (
                <>
                  <Square className="h-5 w-5" />
                  Ferma Registrazione
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" />
                  Registra Risposta
                </>
              )}
            </span>
          </button>
        )}

        {transcribedText && !isRecording && !isTranscribing && (
          <>
            <button
              onClick={confirmAnswer}
              className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 font-semibold text-white transition-all hover:from-green-700 hover:to-emerald-700"
            >
              <span className="flex items-center justify-center gap-2">
                <Check className="h-5 w-5" />
                Conferma
              </span>
            </button>

            <button
              onClick={() => {
                setTranscribedText('');
                setIsEditing(false);
                setError(null);
              }}
              className="w-full rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50"
            >
              <span className="flex items-center justify-center gap-2">
                <X className="h-5 w-5" />
                Registra di Nuovo
              </span>
            </button>
          </>
        )}

        {currentQuestion.optional && !transcribedText && !isRecording && !isTranscribing && (
          <button
            onClick={skipQuestion}
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            <span className="flex items-center justify-center gap-2">
              <SkipForward className="h-5 w-5" />
              Salta Domanda
            </span>
          </button>
        )}

        {currentQuestionIndex > 0 && (
          <button
            onClick={goBack}
            disabled={isRecording || isTranscribing}
            className="w-full rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            Indietro
          </button>
        )}

        <button
          onClick={onCancel}
          disabled={isRecording || isTranscribing}
          className="w-full rounded-xl bg-red-50 px-6 py-3 font-semibold text-red-700 transition-all hover:bg-red-100 disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </motion.div>
  );
}
