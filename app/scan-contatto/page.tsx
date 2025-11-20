'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowLeft,
  Search,
  Link2,
  X,
  Mic,
} from 'lucide-react';
import Image from 'next/image';
import VoiceContactCreator from './VoiceContactCreator';

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
  state: string; // Provincia/Cantone
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

interface CompanySearchResult {
  id: number;
  name: string;
  display_name: string;
  email: string;
  phone: string;
  city: string;
  vat: string;
}

export default function ScanContattoPage() {
  // Router
  const router = useRouter();

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contactType, setContactType] = useState<'company' | 'person' | 'voice'>('company'); // Azienda, Privato o Voce
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'ocr', label: 'Gemini Vision OCR', icon: Scan, status: 'pending' },
    { id: 'websearch', label: 'Claude Web Search', icon: Brain, status: 'pending' },
    { id: 'odoo', label: 'Creazione Odoo', icon: Database, status: 'pending' },
  ]);
  const [extractedData, setExtractedData] = useState<ContactData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [createdContact, setCreatedContact] = useState<OdooContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Link to company states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companySearchResults, setCompanySearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkedCompany, setLinkedCompany] = useState<CompanySearchResult | null>(null);

  // Voice creation state
  const [showVoiceCreator, setShowVoiceCreator] = useState(false);
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
    formData.append('contactType', contactType); // Azienda o Privato

    try {
      // Step 1: Gemini Vision OCR
      updateStepStatus('ocr', 'processing', 'Gemini Vision estrae dati...');

      // Step 2: Claude Web Search
      updateStepStatus('websearch', 'processing', 'Claude cerca su web...');

      // Step 3: Odoo Creation
      updateStepStatus('odoo', 'processing', 'Creazione contatto...');

      // Call NEW API
      const response = await fetch('/api/scan-contatto-complete', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il processing');
      }

      const result = await response.json();

      console.log('📦 [SCAN-CONTATTO-COMPLETE] API Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Pipeline fallita');
      }

      // All steps completed
      updateStepStatus('ocr', 'completed', 'Dati estratti con Gemini');
      updateStepStatus('websearch', 'completed',
        result.webSearchData?.found
          ? `Azienda trovata: ${result.webSearchData.legalName}`
          : 'Azienda non trovata su web'
      );
      updateStepStatus('odoo', 'completed', `Contatto creato in Odoo (ID: ${result.odooContact.id})`);

      // Convert to ContactData format for form
      const contactData: ContactData = {
        name: result.extractedData.name || '',
        email: result.extractedData.email || '',
        phone: result.extractedData.phone || '',
        mobile: result.extractedData.mobile || '',
        street: result.extractedData.street || result.webSearchData?.address?.street || '',
        zip: result.extractedData.zip || result.webSearchData?.address?.zip || '',
        city: result.extractedData.city || result.webSearchData?.address?.city || '',
        state: result.extractedData.state || '',
        country: result.extractedData.country || '',
        company_name: result.extractedData.companyName || result.webSearchData?.legalName || '',
        website: result.extractedData.website || '',
        vat: result.extractedData.companyUID || result.webSearchData?.uid || '',
        function: result.extractedData.position || '',
        comment: result.webSearchData?.creditInfo || '',
      };

      // Contact already created in Odoo!
      setCreatedContact(result.odooContact);
      setExtractedData(contactData);
      setIsEditing(false);
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

  // Note: saveToOdoo removed - contact is created automatically by /api/scan-contatto-complete

  // Search for companies
  const searchCompanies = async (query: string) => {
    if (!query || query.length < 2) {
      setCompanySearchResults([]);
      return;
    }

    setIsSearchingCompanies(true);
    try {
      const response = await fetch(
        `/api/odoo/contacts?search=${encodeURIComponent(query)}&type=company&limit=10`
      );

      if (!response.ok) {
        throw new Error('Errore nella ricerca aziende');
      }

      const result = await response.json();

      if (result.success) {
        setCompanySearchResults(result.data);
      } else {
        throw new Error(result.error || 'Errore nella ricerca');
      }
    } catch (err) {
      console.error('Errore ricerca aziende:', err);
      setError(err instanceof Error ? err.message : 'Errore ricerca aziende');
    } finally {
      setIsSearchingCompanies(false);
    }
  };

  // Link contact to company
  const linkToCompany = async (company: CompanySearchResult) => {
    if (!createdContact) return;

    setIsLinking(true);
    try {
      const response = await fetch(`/api/odoo/contacts/${createdContact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent_id: company.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Errore nel collegamento all\'azienda');
      }

      const result = await response.json();

      if (result.success) {
        setLinkedCompany(company);
        setShowLinkModal(false);
        setCompanySearchQuery('');
        setCompanySearchResults([]);
        // Update the created contact with parent info
        setCreatedContact({
          ...createdContact,
          display_name: result.data.display_name,
        });
      } else {
        throw new Error(result.error || 'Errore nel collegamento');
      }
    } catch (err) {
      console.error('Errore collegamento azienda:', err);
      setError(err instanceof Error ? err.message : 'Errore collegamento azienda');
    } finally {
      setIsLinking(false);
    }
  };
  // Handle voice contact creation (uses the same endpoint as file scan)
  const handleVoiceContactComplete = async (data: {
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
  }) => {
    setIsProcessing(true);
    setError(null);

    // Update steps to show voice processing
    setSteps((prev) =>
      prev.map((step, idx) => ({
        ...step,
        status: idx === 0 ? 'processing' : 'pending',
        message: idx === 0 ? 'Pulizia dati vocali con Claude AI...' : undefined,
      }))
    );

    try {
      console.log('[Voice] 🎤 Sending raw voice data to AI cleaning pipeline...');

      // Call the unified endpoint with JSON data (voice mode)
      const response = await fetch('/api/scan-contatto-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // This triggers voice mode
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella creazione del contatto');
      }

      const result = await response.json();

      console.log('[Voice] ✅ Contact created:', result);

      if (result.success) {
        // Show all steps as completed
        setSteps((prev) =>
          prev.map((step) => ({
            ...step,
            status: 'completed',
            message: 'Completato',
          }))
        );

        setExtractedData(result.extractedData || {
          name: data.name,
          email: data.email,
          phone: data.phone,
          mobile: data.mobile,
          street: data.street,
          zip: data.zip,
          city: data.city,
          state: data.state,
          country: data.country,
          comment: data.comment,
        });

        setCreatedContact(result.odooContact);
        setShowVoiceCreator(false);
        setContactType('person');
      } else {
        throw new Error(result.error || 'Errore nella creazione');
      }
    } catch (err) {
      console.error('[Voice] ❌ Error creating voice contact:', err);
      setError(err instanceof Error ? err.message : 'Errore creazione contatto');

      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: step.status === 'processing' ? 'error' : step.status,
          message: step.status === 'processing' ? 'Errore' : undefined,
        }))
      );
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
    setLinkedCompany(null);
    setShowLinkModal(false);
    setCompanySearchQuery('');
    setCompanySearchResults([]);
    setShowVoiceCreator(false);
    setSteps((prev) =>
      prev.map((step) => ({ ...step, status: 'pending', message: undefined }))
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Back Button - Mobile: larger touch target */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push('/')}
          className="mb-6 flex items-center gap-2 min-h-[48px] rounded-lg bg-white px-4 py-3 text-base md:text-sm text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:shadow-lg active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-semibold md:font-medium">Torna alla Dashboard</span>
        </motion.button>

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

        {/* Toggle Azienda/Privato - PRIMA di tutto */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 mx-auto max-w-md"
        >
          <div className="rounded-2xl bg-white/70 p-6 shadow-xl backdrop-blur-md">
            <label className="mb-4 block text-center text-lg font-semibold text-gray-900">
              Che tipo di contatto vuoi scansionare?
            </label>
            {/* Mobile: touch-friendly buttons (min 48px height) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setContactType('company');
                  setShowVoiceCreator(false);
                }}
                className={`min-h-[64px] rounded-xl px-6 py-4 font-bold transition-all active:scale-95 ${
                  contactType === 'company'
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-2xl scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                }`}
              >
                <Building2 className="mx-auto mb-2 h-8 w-8" />
                <div className="text-base sm:text-lg">Azienda</div>
              </button>
              <button
                onClick={() => {
                  setContactType('person');
                  setShowVoiceCreator(false);
                }}
                className={`min-h-[64px] rounded-xl px-6 py-4 font-bold transition-all active:scale-95 ${
                  contactType === 'person'
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-2xl scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                }`}
              >
                <User className="mx-auto mb-2 h-8 w-8" />
                <div className="text-base sm:text-lg">Privato</div>
              </button>
              <button
                onClick={() => {
                  setContactType('voice');
                  setShowVoiceCreator(true);
                }}
                className={`min-h-[64px] rounded-xl px-6 py-4 font-bold transition-all active:scale-95 ${
                  contactType === 'voice'
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-2xl scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                }`}
              >
                <Mic className="mx-auto mb-2 h-8 w-8" />
                <div className="text-base sm:text-lg">Con Voce</div>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Voice Contact Creator */}
        {showVoiceCreator && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl"
          >
            <VoiceContactCreator
              onComplete={handleVoiceContactComplete}
              onCancel={() => {
                setShowVoiceCreator(false);
                setContactType('person');
              }}
            />
          </motion.div>
        )}

        {/* Mobile: single column layout, desktop: two columns */}
        {!showVoiceCreator && (
                <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
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
                  ${selectedFile ? 'min-h-[200px]' : 'min-h-[300px] md:min-h-[400px]'}
                `}
              >
                {/* Mobile-optimized file input with camera access */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment" // Opens rear camera on mobile
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
                      className="flex min-h-[300px] md:min-h-[400px] flex-col items-center justify-center p-6 md:p-8 text-center"
                    >
                      {/* Mobile: Larger touch target with camera icon */}
                      <div className="mb-6 rounded-full bg-blue-100 p-8 md:p-6 transition-transform group-hover:scale-110">
                        <ImageIcon className="h-16 w-16 md:h-12 md:w-12 text-blue-600" />
                      </div>
                      <p className="mb-3 text-xl md:text-lg font-bold text-gray-700">
                        Scatta o Carica Foto
                      </p>
                      <p className="text-base md:text-sm text-gray-600 mb-2">
                        Tocca per aprire la fotocamera
                      </p>
                      <p className="text-sm md:text-xs text-gray-500">
                        oppure seleziona dalla galleria
                      </p>
                      <p className="mt-6 text-xs text-gray-400">
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

              {/* Process Button - Mobile: larger touch target (min 48px height) */}
              {selectedFile && !extractedData && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={processImage}
                  disabled={isProcessing}
                  className="mt-6 w-full min-h-[48px] md:min-h-[44px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-base md:text-sm font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 md:h-5 md:w-5 animate-spin" />
                      <span className="text-base md:text-sm">Elaborazione in corso...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="h-6 w-6 md:h-5 md:w-5" />
                      <span className="text-base md:text-sm">Avvia Scansione AI</span>
                    </span>
                  )}
                </motion.button>
              )}
            </div>

            {/* Processing Steps - Mobile: larger text and spacing */}
            {(isProcessing || extractedData) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl bg-white/70 p-4 md:p-6 shadow-xl backdrop-blur-md"
              >
                <h2 className="mb-4 text-lg md:text-xl font-bold md:font-semibold text-gray-900">
                  Progresso Elaborazione
                </h2>

                <div className="space-y-3 md:space-y-4">
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
                        {/* Icon - Mobile: larger */}
                        <div
                          className={`
                            flex h-12 w-12 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full
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
                            <CheckCircle2 className="h-6 w-6 md:h-5 md:w-5" />
                          ) : step.status === 'error' ? (
                            <XCircle className="h-6 w-6 md:h-5 md:w-5" />
                          ) : step.status === 'processing' ? (
                            <Loader2 className="h-6 w-6 md:h-5 md:w-5 animate-spin" />
                          ) : (
                            <Icon className="h-6 w-6 md:h-5 md:w-5" />
                          )}
                        </div>

                        {/* Content - Mobile: larger text */}
                        <div className="flex-1">
                          <p className="text-base md:text-sm font-semibold md:font-medium text-gray-900">
                            {step.label}
                          </p>
                          {step.message && (
                            <p
                              className={`text-sm md:text-xs mt-1 ${
                                step.status === 'error'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {/* Mobile: truncate long error messages */}
                              <span className="line-clamp-2 md:line-clamp-none">
                                {step.message}
                              </span>
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

                  {/* Show linked company info if linked */}
                  {linkedCompany && (
                    <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-6 w-6 text-blue-600 shrink-0" />
                        <div>
                          <p className="font-semibold text-blue-900">
                            Collegato ad Azienda
                          </p>
                          <p className="text-sm text-blue-700">
                            {linkedCompany.display_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile: larger touch-friendly buttons */}
                  <div className="space-y-3">
                    <a
                      href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${createdContact.id}&model=res.partner&view_type=form`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-blue-600 px-6 py-3 text-base md:text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Apri in Odoo
                    </a>

                    {/* Show "Link to Company" button only for private contacts */}
                    {contactType === 'person' && !linkedCompany && (
                      <button
                        onClick={() => setShowLinkModal(true)}
                        className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-base md:text-sm font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl active:scale-95"
                      >
                        <Link2 className="h-5 w-5" />
                        Collega ad Azienda
                      </button>
                    )}

                    <button
                      onClick={resetForm}
                      className="w-full min-h-[48px] rounded-xl bg-white px-6 py-3 text-base md:text-sm font-semibold text-gray-700 shadow-md transition-all hover:bg-gray-50 hover:shadow-lg active:scale-95"
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

                    {/* Email - Mobile keyboard: email type */}
                    <FormField
                      icon={Mail}
                      label="Email"
                      value={extractedData.email}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, email: value })
                      }
                      isEditing={isEditing}
                      type="email"
                      inputMode="email"
                    />

                    {/* Phone - Mobile keyboard: tel type */}
                    <FormField
                      icon={Phone}
                      label="Telefono"
                      value={extractedData.phone}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, phone: value })
                      }
                      isEditing={isEditing}
                      type="tel"
                      inputMode="tel"
                    />

                    {/* Mobile - Mobile keyboard: tel type */}
                    <FormField
                      icon={Phone}
                      label="Cellulare"
                      value={extractedData.mobile}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, mobile: value })
                      }
                      isEditing={isEditing}
                      type="tel"
                      inputMode="tel"
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

                    {/* ZIP & City - Mobile: stacked on small screens */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        icon={Hash}
                        label="CAP"
                        value={extractedData.zip}
                        onChange={(value) =>
                          setExtractedData({ ...extractedData, zip: value })
                        }
                        isEditing={isEditing}
                        inputMode="numeric"
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

                    {/* State/Province */}
                    <FormField
                      icon={MapPin}
                      label="Provincia/Cantone"
                      value={extractedData.state}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, state: value })
                      }
                      isEditing={isEditing}
                    />

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

                    {/* Website - Mobile keyboard: url type */}
                    <FormField
                      icon={Globe}
                      label="Sito Web"
                      value={extractedData.website}
                      onChange={(value) =>
                        setExtractedData({ ...extractedData, website: value })
                      }
                      isEditing={isEditing}
                      type="url"
                      inputMode="url"
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

                  {/* Info: Contact already created */}
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-green-900">
                          Contatto già creato in Odoo!
                        </p>
                        <p className="text-sm text-green-700">
                          Puoi vedere i dettagli estratti qui sopra. Il contatto è già stato salvato automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
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
        )}

        {/* Link to Company Modal */}
        <AnimatePresence>
          {showLinkModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLinkModal(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />

              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div className="relative max-w-2xl w-full max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-6 w-6" />
                        <h3 className="text-xl font-bold">Collega ad Azienda</h3>
                      </div>
                      <button
                        onClick={() => setShowLinkModal(false)}
                        className="rounded-lg p-2 transition-colors hover:bg-white/20"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                    {/* Search Input - Mobile optimized */}
                    <div className="mb-6">
                      <label className="mb-2 block text-base md:text-sm font-semibold md:font-medium text-gray-700">
                        Cerca Azienda
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          inputMode="search"
                          value={companySearchQuery}
                          onChange={(e) => {
                            setCompanySearchQuery(e.target.value);
                            searchCompanies(e.target.value);
                          }}
                          placeholder="Digita il nome dell'azienda..."
                          className="w-full min-h-[48px] md:min-h-[44px] rounded-lg border-2 md:border border-gray-300 bg-white pl-10 pr-4 py-3 text-base md:text-sm text-gray-900 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Search Results */}
                    {isSearchingCompanies ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                      </div>
                    ) : companySearchResults.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 mb-3">
                          {companySearchResults.length} {companySearchResults.length === 1 ? 'azienda trovata' : 'aziende trovate'}
                        </p>
                        {companySearchResults.map((company) => (
                          <motion.button
                            key={company.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => linkToCompany(company)}
                            disabled={isLinking}
                            className="w-full rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {company.display_name}
                                </p>
                                {company.vat && (
                                  <p className="text-sm text-gray-600">
                                    P.IVA: {company.vat}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                  {company.city && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {company.city}
                                    </span>
                                  )}
                                  {company.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {company.email}
                                    </span>
                                  )}
                                  {company.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {company.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isLinking ? (
                                <Loader2 className="h-5 w-5 animate-spin text-purple-600 shrink-0 ml-4" />
                              ) : (
                                <Link2 className="h-5 w-5 text-purple-600 shrink-0 ml-4" />
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : companySearchQuery.length >= 2 ? (
                      <div className="rounded-xl bg-gray-50 p-8 text-center">
                        <Building2 className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                        <p className="text-gray-600">
                          Nessuna azienda trovata per "{companySearchQuery}"
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-gray-50 p-8 text-center">
                        <Search className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                        <p className="text-gray-600">
                          Digita almeno 2 caratteri per cercare un'azienda
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Form Field Component - Mobile-optimized
interface FormFieldProps {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  type?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | 'search';
  multiline?: boolean;
}

function FormField({
  icon: Icon,
  label,
  value,
  onChange,
  isEditing,
  type = 'text',
  inputMode,
  multiline = false,
}: FormFieldProps) {
  return (
    <div>
      {/* Mobile: larger label text (16px+) for readability */}
      <label className="mb-2 flex items-center gap-2 text-base md:text-sm font-semibold md:font-medium text-gray-700">
        <Icon className="h-5 w-5 md:h-4 md:w-4 text-gray-500" />
        {label}
      </label>

      {isEditing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full min-h-[48px] md:min-h-[44px] rounded-lg border-2 md:border border-gray-300 bg-white px-4 py-3 text-base md:text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
          />
        ) : (
          <input
            type={type}
            inputMode={inputMode} // Mobile: triggers appropriate keyboard
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-[48px] md:min-h-[44px] rounded-lg border-2 md:border border-gray-300 bg-white px-4 py-3 text-base md:text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )
      ) : (
        <div className="rounded-lg bg-gray-50 px-4 py-3 min-h-[48px] md:min-h-[44px] flex items-center text-base md:text-sm text-gray-900">
          {value || (
            <span className="italic text-gray-400">Non specificato</span>
          )}
        </div>
      )}
    </div>
  );
}
