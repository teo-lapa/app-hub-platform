'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Search, Users, MessageCircle, Bot, PhoneCall, Mail, MapPin, DollarSign, Clock, Star, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';

interface Client {
  id: number;
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  total_invoiced?: number;
  street?: string;
  city?: string;
}

export default function CentralinoAI() {
  const router = useRouter();
  const { user } = useAuthStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // API call to Odoo
  const callOdoo = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
    try {
      const response = await fetch('/api/odoo/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, method, args, kwargs })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.data?.message || result.error.message || 'Errore sconosciuto');
      }

      return result.result;
    } catch (error) {
      console.error('Errore callOdoo:', error);
      throw error;
    }
  };

  // Search clients function
  const searchClients = async () => {
    if (searchQuery.length < 2) {
      setClients([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await callOdoo('res.partner', 'search_read', [
        [
          '|', '|', '|',
          ['name', 'ilike', searchQuery],
          ['phone', 'ilike', searchQuery],
          ['mobile', 'ilike', searchQuery],
          ['email', 'ilike', searchQuery]
        ]
      ], {
        fields: ['name', 'phone', 'mobile', 'email', 'total_invoiced', 'street', 'city'],
        limit: 20
      });

      setClients(results || []);
    } catch (error) {
      console.error('Errore ricerca clienti:', error);
      toast.error('Errore nella ricerca clienti');
    } finally {
      setIsSearching(false);
    }
  };

  // Auto search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchClients();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Select client
  const selectClient = (client: Client) => {
    setSelectedClient(client);
    toast.success(`Cliente ${client.name} selezionato`);
  };

  // Format phone number for calling
  const formatPhoneForCall = (phone: string) => {
    return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  };

  // Make call (placeholder for now)
  const makeCall = (phone: string) => {
    if (!phone) {
      toast.error('Numero di telefono non disponibile');
      return;
    }

    const formattedPhone = formatPhoneForCall(phone);
    toast.success(`Chiamata avviata a ${formattedPhone}`);
    // Here you would integrate with actual calling system
    console.log('Making call to:', formattedPhone);
  };

  // AI Assistant integration (placeholder)
  const getAIAssistance = async (clientData: Client) => {
    setIsLoading(true);
    try {
      // Simulate AI response
      const response = `Cliente: ${clientData.name}
${clientData.street ? `Indirizzo: ${clientData.street}${clientData.city ? `, ${clientData.city}` : ''}` : ''}
${clientData.total_invoiced ? `Fatturato totale: €${clientData.total_invoiced.toFixed(2)}` : 'Nessun fatturato registrato'}

Suggerimenti AI:
- Cliente ${clientData.total_invoiced && clientData.total_invoiced > 10000 ? 'VIP' : 'standard'}
- Ultimo contatto: da verificare
- Note: Aggiorna informazioni se necessario`;

      setAiResponse(response);
    } catch (error) {
      console.error('Errore AI:', error);
      toast.error('Errore nel caricamento assistenza AI');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <AppHeader
        title="🎯 LAPA Centralino AI Pro"
        subtitle="Sistema intelligente per gestione chiamate e clienti"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Panel - Client Search */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Search Section */}
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold">Ricerca Cliente</h2>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca per nome, telefono, email..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Client Results */}
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Risultati ({clients.length})
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clients.map((client) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedClient?.id === client.id
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    }`}
                    onClick={() => selectClient(client)}
                  >
                    <div className="font-semibold text-gray-900">{client.name}</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {client.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </div>
                      )}
                      {client.mobile && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.mobile}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </div>
                      )}
                      {client.total_invoiced && (
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="w-3 h-3" />
                          €{client.total_invoiced.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {searchQuery.length >= 2 && clients.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nessun cliente trovato</p>
                  </div>
                )}

                {searchQuery.length < 2 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Inserisci almeno 2 caratteri per la ricerca</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right Panel - Client Details & Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {selectedClient ? (
              <>
                {/* Client Details */}
                <div className="glass p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Star className="w-6 h-6 text-yellow-500" />
                      Cliente Selezionato
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedClient.name}</h3>
                      {(selectedClient.street || selectedClient.city) && (
                        <div className="flex items-center gap-1 text-gray-600 mt-1">
                          <MapPin className="w-4 h-4" />
                          {selectedClient.street}{selectedClient.city && `, ${selectedClient.city}`}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedClient.phone && (
                        <button
                          onClick={() => makeCall(selectedClient.phone!)}
                          className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <PhoneCall className="w-5 h-5" />
                          Chiama Fisso
                        </button>
                      )}

                      {selectedClient.mobile && (
                        <button
                          onClick={() => makeCall(selectedClient.mobile!)}
                          className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Phone className="w-5 h-5" />
                          Chiama Mobile
                        </button>
                      )}

                      {selectedClient.email && (
                        <button
                          onClick={() => window.open(`mailto:${selectedClient.email}`)}
                          className="flex items-center justify-center gap-2 bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          <Mail className="w-5 h-5" />
                          Invia Email
                        </button>
                      )}

                      <button
                        onClick={() => getAIAssistance(selectedClient)}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        <Bot className="w-5 h-5" />
                        {isLoading ? 'Caricamento...' : 'AI Assistant'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Response */}
                {aiResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-xl"
                  >
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Bot className="w-5 h-5 text-purple-600" />
                      Assistenza AI
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {aiResponse}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="glass p-6 rounded-xl">
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">
                    Seleziona un cliente
                  </h3>
                  <p className="text-gray-500">
                    Cerca e seleziona un cliente per vedere i dettagli e le azioni disponibili
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="glass p-4 rounded-lg text-center">
            <Search className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="font-semibold">Ricerche Oggi</div>
            <div className="text-2xl font-bold text-blue-600">-</div>
          </div>

          <div className="glass p-4 rounded-lg text-center">
            <PhoneCall className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="font-semibold">Chiamate Oggi</div>
            <div className="text-2xl font-bold text-green-600">-</div>
          </div>

          <div className="glass p-4 rounded-lg text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-orange-600" />
            <div className="font-semibold">Clienti Contattati</div>
            <div className="text-2xl font-bold text-orange-600">-</div>
          </div>

          <div className="glass p-4 rounded-lg text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="font-semibold">Tempo Medio</div>
            <div className="text-2xl font-bold text-purple-600">-</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}