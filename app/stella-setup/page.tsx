'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function StellaSetup() {
  const [isCreating, setIsCreating] = useState(false);
  const [tasks, setTasks] = useState([]);

  const createTasks = async () => {
    setIsCreating(true);
    toast.loading('Creando task Stella in Odoo...');

    try {
      const response = await fetch('/api/stella/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        toast.dismiss();
        toast.success(`✅ Creati ${data.tasks.length} task Stella!`);
        setTasks(data.tasks);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(`❌ Errore: ${error.message}`);
    }

    setIsCreating(false);
  };

  const testConnection = async () => {
    toast.loading('Test connessione OpenAI...');

    try {
      const response = await fetch('/api/openai/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: 'general' })
      });

      const data = await response.json();

      if (data.success) {
        toast.dismiss();
        toast.success('✅ Connessione OpenAI OK!');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(`❌ Errore OpenAI: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            🛠️ Stella Setup
          </h1>
          <p className="text-xl text-purple-200">
            Configurazione iniziale per Stella AI Assistant
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Task Creation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 rounded-lg p-6 backdrop-blur-sm border border-white/20"
          >
            <h2 className="text-2xl font-bold mb-4 text-purple-300">
              📋 Creazione Task Odoo
            </h2>
            <p className="text-purple-200 mb-6">
              Crea i task per Stella nel progetto 108 di Odoo con i prompt predefiniti.
            </p>

            <button
              onClick={createTasks}
              disabled={isCreating}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all
                ${isCreating
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                }`}
            >
              {isCreating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creando...</span>
                </div>
              ) : (
                '🚀 Crea Task Stella'
              )}
            </button>

            {tasks.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-green-300 mb-2">Task creati:</h3>
                <ul className="space-y-1 text-sm text-green-200">
                  {tasks.map((task: any) => (
                    <li key={task.id}>✅ {task.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>

          {/* API Test */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 rounded-lg p-6 backdrop-blur-sm border border-white/20"
          >
            <h2 className="text-2xl font-bold mb-4 text-blue-300">
              🔗 Test API OpenAI
            </h2>
            <p className="text-blue-200 mb-6">
              Verifica che la connessione con OpenAI Real-Time API funzioni correttamente.
            </p>

            <button
              onClick={testConnection}
              className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold transition-all"
            >
              🧪 Test Connessione
            </button>
          </motion.div>
        </div>

        {/* Configuration Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10"
        >
          <h3 className="text-xl font-bold mb-4 text-yellow-300">
            ⚙️ Configurazione Richiesta
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-yellow-200 mb-2">Variabili Ambiente:</h4>
              <ul className="space-y-1 text-sm text-yellow-100">
                <li>• <code>OPENAI_API_KEY</code> - Chiave API OpenAI</li>
                <li>• <code>ODOO_URL</code> - URL istanza Odoo</li>
                <li>• <code>ODOO_DB</code> - Database Odoo</li>
                <li>• <code>ODOO_USERNAME</code> - Username Odoo</li>
                <li>• <code>ODOO_PASSWORD</code> - Password Odoo</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-yellow-200 mb-2">Requisiti:</h4>
              <ul className="space-y-1 text-sm text-yellow-100">
                <li>• Progetto Odoo ID 108 esistente</li>
                <li>• OpenAI API con Real-Time access</li>
                <li>• Browser con WebRTC support</li>
                <li>• Microfono funzionante</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <a
            href="/stella-assistant"
            className="inline-block px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-lg transition-all"
          >
            🌟 Vai a Stella Assistant
          </a>
        </motion.div>
      </div>
    </div>
  );
}