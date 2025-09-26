'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { Header } from '@/components/layout/Header';
import { CategoryFilter } from '@/components/layout/CategoryFilter';
import { AppGrid } from '@/components/layout/AppGrid';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { UpgradeModal } from '@/components/ui/UpgradeModal';

export default function HomePage() {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear'
            }}
            className="absolute top-20 left-10 w-32 h-32 gradient-primary rounded-full opacity-10 blur-3xl"
          />
          <motion.div
            animate={{
              rotate: [360, 0],
              scale: [1, 0.8, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'linear'
            }}
            className="absolute bottom-20 right-10 w-40 h-40 gradient-secondary rounded-full opacity-10 blur-3xl"
          />
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'linear'
            }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-purple-500 rounded-full opacity-5 blur-2xl"
          />
        </div>

        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <div className="w-full max-w-6xl flex items-center justify-center lg:justify-between gap-12">
            {/* Hero Section - Desktop Only */}
            <div className="hidden lg:block flex-1">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-8"
              >
                <div>
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-6xl font-bold leading-tight"
                  >
                    La tua{' '}
                    <span className="gradient-primary bg-clip-text text-transparent">
                      piattaforma
                    </span>
                    <br />
                    di app
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl text-muted-foreground mt-6 max-w-lg leading-relaxed"
                  >
                    Accedi a tutte le app di cui hai bisogno in un unico posto.
                    Gestisci menu, prenotazioni, AI chat e molto altro con stile.
                  </motion.p>
                </div>

                {/* Feature Preview Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="grid grid-cols-2 gap-4 max-w-lg"
                >
                  {[
                    { icon: '🍽️', text: 'Menu digitali' },
                    { icon: '📅', text: 'Prenotazioni' },
                    { icon: '🤖', text: 'AI Chat' },
                    { icon: '📊', text: 'Analytics' },
                  ].map((feature, index) => (
                    <motion.div
                      key={feature.text}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className="glass-strong p-4 rounded-xl border border-white/20 text-center hover:border-blue-500/30 transition-colors"
                    >
                      <div className="text-2xl mb-2">{feature.icon}</div>
                      <div className="text-sm font-medium">{feature.text}</div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0 }}
                  className="flex items-center gap-8 pt-8"
                >
                  <div>
                    <div className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
                      6+
                    </div>
                    <div className="text-sm text-muted-foreground">App disponibili</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold gradient-secondary bg-clip-text text-transparent">
                      100%
                    </div>
                    <div className="text-sm text-muted-foreground">Gratuito</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-400">
                      24/7
                    </div>
                    <div className="text-sm text-muted-foreground">Disponibilità</div>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            {/* Auth Forms */}
            <div className="flex-shrink-0">
              <AnimatePresence mode="wait">
                {authMode === 'login' ? (
                  <LoginForm key="login" onToggleMode={toggleAuthMode} />
                ) : (
                  <RegisterForm key="register" onToggleMode={toggleAuthMode} />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <motion.div
          animate={{
            y: [0, -10, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="absolute top-32 right-32 text-4xl opacity-20 hidden lg:block"
        >
          ✨
        </motion.div>

        <motion.div
          animate={{
            y: [0, 10, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute bottom-32 left-32 text-4xl opacity-20 hidden lg:block"
        >
          🚀
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-8 mb-8 border border-white/20 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 gradient-primary opacity-5" />
          <div className="relative z-10">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 6 }}
              className="text-4xl mb-4"
            >
              👋
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">
              Bentornato, {user?.name}!
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Esplora le tue app e scopri nuove funzionalità.
              Il tuo piano <span className="font-semibold capitalize text-blue-400">
                {user?.role.replace('_', ' ')}
              </span> ti dà accesso a molte fantastiche funzionalità.
            </p>
          </div>
        </motion.div>

        <CategoryFilter />
        <AppGrid />
      </main>
      <UpgradeModal />
    </>
  );
}