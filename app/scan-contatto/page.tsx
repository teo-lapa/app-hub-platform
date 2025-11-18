'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileImage,
  Scan,
  Brain,
  Sparkles,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit3,
  Save,
  ExternalLink,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Globe,
  Hash,
  FileText,
  AlertCircle,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import Image from 'next/image';

// Types
interface ProcessingStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface ContactData {
  name: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  company_name: string;
  website: string;
  vat: string;
  function: string;
  comment: string;
}

interface OdooContact {
  id: number;
  name: string;
  display_name: string;
}

export default function ScanContattoPage() {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'ocr', label: 'Tesseract OCR', icon: Scan, status: 'pending' },
    { id: 'llama', label: 'Llama 3.2 Vision', icon: Brain, status: 'pending' },
    { id: 'claude', label: 'Claude Refinement', icon: Sparkles, status: 'pending' },
    { id: 'odoo', label: 'Salva in Odoo', icon: Database, status: 'pending' },
  ]);
  const [extractedData, setExtractedData] = useState<ContactData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [createdContact, setCreatedContact] = useState<OdooContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Per favore seleziona un file immagine');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File troppo grande. Max 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setCreatedContact(null);
    setExtractedData(null);
    setIsEditing(false);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const updateStepStatus = (
    stepId: string,
    status: ProcessingStep['status'],
    message?: string
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, message } : step
      )
    );
  };

  const processImage = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    // Reset steps
    setSteps((prev) =>
      prev.map((step) => ({ ...step, status: 'pending', message: undefined }))
    );

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Step 1: OCR
      updateStepStatus('ocr', 'processing', 'Estrazione testo...');
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 2: Llama Vision
      updateStepStatus('ocr', 'completed', 'Testo estratto');
      updateStepStatus('llama', 'processing', 'Analisi intelligente...');
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Step 3: Claude Refinement
      updateStepStatus('llama', 'completed', 'Dati identificati');
      updateStepStatus('claude', 'processing', 'Raffinamento dati...');

      // Call API
      const response = await fetch('/api/scan-contatto', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il processing');
      }

      const result = await response.json();

      updateStepStatus('claude', 'completed', 'Dati raffinati');
      updateStepStatus('odoo', 'completed', 'Pronto per il salvataggio');

      // Fix: API returns result.data.contact, not result.contact
      setExtractedData(result.data?.contact || result.contact);
      setIsEditing(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMessage);

      // Mark current processing step as error
      const processingStep = steps.find((s) => s.status === 'processing');
      if (processingStep) {
        updateStepStatus(processingStep.id, 'error', errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToOdoo = async () => {
    if (!extractedData) return;

    setIsProcessing(true);
    updateStepStatus('odoo', 'processing', 'Salvataggio in Odoo...');

    try {
      const response = await fetch('/api/scan-contatto/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractedData),
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      const result = await response.json();

      updateStepStatus('odoo', 'completed', 'Contatto creato!');
      setCreatedContact(result.contact);
      setIsEditing(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Errore di salvataggio';
      setError(errorMessage);
      updateStepStatus('odoo', 'error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setCreatedContact(null);
    setError(null);
    setIsEditing(false);
    setSteps((prev) =>
      prev.map((step) => ({ ...step, status: 'pending', message: undefined }))
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-lg">
              <Scan className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              Scan Contatto
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Carica biglietto da visita o fattura - AI estrae i dati
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column: Upload & Preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Upload Area */}
            <div className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-md">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900">
                <Upload className="h-5 w-5 text-blue-600" />
                Carica Immagine
              </h2>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed
                  transition-all duration-300
                  ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/50'
                  }
                  ${selectedFile ? 'min-h-[200px]' : 'min-h-[300px]'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />

                <AnimatePresence mode="wait">
                  {!selectedFile ? (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center"
                    >
                      <div className="mb-4 rounded-full bg-blue-100 p-6 transition-transform group-hover:scale-110">
                        <ImageIcon className="h-12 w-12 text-blue-600" />
                      </div>
                      <p className="mb-2 text-lg font-semibold text-gray-700">
                        Trascina immagine qui
                      </p>
                      <p className="text-sm text-gray-500">
                        oppure clicca per selezionare
                      </p>
                      <p className="mt-4 text-xs text-gray-400">
                        JPG, PNG, WEBP - Max 10MB
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative"
                    >
                      {previewUrl && (
                        <div className="relative h-[400px] w-full">
                          <Image
                            src={previewUrl}
                            alt="Preview"
                            fill
                            className="object-contain"
                          />
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resetForm();
                        }}
                        className="absolute right-2 top-2 rounded-lg bg-red-500 p-2 text-white shadow-lg transition-transform hover:scale-110 hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="absolute bottom-2 left-2 rounded-lg bg-black/70 px-3 py-1 backdrop-blur-sm">
                        <p className="text-xs text-white">
                          {selectedFile.name}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Process Button */}
              {selectedFile && !extractedData && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={processImage}
                  disabled={isProcessing}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Elaborazione in corso...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Avvia Scansione AI
                    </span>
                  )}
                </motion.button>
              )}
            </div>

            {/* Processing Steps */}
            {(isProcessing || extractedData) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-md"
              >
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Progresso Elaborazione
                </h2>

                <div className="space-y-4">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-4"
                      >
                        {/* Icon */}
                        <div
                          className={`
                            flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                            transition-all duration-300
                            ${
                              step.status === 'completed'
                                ? 'bg-green-100 text-green-600'
                                : step.status === 'processing'
                                  ? 'animate-pulse bg-blue-100 text-blue-600'
                                  : step.status === 'error'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-gray-100 text-gray-400'
                            }
                          `}
                        >
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : step.status === 'error' ? (
                            <XCircle className="h-5 w-5" />
                          ) : step.status === 'processing' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {step.label}
                          </p>
                          {step.message && (
                            <p
                              className={`text-sm ${
                                step.status === 'error'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {step.message}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column: Extracted Data */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              {/* Error State */}
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="rounded-2xl bg-red-50 p-6 shadow-xl"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-red-100 p-3">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-red-900">
                        Errore
                      </h3>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Success State */}
              {createdContact && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 p-8 shadow-xl"
                >
                  <div className="mb-6 text-center">
                    <div className="mb-4 flex justify-center">
                      <div className="rounded-full bg-green-100 p-6">
                        <CheckCircle2 className="h-16 w-16 text-green-600" />
                      </div>
                    </div>
                    <h3 className="mb-2 text-2xl font-bold text-gray-900">
                      Contatto Creato!
                    </h3>
                    <p className="text-lg text-gray-700">
                      {createdContact.display_name}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <a
                      href={`https://odoo.trentafood.ch/web#id=${createdContact.id}&model=res.partner&view_type=form`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Apri in Odoo
                    </a>

                    <button
                      onClick={resetForm}
                      className="w-full rounded-xl bg-white px-6 py-3 font-semibold text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:shadow-lg"
                    >
                      Scansiona Nuovo Contatto
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Extracted Data Form */}
              {extractedData && !createdContact && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-md"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Dati Estratti
                    </h2>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <Edit3 className="h-4 w-4" />
                      {isEditing ? 'Modalità Lettura' : 'Modifica'}
                    </button>
                  </div>

                  <div className="mb-6 space-y-4">
                    {/* Name */}
                    <FormField
                      icon={User}
                      label="Nome"
                      value={extractedData.name}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, name: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* Email */}
                    <FormField
                      icon={Mail}
                      label="Email"
                      value={extractedData.email}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, email: value })
                      }
                      isEditing={isEditing}
                      type="email"
                    />

                    {/* Phone */}
                    <FormField
                      icon={Phone}
                      label="Telefono"
                      value={extractedData.phone}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, phone: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* Mobile */}
                    <FormField
                      icon={Phone}
                      label="Cellulare"
                      value={extractedData.mobile}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, mobile: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* Company */}
                    <FormField
                      icon={Building2}
                      label="Azienda"
                      value={extractedData.company_name}
                      onChange={(value) =>
                        setExtractedData({
                          ...extractedData,
                          company_name: value,
                        })
                      }
                      isEditing={isEditing}
                    />

                    {/* Function */}
                    <FormField
                      icon={FileText}
                      label="Funzione"
                      value={extractedData.function}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, function: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* Street */}
                    <FormField
                      icon={MapPin}
                      label="Indirizzo"
                      value={extractedData.street}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, street: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* ZIP & City */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        icon={Hash}
                        label="CAP"
                        value={extractedData.zip}
                        onChange={(value) =>
                          setExtractedData({ ...extractedData, zip: value })
                        }
                        isEditing={isEditing}
                      />
                      <FormField
                        icon={MapPin}
                        label="Città"
                        value={extractedData.city}
                        onChange={(value) =>
                          setExtractedData({ ...extractedData, city: value })
                        }
                        isEditing={isEditing}
                      />
                    </div>

                    {/* Country */}
                    <FormField
                      icon={Globe}
                      label="Paese"
                      value={extractedData.country}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, country: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* Website */}
                    <FormField
                      icon={Globe}
                      label="Sito Web"
                      value={extractedData.website}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, website: value })
                      }
                      isEditing={isEditing}
                      type="url"
                    />

                    {/* VAT */}
                    <FormField
                      icon={Hash}
                      label="P.IVA"
                      value={extractedData.vat}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, vat: value })
                      }
                      isEditing={isEditing}
                    />

                    {/* Comment */}
                    <FormField
                      icon={FileText}
                      label="Note"
                      value={extractedData.comment}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, comment: value })
                      }
                      isEditing={isEditing}
                      multiline
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveToOdoo}
                    disabled={isProcessing}
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Salvataggio...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Save className="h-5 w-5" />
                        Salva in Odoo
                      </span>
                    )}
                  </button>
                </motion.div>
              )}

              {/* Empty State */}
              {!extractedData && !error && !isProcessing && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[400px] items-center justify-center rounded-2xl bg-white/70 p-12 shadow-xl backdrop-blur-md"
                >
                  <div className="text-center">
                    <div className="mb-4 flex justify-center">
                      <div className="rounded-full bg-gray-100 p-8">
                        <Sparkles className="h-12 w-12 text-gray-400" />
                      </div>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-gray-900">
                      In attesa di scansione
                    </h3>
                    <p className="text-gray-600">
                      Carica un'immagine per iniziare
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Form Field Component
interface FormFieldProps {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  type?: string;
  multiline?: boolean;
}

function FormField({
  icon: Icon,
  label,
  value,
  onChange,
  isEditing,
  type = 'text',
  multiline = false,
}: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Icon className="h-4 w-4 text-gray-500" />
        {label}
      </label>

      {isEditing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )
      ) : (
        <div className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">
          {value || (
            <span className="italic text-gray-400">Non specificato</span>
          )}
        </div>
      )}
    </div>
  );
}
