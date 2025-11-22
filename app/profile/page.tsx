'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/store/authStore';
import { UserRole } from '@/lib/types';
import { User, Mail, Shield, Calendar, Edit2, Save, X, Settings, Camera, Upload, Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppHeader, MobileHomeButton } from '@/components/layout/AppHeader';
import toast, { Toaster } from 'react-hot-toast';

interface OdooContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  image_128?: string;
  is_company?: boolean;
}

export default function ProfilePage() {
  const { user, logout, updateProfile, isLoading } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [odooContact, setOdooContact] = useState<OdooContact | null>(null);
  const [loadingOdoo, setLoadingOdoo] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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

  // Carica contatto Odoo
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    // Carica dati locali
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

    // Carica contatto Odoo
    const loadOdooContact = async () => {
      try {
        const res = await fetch(`/api/time-attendance/contact?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (data.success && data.data?.contact) {
          setOdooContact(data.data.contact);
          // Aggiorna form con dati Odoo
          setFormData(prev => ({
            ...prev,
            name: data.data.contact.name || prev.name,
            email: data.data.contact.email || prev.email,
            telefono: data.data.contact.phone || prev.telefono,
          }));
        }
      } catch (error) {
        console.error('Error loading Odoo contact:', error);
      } finally {
        setLoadingOdoo(false);
      }
    };

    loadOdooContact();
  }, [user, router]);

  // Gestione upload immagine
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verifica tipo file
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine');
      return;
    }

    // Verifica dimensione (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Immagine troppo grande (max 5MB)');
      return;
    }

    // Crea preview e converti in base64
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Salva su Odoo
  const handleSaveOdoo = async () => {
    if (!odooContact) {
      toast.error('Contatto Odoo non trovato');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: odooContact.id,
          name: formData.name,
          email: formData.email,
          phone: formData.telefono,
          image_base64: previewImage || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Profilo aggiornato!');
        setOdooContact(data.data.contact);
        setPreviewImage(null);
        setIsEditing(false);
      } else {
        toast.error(data.error || 'Errore aggiornamento');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Errore di connessione');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Se abbiamo un contatto Odoo, salva lì
      if (odooContact) {
        await handleSaveOdoo();
      }

      // Salva anche localmente se c'è una password o altri dati locali
      if (formData.password.trim() || !odooContact) {
        const updateData = {
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
          ...(user?.role === 'admin' ? {
            role: formData.role,
            abilitato: formData.abilitato,
            appPermessi: formData.appPermessi,
          } : {}),
          ...(formData.password.trim() ? { password: formData.password } : {}),
        };

        await updateProfile(updateData);
        setFormData({ ...formData, password: '' }); // Reset password field
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Errore nel salvataggio');
    } finally {
      setIsSaving(false);
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

  // Determina l'immagine da mostrare (preview > odoo > iniziale)
  const displayImage = previewImage || (odooContact?.image_128 ? `data:image/png;base64,${odooContact.image_128}` : null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Toaster position="top-center" />

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
            <div className="relative group">
              {/* Avatar con immagine o iniziale */}
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={formData.name}
                  className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-white/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  {formData.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}

              {/* Overlay per upload (visibile in editing) */}
              {isEditing && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 w-24 h-24 rounded-full bg-black/60 flex flex-col items-center justify-center cursor-pointer hover:bg-black/70 transition-colors"
                >
                  <Camera className="w-6 h-6 text-white mb-1" />
                  <span className="text-xs text-white">Cambia</span>
                </motion.button>
              )}

              {/* Input file nascosto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* Badge ruolo */}
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
                  disabled={isSaving || isLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Salvando...' : 'Salva Modifiche'}
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