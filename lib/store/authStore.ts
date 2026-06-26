import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthState, User, ApiResponse } from '@/lib/types';
import toast from 'react-hot-toast';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    console.log('🔄 AuthStore: Starting login process for:', email);

    try {
      // Autenticazione con la piattaforma
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ CRITICAL: Permette al browser di salvare i cookie!
        body: JSON.stringify({ email, password }),
      });

      console.log('🌐 AuthStore: Login response status:', response.status);
      const data: ApiResponse<{ user: User; token: string }> = await response.json();
      console.log('📋 AuthStore: Login response data:', { success: data.success, user: data.data?.user?.name, error: data.error });

      if (data.success) {
        set({
          user: data.data?.user || null,
          isAuthenticated: true,
          isLoading: false,
          token: data.data?.token || null,
        });
        // Salva le credenziali per il ri-login automatico quando Odoo 19 stacca la
        // sessione (vedi SessionKeeper): così l'app resta sul TUO account e non cade
        // mai sull'account di servizio. App interna su dispositivi aziendali.
        try {
          localStorage.setItem('lapa-cred', btoa(encodeURIComponent(JSON.stringify({ email, password }))));
        } catch {}
        console.log('✅ AuthStore: Login successful, user authenticated:', data.data?.user?.name);
        toast.success(data.message || 'Login effettuato con successo!');
      } else {
        set({ isLoading: false });
        console.log('❌ AuthStore: Login failed:', data.error);
        toast.error(data.error || 'Errore durante il login');
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      set({ isLoading: false });
      console.error('💥 AuthStore: Login error:', error);
      throw error;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data: ApiResponse<{ user: User; token: string }> = await response.json();

      if (data.success) {
        set({
          user: data.data?.user || null,
          isAuthenticated: true,
          isLoading: false,
        });
        toast.success(data.message || 'Registrazione completata con successo!');
      } else {
        set({ isLoading: false });
        toast.error(data.error || 'Errore durante la registrazione');
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      set({ isLoading: false });
      console.error('Registration error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      // Pulisce subito lo stato locale anche se l'API fallisce
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null,
      });
      // Rimuovi le credenziali salvate per il ri-login automatico
      try { localStorage.removeItem('lapa-cred'); } catch {}

      // Prova a chiamare l'API di logout
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Logout effettuato con successo!');
      } else {
        console.warn('Logout API failed, but local state cleared');
        toast.success('Logout completato');
      }

      // Reindirizza alla home page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Anche se c'è un errore, mantieni lo stato pulito
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null,
      });
      toast.success('Logout completato');

      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  },

  updateProfile: async (data: { name: string; email: string; password?: string }) => {
    set({ isLoading: true });
    try {
      const { token } = get();
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<{ user: User }> = await response.json();

      if (result.success && result.data?.user) {
        set({
          user: result.data.user,
          isLoading: false,
        });
        toast.success('Profilo aggiornato con successo!');
      } else {
        set({ isLoading: false });
        toast.error(result.error || 'Errore durante l\'aggiornamento del profilo');
        throw new Error(result.error || 'Update failed');
      }
    } catch (error) {
      set({ isLoading: false });
      console.error('Profile update error:', error);
      throw error;
    }
  },

  checkAuth: async () => {
    console.log('🔍 [AuthStore] Controllo autenticazione in corso...');
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // ✅ IMPORTANTE: Include i cookie!
      });

      console.log('🌐 [AuthStore] Response /api/auth/me:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [AuthStore] Errore HTTP da /api/auth/me:', {
          status: response.status,
          error: errorData.error
        });
        throw new Error(`HTTP ${response.status}: ${errorData.error}`);
      }

      const data: ApiResponse<{ user: User }> = await response.json();
      console.log('📋 [AuthStore] Dati ricevuti da /api/auth/me:', {
        success: data.success,
        hasUser: !!data.data?.user,
        userEmail: data.data?.user?.email
      });

      if (data.success && data.data?.user) {
        console.log('✅ [AuthStore] Autenticazione confermata per:', data.data.user.email);
        set({
          user: data.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        console.warn('⚠️ [AuthStore] Risposta ricevuta ma senza utente - resetto stato');
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          token: null,
        });
      }
    } catch (error: any) {
      const msg = error?.message || '';
      // Errore di RETE/timeout (tablet, wifi ballerino): NON buttare fuori l'utente,
      // mantieni la sessione persistita. Disconnetti solo su token davvero non valido (HTTP).
      if (!msg.startsWith('HTTP ')) {
        console.warn('🌐 [AuthStore] checkAuth: errore di rete, mantengo la sessione:', msg);
        set({ isLoading: false });
        return;
      }
      console.error('💥 [AuthStore] checkAuth: token non valido, disconnessione:', msg);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null,
      });
    }
  },

  // Funzioni admin
  getAllUsers: async () => {
    const { token } = get();
    if (!token) {
      throw new Error('Token non disponibile');
    }

    const response = await fetch('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data: ApiResponse<{ users: User[] }> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Errore nel recupero utenti');
    }

    return data.data?.users || [];
  },

  createUserAsAdmin: async (userData: any) => {
    const { token } = get();
    if (!token) {
      throw new Error('Token non disponibile');
    }

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    const data: ApiResponse<{ user: User }> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Errore nella creazione utente');
    }

    toast.success(data.message || 'Utente creato con successo!');
    return data.data?.user!;
  },

  updateUserAsAdmin: async (id: string, updates: any) => {
    const { token } = get();
    if (!token) {
      throw new Error('Token non disponibile');
    }

    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const data: ApiResponse<{ user: User }> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Errore nell\'aggiornamento utente');
    }

    toast.success(data.message || 'Utente aggiornato con successo!');
    return data.data?.user!;
  },

  deleteUserAsAdmin: async (id: string) => {
    const { token } = get();
    if (!token) {
      throw new Error('Token non disponibile');
    }

    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Errore nell\'eliminazione utente');
    }

    toast.success(data.message || 'Utente eliminato con successo!');
  },
    }),
    {
      name: 'lapa-auth-storage', // nome univoco per localStorage
      storage: createJSONStorage(() => localStorage), // persiste in localStorage
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        // NON persistere isLoading (sempre false all'avvio)
      }),
    }
  )
);