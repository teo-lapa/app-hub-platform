'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { MobileNavigation } from '@/components/mobile/MobileNavigation';

export default function AdminPage() {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.push('/auth');
      return;
    }

    if (!isLoading && user && user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="pwa-fullscreen flex flex-col">
      {/* Mobile Header - shown only on mobile */}
      <div className="md:hidden">
        <MobileHeader
          title="Admin Panel"
          showBackButton={true}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 container-mobile md:max-w-7xl md:mx-auto md:px-4 md:sm:px-6 md:lg:px-8 py-4 md:py-8 pb-20 md:pb-8">
        <AdminDashboard />
      </main>

      {/* Mobile Navigation - shown only on mobile */}
      <div className="md:hidden">
        <MobileNavigation />
      </div>
    </div>
  );
}