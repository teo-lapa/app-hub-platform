'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Sparkles, Package } from 'lucide-react';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface ParsedInvoice {
  fornitore: string;
  numero_fattura: string;
  data_fattura: string;
  prodotti: Array<{
    nome: string;
    codice?: string;
    quantita: number;
    prezzo_unitario: number;
    prezzo_totale: number;
    unita_misura?: string;
    note?: string;
  }>;
}

export default function ProductCreator() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Tipo file non supportato. Usa JPG, PNG o PDF');
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File troppo grande. Massimo 10MB');
        return;
      }

      setSelectedFile(file);
      setParsedData(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Seleziona un file prima!');
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading('🤖 Claude sta analizzando la fattura...');

    try {
      const formData = new FormData();
      formData.append('invoice', selectedFile);

      const response = await fetch('/api/product-creator/parse-invoice', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setParsedData(result.data);
        toast.success(`✅ Trovati ${result.data.prodotti.length} prodotti!`, {
          id: loadingToast,
        });
      } else {
        toast.error(result.error || 'Errore nel parsing', {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Errore durante l\'upload', {
        id: loadingToast,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleProceedToSelection = () => {
    if (!parsedData) return;

    // Store data in sessionStorage to pass to next page
    sessionStorage.setItem('parsedInvoice', JSON.stringify(parsedData));
    router.push('/product-creator/select-products');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <AppHeader
        title="🤖 Creazione Prodotti AI"
        subtitle="Crea prodotti automaticamente dalle fatture"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white shadow-xl">
            <Sparkles className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            Creazione Prodotti Intelligente
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Carica la fattura e lascia che l'intelligenza artificiale estragga e arricchisca
            automaticamente le informazioni dei prodotti
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" />
            Come Funziona
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <Upload className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">1. Carica Fattura</p>
              <p className="text-xs text-gray-500 mt-1">PDF o Immagine</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">2. AI Estrae Dati</p>
              <p className="text-xs text-gray-500 mt-1">Claude Vision</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">3. Selezioni Prodotti</p>
              <p className="text-xs text-gray-500 mt-1">Scegli quali creare</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">4. Creazione Auto</p>
              <p className="text-xs text-gray-500 mt-1">In Odoo</p>
            </div>
          </div>
        </motion.div>

        {/* Upload Section */}
        {!parsedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <div className="max-w-xl mx-auto">
              {/* File Input */}
              <div className="mb-6">
                <label
                  htmlFor="file-upload"
                  className="block w-full cursor-pointer"
                >
                  <div className="border-2 border-dashed border-purple-300 rounded-xl p-12 text-center hover:border-purple-500 hover:bg-purple-50 transition-all">
                    <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-700 mb-2">
                      {selectedFile
                        ? selectedFile.name
                        : 'Clicca per caricare la fattura'}
                    </p>
                    <p className="text-sm text-gray-500">
                      PDF, JPG o PNG (max 10MB)
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </label>
              </div>

              {/* Upload Button */}
              {selectedFile && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isUploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5 animate-spin" />
                      Analisi in corso...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Analizza con AI
                    </span>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Results Preview */}
        {parsedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                ✅ Fattura Analizzata!
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Fornitore</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {parsedData.fornitore}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Numero Fattura</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {parsedData.numero_fattura}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Data</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {parsedData.data_fattura}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xl font-semibold text-gray-800 mb-3">
                Prodotti Trovati ({parsedData.prodotti.length})
              </h4>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {parsedData.prodotti.map((prod, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{prod.nome}</p>
                      {prod.codice && (
                        <p className="text-sm text-gray-600">
                          Codice: {prod.codice}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {prod.quantita} {prod.unita_misura || 'PZ'}
                      </p>
                      <p className="font-semibold text-gray-800">
                        €{prod.prezzo_unitario.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setParsedData(null);
                  setSelectedFile(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300 transition-all"
              >
                Carica Altra Fattura
              </button>
              <button
                onClick={handleProceedToSelection}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                Continua →
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
