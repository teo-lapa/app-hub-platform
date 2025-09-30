'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store/authStore';
import { UserRole } from '@/lib/types';
import { User, Mail, Shield, Calendar, Edit2, Save, X, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';

export default function ProfilePage() {
  const { user, logout, updateProfile, isLoading } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    telefono: '',
    azienda: '',
    indirizzo: '',
    citta: '',
    cap: '',
    partitaIva: '',
    codiceCliente: '',
    note: '',
    role: 'cliente_gratuito' as UserRole,
    abilitato: true,
    appPermessi: [] as string[],
  });

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      telefono: user.telefono || '',
      azienda: user.azienda || '',
      indirizzo: user.indirizzo || '',
      citta: user.citta || '',
      cap: user.cap || '',
      partitaIva: user.partitaIva || '',
      codiceCliente: user.codiceCliente || '',
      note: user.note || '',
      role: user.role,
      abilitato: user.abilitato,
      appPermessi: user.appPermessi || [],
    });
  }, [user, router]);

  const handleSave = async () => {
    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        telefono: formData.telefono,
        azienda: formData.azienda,
        indirizzo: formData.indirizzo,
        citta: formData.citta,
        cap: formData.cap,
        partitaIva: formData.partitaIva,
        codiceCliente: formData.codiceCliente,
        note: formData.note,
      };

      // Solo admin può modificare ruolo e permessi
      if (user?.role === 'admin') {
        updateData.role = formData.role;
        updateData.abilitato = formData.abilitato;
        updateData.appPermessi = formData.appPermessi;
      }

      // Solo se la password è stata inserita
      if (formData.password.trim()) {
        updateData.password = formData.password;
      }

      await updateProfile(updateData);
      setIsEditing(false);
      setFormData({ ...formData, password: '' }); // Reset password field
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        telefono: user.telefono || '',
        azienda: user.azienda || '',
        indirizzo: user.indirizzo || '',
        citta: user.citta || '',
        cap: user.cap || '',
        partitaIva: user.partitaIva || '',
        codiceCliente: user.codiceCliente || '',
        note: user.note || '',
        role: user.role,
        abilitato: user.abilitato,
        appPermessi: user.appPermessi || [],
      });
    }
    setIsEditing(false);
  };

  if (!user) {
    return null;
  }

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      'visitor': 'Visitatore',
      'cliente_gratuito': 'Cliente Gratuito',
      'cliente_premium': 'Cliente Premium',
      'dipendente': 'Dipendente',
      'admin': 'Amministratore'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getRoleColor = (role: string) => {
    const colorMap = {
      'visitor': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      'cliente_gratuito': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'cliente_premium': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'dipendente': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'admin': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    return colorMap[role as keyof typeof colorMap] || colorMap.visitor;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <AppHeader
        title="Il Mio Profilo"
        subtitle="Gestisci le informazioni del tuo account"
        icon={<User className="h-8 w-8 text-white" />}
        showHomeButton={true}
        showBackButton={false}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-8 border border-white/20"
        >
          {/* Avatar e Info Base */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className={`absolute -bottom-1 -right-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                {getRoleDisplay(user.role)}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.name}
                </h2>
                {!isEditing && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </motion.button>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Form di Modifica */}
          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Il tuo nome"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="La tua email"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nuova Password (opzionale)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Lascia vuoto per non modificare"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Salvando...' : 'Salva Modifiche'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCancel}
                  className="px-6 py-3 glass-strong border border-white/20 hover:bg-white/10 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Annulla
                </motion.button>
              </div>
            </motion.div>
          ) : (
            /* Informazioni Account */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Nome Completo</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400">{user.name}</p>
              </div>

              <div className="glass p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Email</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
              </div>

              <div className="glass p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Ruolo</h3>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(user.role)}`}>
                  {getRoleDisplay(user.role)}
                </span>
              </div>

              <div className="glass p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Membro dal</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString('it-IT', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Azioni */}
          <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
            {/* Pulsante Gestione Visibilità (solo per paul@lapa.ch) */}
            {user.email === 'paul@lapa.ch' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/gestione-visibilita-app')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all"
              >
                <Settings className="w-5 h-5" />
                Gestione Visibilità App
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={logout}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
            >
              Logout
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Mobile Home Button */}
      <MobileHomeButton />
    </div>
  );
}