'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/store/authStore';
import { useAppStore } from '@/lib/store/appStore';
import { Header } from '@/components/layout/Header';
// import { CategoryFilter } from '@/components/layout/CategoryFilter';
import { AppGrid } from '@/components/layout/AppGrid';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { UpgradeModal } from '@/components/ui/UpgradeModal';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { InstallButton } from '@/components/ui/InstallButton';
import JokeBanner from './components/JokeBanner';

export default function HomePage() {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { loadUserFavorites } = useAppStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Carica i preferiti quando l'utente è autenticato
  useEffect(() => {
    if (user?.id || user?.email) {
      const userId = user.id || user.email;
      loadUserFavorites(userId);
    }
  }, [user, loadUserFavorites]);

  // Ricarica dati solo quando l'app torna visibile dopo essere stata nascosta
  // (evita reload eccessivi che interferiscono con la navigazione)
  useEffect(() => {
    let wasHidden = false;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // L'app è stata nascosta (es. cambio tab)
        wasHidden = true;
      } else if (wasHidden) {
        // L'app torna visibile DOPO essere stata nascosta
        console.log('🔄 App tornata visibile dopo essere stata nascosta, ricaricando dati utente...');
        checkAuth();
        wasHidden = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAuth]);

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkAuth();
      // Simulate additional refresh operations
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsRefreshing(false);
    }
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
      <div className="min-h-screen relative overflow-x-hidden">
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
                    Benvenuto in{' '}
                    <span className="text-red-600 dark:text-red-400">
                      LAPA
                    </span>
                    <br />
                    <span className="text-4xl text-muted-foreground">
                      Fornitore per Ristoranti
                    </span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl text-muted-foreground mt-6 max-w-lg leading-relaxed"
                  >
                    La piattaforma completa per il tuo business di fornitura alimentare.
                    Gestisci ordini dei ristoranti, catalogo prodotti, clienti e dipendenti.
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
                    { icon: '📦', text: 'Catalogo prodotti' },
                    { icon: '🛒', text: 'Ordini ristoranti' },
                    { icon: '👥', text: 'Gestione clienti' },
                    { icon: '📊', text: 'Analytics vendite' },
                  ].map((feature, index) => (
                    <motion.div
                      key={feature.text}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className="glass-strong p-4 rounded-xl border border-white/20 text-center hover:border-red-500/30 transition-colors"
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
    <div className="min-h-screen min-h-[100dvh] flex flex-col overflow-x-hidden">
      {/* Mobile Header - shown only on mobile */}
      <div className="md:hidden flex-shrink-0">
        <MobileHeader
          title={user?.name ? `Ciao, ${user.name.split(' ')[0]}!` : undefined}
          showLogo={true}
        />
      </div>

      {/* Desktop Header - hidden on mobile */}
      <div className="hidden md:block flex-shrink-0">
        <Header />
      </div>

      {/* Main Content with Pull-to-Refresh */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
        <main className="container-mobile md:max-w-7xl md:mx-auto md:px-4 md:sm:px-6 md:lg:px-8 py-4 md:py-8 pb-20 md:pb-8 min-h-full">
          {/* Joke Banner with Food News */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 md:mb-8"
          >
            <JokeBanner
              userName={user?.name}
              userRole={user?.role?.replace('_', ' ')}
            />
          </motion.div>

          {/* <CategoryFilter /> */}
          <AppGrid />
        </main>
      </PullToRefresh>

      {/* Mobile Navigation - shown only on mobile */}
      <div className="md:hidden flex-shrink-0">
        <MobileNavigation />
      </div>

      <UpgradeModal />
      <InstallButton />
    </div>
  );
}