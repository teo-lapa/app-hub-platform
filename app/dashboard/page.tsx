'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { useAppStore } from '@/lib/store/appStore';
import { Header } from '@/components/layout/Header';
// import { CategoryFilter } from '@/components/layout/CategoryFilter';
import { AppGrid } from '@/components/layout/AppGrid';
import { UpgradeModal } from '@/components/ui/UpgradeModal';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { InstallButton } from '@/components/ui/InstallButton';
import JokeBanner from '../components/JokeBanner';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { loadUserFavorites, loadAppsForUser } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Carica le app filtrate e i preferiti quando l'utente è autenticato
  useEffect(() => {
    if (user?.id || user?.email) {
      const userId = user.id || user.email;
      const userRole = user.role;
      const userEmail = user.email; // USA EMAIL per filtrare le app

      console.log('🔄 Loading apps for user:', { userId, userRole, userEmail });

      // Carica le app filtrate per questo utente (usa EMAIL)
      loadAppsForUser(userRole, userEmail);

      // Carica anche i preferiti
      loadUserFavorites(userId);
    }
  }, [user, loadUserFavorites, loadAppsForUser]);

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

  // Se non autenticato, redirect alla landing page (DEVE essere prima di qualsiasi return!)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

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

  // Loading state
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

  // Not authenticated - show loading while redirecting
  if (!isAuthenticated) {
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
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto min-h-0">
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