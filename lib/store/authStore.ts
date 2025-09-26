import { create } from 'zustand';
import { AuthState, User, ApiResponse } from '@/lib/types';
import toast from 'react-hot-toast';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    console.log('🔄 AuthStore: Starting login process for:', email);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        });
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
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      toast.success('Logout effettuato con successo!');

      // Reindirizza alla home page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Errore durante il logout');
    }
  },

  updateProfile: async (data: { name: string; email: string; password?: string }) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/me');
      const data: ApiResponse<{ user: User }> = await response.json();

      if (data.success && data.data?.user) {
        set({
          user: data.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));