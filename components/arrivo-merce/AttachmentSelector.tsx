'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image as ImageIcon, CheckCircle, Star, Loader, Eye, X, ZoomIn, Check } from 'lucide-react';

interface Attachment {
  id: number;
  name: string;
  mimetype: string;
  file_size: number;
  file_size_mb: string;
  create_date: string;
  score: number;
  reason: string;
  is_recommended: boolean;
}

interface AttachmentSelectorProps {
  attachments: Attachment[];
  recommendedAttachment: Attachment | null;
  loading: boolean;
  processing?: boolean; // 🆕 Sta processando/parsando l'allegato
  onSelect: (attachment: Attachment) => void;
  onSelectMultiple?: (attachments: Attachment[]) => void; // 🆕 Multi-selezione
  onManualUpload: () => void;
}

export default function AttachmentSelector({
  attachments,
  recommendedAttachment,
  loading,
  processing = false, // 🆕 Default false
  onSelect,
  onSelectMultiple, // 🆕 Multi-selezione
  onManualUpload
}: AttachmentSelectorProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // 🆕 IDs allegati selezionati

  // 🆕 Toggle selezione allegato
  const toggleSelection = (attachmentId: number) => {
    setSelectedIds(prev =>
      prev.includes(attachmentId)
        ? prev.filter(id => id !== attachmentId)
        : [...prev, attachmentId]
    );
  };

  // 🆕 Processa allegati selezionati
  const handleProcessSelected = () => {
    const selected = attachments.filter(att => selectedIds.includes(att.id));
    if (onSelectMultiple && selected.length > 0) {
      onSelectMultiple(selected);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Caricamento allegati...</span>
      </div>
    );
  }

  const getFileIcon = (mimetype: string) => {
    if (mimetype === 'application/pdf') {
      return <FileText className="text-red-600" size={24} />;
    }
    return <ImageIcon className="text-blue-600" size={24} />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePreview = async (e: React.MouseEvent, attachment: Attachment) => {
    e.stopPropagation(); // Non trigger onSelect

    setPreviewAttachment(attachment);
    setPreviewLoading(true);
    setPreviewUrl(null);

    try {
      // Scarica allegato da Odoo
      const response = await fetch('/api/arrivo-merce/download-attachment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_id: attachment.id })
      });

      const data = await response.json();

      if (response.ok && data.base64) {
        // Converti base64 in URL per anteprima
        const dataUrl = `data:${attachment.mimetype};base64,${data.base64}`;
        setPreviewUrl(dataUrl);
      } else {
        alert('Errore caricamento anteprima');
      }
    } catch (error) {
      console.error('Errore preview:', error);
      alert('Errore caricamento anteprima');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      {/* 🆕 Overlay di Processing */}
      {processing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
            <div className="mb-4">
              <svg className="animate-spin h-16 w-16 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              🤖 Parsing in corso...
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Gemini AI sta analizzando il documento
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            📎 {onSelectMultiple ? 'Seleziona Allegati da Processare' : 'Seleziona Allegato da Processare'}
          </h3>
          <p className="text-gray-600 text-sm">
            {attachments.length} allegato{attachments.length !== 1 ? 'i' : ''} trovato{attachments.length !== 1 ? 'i' : ''} nell'ordine
            {onSelectMultiple && selectedIds.length > 0 && (
              <span className="ml-2 text-blue-600 font-bold">
                • {selectedIds.length} selezionato{selectedIds.length !== 1 ? 'i' : ''}
              </span>
            )}
          </p>
        </div>

        {attachments.map((attachment, index) => {
          const isSelected = selectedIds.includes(attachment.id);

          return (
            <motion.div
              key={attachment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative bg-white rounded-xl border-2 p-4 transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : attachment.is_recommended
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
                }
              `}
            >
              {/* Badge "RACCOMANDATO" */}
              {attachment.is_recommended && (
                <div className="absolute -top-3 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Star size={12} fill="white" />
                  RACCOMANDATO
                </div>
              )}

              <div className="flex items-start gap-4">
                {/* 🆕 Checkbox (solo se multi-selezione abilitata) */}
                {onSelectMultiple && (
                  <div
                    onClick={() => toggleSelection(attachment.id)}
                    className={`
                      w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all mt-4
                      ${isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-300 hover:border-blue-400'
                      }
                    `}
                  >
                    {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                  </div>
                )}

                {/* Icon */}
                <div className={`
                  w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSelected
                    ? 'bg-blue-100'
                    : attachment.is_recommended
                      ? 'bg-green-100'
                      : 'bg-gray-100'
                  }
                `}>
                  {getFileIcon(attachment.mimetype)}
                </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Nome file */}
                <h4 className="font-bold text-gray-900 text-lg mb-1 truncate">
                  {attachment.name}
                </h4>

                {/* Metadati */}
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    {attachment.reason}
                  </span>
                  <span>•</span>
                  <span>{attachment.file_size_mb} MB</span>
                  <span>•</span>
                  <span>{formatDate(attachment.create_date)}</span>
                </div>

                {/* Tipo file */}
                <div className="mt-2">
                  <span className="inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                    {attachment.mimetype === 'application/pdf' ? 'PDF' : 'Immagine'}
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mt-3">
                  {/* Button Anteprima */}
                  <button
                    onClick={(e) => handlePreview(e, attachment)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Eye size={16} />
                    Anteprima
                  </button>

                  {/* Button Usa Questo (solo se NON multi-selezione) */}
                  {!onSelectMultiple && (
                    <button
                      onClick={() => onSelect(attachment)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium
                        ${attachment.is_recommended
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-800 hover:bg-gray-900 text-white'
                        }
                      `}
                    >
                      <CheckCircle size={16} />
                      Usa Questo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Descrizione aggiuntiva se raccomandato */}
            {attachment.is_recommended && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-sm text-green-700">
                  ✅ Questo allegato sembra essere la fattura o DDT principale
                </p>
              </div>
            )}
          </motion.div>
          );
        })}

        {/* Opzione upload manuale */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onManualUpload}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Oppure carica un file manualmente
          </button>
        </div>

        {/* 🆕 Bottom Action Bar - Multi-selezione */}
        <AnimatePresence>
          {onSelectMultiple && selectedIds.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl border-t-4 border-blue-400 z-40"
            >
              <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white text-blue-600 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                    {selectedIds.length}
                  </div>
                  <div>
                    <div className="font-bold text-lg">
                      {selectedIds.length} Allegato{selectedIds.length !== 1 ? 'i' : ''} Selezionato{selectedIds.length !== 1 ? 'i' : ''}
                    </div>
                    <div className="text-blue-100 text-sm">
                      Verranno processati insieme con Gemini AI
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleProcessSelected}
                    className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold flex items-center gap-2 shadow-lg"
                  >
                    <CheckCircle size={20} />
                    Processa {selectedIds.length} Allegato{selectedIds.length !== 1 ? 'i' : ''}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Anteprima */}
      <AnimatePresence>
        {previewAttachment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setPreviewAttachment(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ZoomIn size={24} />
                  <div>
                    <h3 className="font-bold">{previewAttachment.name}</h3>
                    <p className="text-sm text-gray-300">{previewAttachment.file_size_mb} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600">Caricamento anteprima...</span>
                  </div>
                ) : previewUrl ? (
                  previewAttachment.mimetype === 'application/pdf' ? (
                    <embed
                      src={previewUrl}
                      type="application/pdf"
                      className="w-full h-[70vh] rounded-lg"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt={previewAttachment.name}
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                  )
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    Anteprima non disponibile
                  </div>
                )}
              </div>

              {/* Footer con azione */}
              <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors font-medium"
                >
                  Chiudi
                </button>
                <button
                  onClick={() => {
                    setPreviewAttachment(null);
                    onSelect(previewAttachment);
                  }}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Usa Questo Allegato
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
