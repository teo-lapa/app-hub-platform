'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Check, X, Star, Crown, Zap, ArrowLeft, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  badge?: string;
  badgeColor?: string;
  features: {
    name: string;
    included: boolean;
    description?: string;
  }[];
  buttonText: string;
  buttonColor: string;
  icon: React.ReactNode;
  popular?: boolean;
  mostValue?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Piano Gratuito',
    description: 'Perfetto per iniziare ed esplorare le funzionalità base',
    price: {
      monthly: 0,
      yearly: 0
    },
    badge: 'GRATIS',
    badgeColor: 'green',
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      { name: 'Menu App', included: true, description: 'Gestione menu completa' },
      { name: 'Analytics Dashboard', included: true, description: 'Statistiche base' },
      { name: 'Task Manager', included: true, description: 'Gestione progetti semplice' },
      { name: 'Supporto community', included: true },
      { name: 'Storage 1GB', included: true },
      { name: 'Booking System', included: false },
      { name: 'AI Chat', included: false },
      { name: 'Invoice Generator', included: false },
      { name: 'Integrazione Odoo', included: false },
      { name: 'Supporto prioritario', included: false },
      { name: 'Backup automatici', included: false },
      { name: 'API avanzate', included: false }
    ],
    buttonText: 'Inizia Gratis',
    buttonColor: 'from-green-500 to-emerald-600'
  },
  {
    id: 'pro',
    name: 'Piano PRO',
    description: 'Funzionalità avanzate per far crescere il tuo business',
    price: {
      monthly: 29,
      yearly: 290 // 2 mesi gratis
    },
    badge: 'PIÙ POPOLARE',
    badgeColor: 'blue',
    icon: <Star className="w-6 h-6" />,
    popular: true,
    features: [
      { name: 'Tutte le funzionalità GRATIS', included: true },
      { name: 'Booking System', included: true, description: 'Gestione prenotazioni completa' },
      { name: 'AI Chat', included: true, description: 'Chatbot intelligente' },
      { name: 'Invoice Generator', included: true, description: 'Fatturazione automatica' },
      { name: 'Integrazione Odoo base', included: true },
      { name: 'Supporto email', included: true },
      { name: 'Storage 50GB', included: true },
      { name: 'Analytics avanzate', included: true },
      { name: 'Backup automatici', included: false },
      { name: 'Supporto prioritario 24/7', included: false },
      { name: 'API illimitate', included: false },
      { name: 'Personalizzazione completa', included: false }
    ],
    buttonText: 'Passa a PRO',
    buttonColor: 'from-blue-500 to-purple-600'
  },
  {
    id: 'enterprise',
    name: 'Piano Enterprise',
    description: 'Soluzione completa per aziende che vogliono il massimo',
    price: {
      monthly: 99,
      yearly: 990 // 2 mesi gratis
    },
    badge: 'MIGLIOR VALORE',
    badgeColor: 'purple',
    icon: <Crown className="w-6 h-6" />,
    mostValue: true,
    features: [
      { name: 'Tutte le funzionalità PRO', included: true },
      { name: 'Integrazione Odoo completa', included: true, description: 'Sincronizzazione bidirezionale' },
      { name: 'Supporto prioritario 24/7', included: true },
      { name: 'Backup automatici', included: true },
      { name: 'Storage illimitato', included: true },
      { name: 'API illimitate', included: true },
      { name: 'Personalizzazione completa', included: true },
      { name: 'Formazione dedicata', included: true },
      { name: 'Account manager', included: true },
      { name: 'SLA garantito 99.9%', included: true },
      { name: 'Whitelabel', included: true },
      { name: 'Deployment on-premise', included: true }
    ],
    buttonText: 'Contatta Vendite',
    buttonColor: 'from-purple-500 to-pink-600'
  }
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isYearly, setIsYearly] = useState(false);
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  const handleSubscribe = (tierId: string) => {
    if (tierId === 'free') {
      // Redirect to registration if not logged in, or dashboard if already free
      if (!user) {
        router.push('/?register=true');
      } else {
        router.push('/');
      }
    } else if (tierId === 'enterprise') {
      // Open contact form or redirect to contact page
      window.open('mailto:sales@apphub.com?subject=Enterprise%20Plan%20Inquiry', '_blank');
    } else {
      // Simulate payment process
      alert('Reindirizzamento al sistema di pagamento...');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/')}
            className="glass-strong p-3 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>

          <div>
            <h1 className="text-3xl font-bold">Prezzi e Piani</h1>
            <p className="text-muted-foreground mt-2">
              Scegli il piano perfetto per le tue esigenze
            </p>
          </div>
        </motion.div>
      </div>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-5xl font-bold mb-6">
            Prezzi <span className="gradient-primary bg-clip-text text-transparent">trasparenti</span>,
            <br />risultati straordinari
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Inizia gratis e scala quando cresci. Nessun costo nascosto,
            nessun lock-in, solo il software di cui hai bisogno.
          </p>

          {/* Yearly/Monthly Toggle */}
          <div className="glass-strong rounded-full p-2 inline-flex items-center gap-2 mb-12 border border-white/20">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                !isYearly
                  ? 'bg-white/20 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensile
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                isYearly
                  ? 'bg-white/20 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annuale
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                -20%
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pricingTiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className={`relative glass-strong rounded-3xl p-8 border transition-all duration-300 ${
                tier.popular
                  ? 'border-blue-500/50 shadow-xl shadow-blue-500/10 scale-105'
                  : tier.mostValue
                  ? 'border-purple-500/50 shadow-xl shadow-purple-500/10'
                  : 'border-white/20 hover:border-white/30'
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold border ${
                  tier.badgeColor === 'green'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : tier.badgeColor === 'blue'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                }`}>
                  {tier.badge}
                </div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                  tier.popular
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                    : tier.mostValue
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600'
                } text-white`}>
                  {tier.icon}
                </div>

                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{tier.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">
                      €{isYearly ? Math.round(tier.price.yearly / 12) : tier.price.monthly}
                    </span>
                    {tier.price.monthly > 0 && (
                      <span className="text-muted-foreground">/mese</span>
                    )}
                  </div>
                  {isYearly && tier.price.monthly > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Fatturati €{tier.price.yearly}/anno
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSubscribe(tier.id)}
                  className={`w-full bg-gradient-to-r ${tier.buttonColor} text-white py-4 px-6 rounded-xl font-semibold hover:shadow-lg transition-shadow flex items-center justify-center gap-2`}
                >
                  <Zap className="w-5 h-5" />
                  {tier.buttonText}
                </motion.button>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h4 className="font-semibold text-center mb-4">Cosa include:</h4>
                {tier.features.map((feature, featureIndex) => (
                  <motion.div
                    key={feature.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                    transition={{ delay: (index * 0.1) + (featureIndex * 0.05) }}
                    className="flex items-start gap-3"
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      feature.included
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-red-500/20 border border-red-500/30'
                    }`}>
                      {feature.included ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <X className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {feature.name}
                      </div>
                      {feature.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {feature.description}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ delay: 0.5 }}
          className="mt-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Domande Frequenti</h3>
            <p className="text-muted-foreground">
              Tutto quello che devi sapere sui nostri piani
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                question: "Posso cambiare piano in qualsiasi momento?",
                answer: "Sì, puoi fare upgrade o downgrade del tuo piano in qualsiasi momento. Le modifiche si rifletteranno nel prossimo ciclo di fatturazione."
              },
              {
                question: "C'è un periodo di prova per i piani a pagamento?",
                answer: "Offriamo una garanzia di rimborso di 30 giorni su tutti i piani a pagamento. Se non sei soddisfatto, ti rimborsiamo completamente."
              },
              {
                question: "Come funziona l'integrazione con Odoo?",
                answer: "L'integrazione Odoo sincronizza i tuoi dati in tempo reale. Il piano PRO include sincronizzazione base, mentre Enterprise offre sincronizzazione bidirezionale completa."
              },
              {
                question: "Posso cancellare la sottoscrizione?",
                answer: "Puoi cancellare la tua sottoscrizione in qualsiasi momento dalle impostazioni del tuo account. Non ci sono penali di cancellazione."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.6 + (index * 0.1) }}
                className="glass-strong rounded-2xl p-6 border border-white/20"
              >
                <h4 className="font-semibold mb-3">{faq.question}</h4>
                <p className="text-muted-foreground">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ delay: 0.8 }}
          className="mt-20 text-center glass-strong rounded-3xl p-12 border border-white/20 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
          <div className="relative z-10">
            <h3 className="text-3xl font-bold mb-4">
              Pronto per iniziare?
            </h3>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Unisciti a centinaia di aziende che hanno scelto App Hub per
              digitalizzare e ottimizzare i loro processi.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/')}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 px-8 rounded-xl font-semibold hover:shadow-lg transition-shadow"
              >
                Inizia Gratis
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open('mailto:sales@apphub.com', '_blank')}
                className="glass-strong py-4 px-8 rounded-xl font-semibold hover:bg-white/10 transition-colors border border-white/20"
              >
                Contatta Vendite
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}