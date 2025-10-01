'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  AlertTriangle,
  Search,
  Wrench,
  HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';

interface ActionButton {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  prompt: string;
}

const actionButtons: ActionButton[] = [
  {
    id: 'order',
    title: 'Voglio Fare un Ordine',
    description: 'Effettua un nuovo ordine dal catalogo',
    icon: ShoppingCart,
    color: 'bg-green-600 hover:bg-green-700',
    prompt: 'Ciao! Sono Stella e ti aiuterò a fare il tuo ordine. Dimmi cosa stai cercando e ti mostrerò i prodotti disponibili con le offerte attive.'
  },
  {
    id: 'complaint',
    title: 'Lamentele',
    description: 'Segnala un problema o reclamo',
    icon: AlertTriangle,
    color: 'bg-red-600 hover:bg-red-700',
    prompt: 'Ciao! Mi dispiace per il disagio. Sono qui per aiutarti a risolvere il problema. Puoi spiegarmi nel dettaglio cosa è successo?'
  },
  {
    id: 'search',
    title: 'Ricerca Prodotto',
    description: 'Trova prodotti nel nostro catalogo',
    icon: Search,
    color: 'bg-blue-600 hover:bg-blue-700',
    prompt: 'Ciao! Sono Stella e ti aiuterò a trovare quello che cerchi. Dimmi il nome del prodotto o descrivimi di cosa hai bisogno.'
  },
  {
    id: 'intervention',
    title: 'Richiesta di Intervento',
    description: 'Richiedi supporto tecnico o intervento',
    icon: Wrench,
    color: 'bg-orange-600 hover:bg-orange-700',
    prompt: 'Ciao! Sono qui per organizzare il tuo intervento tecnico. Dimmi che tipo di problema hai e dove ti trovi, così posso programmare l\'assistenza.'
  },
  {
    id: 'other',
    title: 'Altre Richieste',
    description: 'Qualsiasi altra domanda o richiesta',
    icon: HelpCircle,
    color: 'bg-purple-600 hover:bg-purple-700',
    prompt: 'Ciao! Sono Stella, il tuo assistente personale. Dimmi pure di cosa hai bisogno, sono qui per aiutarti in qualsiasi modo!'
  }
];

export default function StellaAssistant() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [userProfile, setUserProfile] = useState<any>(null);

  // Load user profile with company data on mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('🔄 Caricamento profilo utente...');
        const response = await fetch('/api/user/profile');
        console.log('📡 Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('📋 Response data:', data);

          if (data.success) {
            setUserProfile(data.data);
            console.log('✅ Profilo utente caricato:', data.data);
          } else {
            console.log('⚠️ Profile API returned success: false');
          }
        } else {
          console.log('❌ Profile API response not OK:', response.status);
        }
      } catch (error) {
        console.error('❌ Errore caricamento profilo:', error);
      }
    };

    // Always try to load profile (relies on cookie auth, not Zustand state)
    loadUserProfile();
  }, []); // Empty deps - run once on mount

  // Handle action button click - Navigate to chat page
  const handleActionClick = (action: ActionButton) => {
    // Navigate to chat page with action ID as query parameter
    router.push(`/stella-assistant/chat?action=${action.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <AppHeader
        title="🌟 Stella - Assistenza Clienti AI"
        subtitle="La tua assistente personale sempre disponibile"
      />
      <MobileHomeButton />

      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Stella Avatar Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="relative inline-block">
            <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-xl">
              🌟
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Stella</h2>
          <p className="text-gray-600 text-lg">La tua assistente AI personale</p>
        </motion.div>

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-8 border-2 border-purple-200"
        >
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Ciao{userProfile?.user?.name ? ` ${userProfile.user.name}` : ''}! 👋
          </h3>
          <p className="text-gray-600">
            Sono Stella, la tua assistente personale. Come posso aiutarti oggi?
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {actionButtons.map((action) => {
            const IconComponent = action.icon;
            return (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleActionClick(action)}
                className={`${action.color} text-white p-6 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <IconComponent className="w-8 h-8" />
                  <span className="font-semibold text-lg">{action.title}</span>
                </div>
                <p className="text-sm opacity-90 text-left">{action.description}</p>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
