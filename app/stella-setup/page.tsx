'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';

interface TaskResult {
  action_id: string;
  task_id?: number;
  name: string;
  success: boolean;
  error?: string;
}

export default function StellaSetup() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TaskResult[]>([]);

  const createTasks = async () => {
    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/stella/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setResults(data.results);
      } else {
        toast.error(data.error || 'Errore nella creazione dei task');
        if (data.results) {
          setResults(data.results);
        }
      }

    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const testPrompt = async (actionId: string) => {
    try {
      const response = await fetch(`/api/stella/tasks?action_id=${actionId}`);
      const data = await response.json();

      if (data.success) {
        toast.success(`Prompt trovato: ${data.task_name}`);
        console.log('Prompt:', data.prompt);
        alert(`PROMPT PER ${data.task_name}:\n\n${data.prompt}`);
      } else {
        toast.error('Errore nel recupero del prompt');
      }
    } catch (error) {
      console.error('Errore test prompt:', error);
      toast.error('Errore test prompt');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <AppHeader
        title="🔧 Setup Stella - Progetto 108"
        subtitle="Configurazione task Odoo per i prompt di Stella"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-xl p-8 mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🎯 Setup Progetto 108
          </h2>

          <p className="text-gray-600 mb-6">
            Questo setup creerà automaticamente 5 task nel progetto Odoo ID 108, uno per ogni pulsante di Stella.
            Ogni task conterrà il prompt specifico che Stella userà per quella funzione.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Task che verranno creati:</h3>
            <ul className="text-blue-700 space-y-1">
              <li>• <strong>Voglio Fare un Ordine</strong> - Prompt per gestire ordini</li>
              <li>• <strong>Lamentele</strong> - Prompt per gestire reclami</li>
              <li>• <strong>Ricerca Prodotto</strong> - Prompt per ricerca prodotti</li>
              <li>• <strong>Richiesta di Intervento</strong> - Prompt per interventi tecnici</li>
              <li>• <strong>Altre Richieste</strong> - Prompt per richieste generiche</li>
            </ul>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={createTasks}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creando task...
              </>
            ) : (
              <>
                🚀 CREA TASK NEL PROGETTO 108
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Results */}
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-xl p-8"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              📊 Risultati Creazione Task
            </h3>

            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    result.success
                      ? 'bg-green-50 border-green-400'
                      : 'bg-red-50 border-red-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-semibold ${
                        result.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.success ? '✅' : '❌'} {result.name}
                      </h4>
                      {result.success && result.task_id && (
                        <p className="text-sm text-green-600">
                          Task ID: {result.task_id}
                        </p>
                      )}
                      {result.error && (
                        <p className="text-sm text-red-600">
                          Errore: {result.error}
                        </p>
                      )}
                    </div>

                    {result.success && (
                      <button
                        onClick={() => testPrompt(result.action_id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                      >
                        Testa Prompt
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}