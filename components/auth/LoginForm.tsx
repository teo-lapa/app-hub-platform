'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

interface LoginFormProps {
  onToggleMode: () => void;
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 Attempting login with:', { email, password: password ? '***' : 'empty' });

    try {
      await login(email, password);
      console.log('✅ Login successful, user should be redirected');
    } catch (error) {
      console.error('❌ Login error:', error);
      // Errore gestito dal store
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="glass-strong rounded-3xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="inline-block text-4xl mb-4"
          >
            🚀
          </motion.div>
          <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
            Bentornato
          </h1>
          <p className="text-muted-foreground">
            Accedi al tuo account App Hub
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-strong pl-10 pr-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="inserisci@email.com"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-strong pl-10 pr-12 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full gradient-primary text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/25 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Accedi
              </>
            )}
          </motion.button>
        </form>

        {/* Demo Accounts */}
        <div className="mt-6 p-4 glass rounded-xl border border-blue-500/20">
          <p className="text-xs text-center text-muted-foreground mb-3">
            Account demo disponibili:
          </p>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Admin:</span>
              <span className="text-blue-400">admin@apphub.com / admin123</span>
            </div>
            <div className="flex justify-between">
              <span>PRO:</span>
              <span className="text-purple-400">pro@apphub.com / pro123</span>
            </div>
            <div className="flex justify-between">
              <span>FREE:</span>
              <span className="text-green-400">free@apphub.com / free123</span>
            </div>
          </div>
        </div>

        {/* Toggle to Register */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Non hai un account?{' '}
            <button
              onClick={onToggleMode}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Registrati
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}