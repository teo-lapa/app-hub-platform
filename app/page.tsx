'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import {
  Sparkles,
  TrendingUp,
  Package,
  Truck,
  BarChart3,
  Zap,
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
  Brain,
  Rocket,
  Globe,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function LandingPage() {
  const router = useRouter();
  const { login, register, isLoading, isAuthenticated } = useAuthStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Se già autenticato, redirect a dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (authMode === 'login') {
        await login(email, password);
        router.push('/dashboard');
      } else {
        await register(email, password, name);
        router.push('/dashboard');
      }
    } catch (error) {
      // Errore già gestito da authStore con toast
    }
  };

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Intelligence',
      description: 'Assistenti AI che ottimizzano ordini, delivery e analisi vendite in tempo reale'
    },
    {
      icon: Package,
      title: 'Gestione Inventario Smart',
      description: 'Controllo magazzino intelligente con previsioni automatiche e alert'
    },
    {
      icon: Truck,
      title: 'Logistica Ottimizzata',
      description: 'Route planning AI, tracking consegne e gestione resi in un click'
    },
    {
      icon: BarChart3,
      title: 'Analytics Avanzate',
      description: 'Dashboard venditori con KPI real-time, trend e insights predittivi'
    },
    {
      icon: Zap,
      title: 'Automazione Totale',
      description: 'Workflow automatizzati per ordini, fatturazione e comunicazioni clienti'
    },
    {
      icon: Shield,
      title: 'Sicurezza Enterprise',
      description: 'Autenticazione multi-livello, crittografia dati e backup automatici'
    }
  ];

  const stats = [
    { value: '10x', label: 'Più veloce' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Supporto AI' },
    { value: '30+', label: 'App integrate' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-500/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-left"
            >
              {/* Logo/Brand */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="inline-flex items-center gap-3 mb-8 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20"
              >
                <Rocket className="w-6 h-6 text-blue-400" />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
                  LAPA Hub Platform
                </span>
              </motion.div>

              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                Il Futuro della
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                  Distribuzione Alimentare
                </span>
              </h1>

              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Piattaforma AI-powered che rivoluziona la gestione di magazzino, vendite e logistica.
                Tutto in un unico ecosistema intelligente.
              </p>

              {/* Key Benefits */}
              <div className="space-y-4 mb-8">
                {[
                  '✨ 30+ applicazioni integrate',
                  '🤖 Assistenti AI dedicati per ogni processo',
                  '📊 Analytics real-time e insights predittivi',
                  '🚀 Implementazione in 24 ore'
                ].map((benefit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center gap-3 text-slate-200"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span>{benefit}</span>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    className="text-center p-3 rounded-xl bg-white/5"
                  >
                    <div className="text-2xl md:text-3xl font-bold text-blue-400">{stat.value}</div>
                    <div className="text-xs md:text-sm text-slate-400">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: Auth Form */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                {/* Mode Toggle */}
                <div className="flex gap-2 mb-8 p-1 bg-white/5 rounded-xl">
                  <button
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      authMode === 'login'
                        ? 'bg-white text-blue-600 shadow-lg'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Accedi
                  </button>
                  <button
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      authMode === 'register'
                        ? 'bg-white text-blue-600 shadow-lg'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Registrati
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {authMode === 'register' && (
                    <div>
                      <label className="block text-sm font-medium text-white/90 mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={authMode === 'register'}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Mario Rossi"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="mario@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {authMode === 'login' ? 'Accedi Ora' : 'Crea Account'}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
                  <Lock className="w-4 h-4" />
                  <span>Connessione sicura e crittografata</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 py-20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Tutto Ciò Di Cui Hai Bisogno
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Una suite completa di strumenti AI per gestire ogni aspetto della tua distribuzione
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 md:p-8 border border-white/20 hover:border-white/40 transition-all group"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">{feature.title}</h3>
                <p className="text-sm md:text-base text-slate-300 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 shadow-2xl"
          >
            <Sparkles className="w-16 h-16 text-white mx-auto mb-6" />
            <h2 className="text-4xl font-bold text-white mb-4">
              Pronto a Trasformare il Tuo Business?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Unisciti alle aziende che hanno già rivoluzionato la loro distribuzione con LAPA Hub
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-slate-100 transition-all shadow-xl inline-flex items-center gap-2"
            >
              Inizia Subito
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>© 2025 LAPA. Tutti i diritti riservati.</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Termini</a>
              <a href="#" className="hover:text-white transition-colors">Supporto</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
