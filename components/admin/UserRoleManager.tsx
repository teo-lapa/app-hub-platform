'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Crown, Settings, Edit, Save, X, Plus } from 'lucide-react';

interface UserRole {
  id: string;
  name: string;
  role: 'visitor' | 'free_user' | 'pro_user' | 'admin' | 'owner' | 'employee' | 'client';
  email: string;
  department?: string;
  permissions: string[];
  avatar?: string;
  status: 'active' | 'inactive' | 'pending';
  lastActive: string;
}

interface RoleConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: typeof User;
  permissions: string[];
  maxUsers?: number;
}

const roleConfigs: RoleConfig[] = [
  {
    id: 'owner',
    name: 'Proprietario',
    description: 'Accesso completo a tutte le funzionalità',
    color: 'text-red-500 bg-red-100 dark:bg-red-900/20',
    icon: Crown,
    permissions: ['*'],
    maxUsers: 1,
  },
  {
    id: 'admin',
    name: 'Amministratore',
    description: 'Gestione utenti e configurazioni',
    color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/20',
    icon: Shield,
    permissions: ['user_management', 'app_management', 'system_config'],
  },
  {
    id: 'employee',
    name: 'Dipendente',
    description: 'Staff LAPA - lavoro e svago',
    color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20',
    icon: User,
    permissions: ['work_apps', 'reports', 'client_data', 'entertainment_apps'],
  },
  {
    id: 'client',
    name: 'Cliente Ristorante',
    description: 'Ristoratori che ordinano prodotti',
    color: 'text-green-500 bg-green-100 dark:bg-green-900/20',
    icon: User,
    permissions: ['catalog_view', 'place_orders', 'order_history'],
  },
  {
    id: 'pro_user',
    name: 'Utente Pro',
    description: 'Accesso alle app premium',
    color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/20',
    icon: Settings,
    permissions: ['premium_apps', 'advanced_features'],
  },
  {
    id: 'free_user',
    name: 'Utente Free',
    description: 'Accesso base alle app',
    color: 'text-gray-500 bg-gray-100 dark:bg-gray-900/20',
    icon: User,
    permissions: ['basic_apps'],
  },
];

// Mock data for demo
const mockUsers: UserRole[] = [
  {
    id: '1',
    name: 'Mario Rossi',
    role: 'owner',
    email: 'mario@lapa.com',
    department: 'Direzione LAPA',
    permissions: ['*'],
    status: 'active',
    lastActive: '2 minuti fa',
  },
  {
    id: '2',
    name: 'Luca Verdi',
    role: 'admin',
    email: 'luca@lapa.com',
    department: 'IT',
    permissions: ['user_management', 'app_management'],
    status: 'active',
    lastActive: '10 minuti fa',
  },
  {
    id: '3',
    name: 'Anna Bianchi',
    role: 'employee',
    email: 'anna@lapa.com',
    department: 'Vendite & Logistica',
    permissions: ['work_apps', 'client_data', 'entertainment_apps'],
    status: 'active',
    lastActive: '1 ora fa',
  },
  {
    id: '4',
    name: 'Ristorante Da Vinci',
    role: 'client',
    email: 'ordini@ristorantedavinci.it',
    department: 'Cliente - Ristorante',
    permissions: ['catalog_view', 'place_orders', 'order_history'],
    status: 'active',
    lastActive: '2 ore fa',
  },
];

export function UserRoleManager() {
  const [users, setUsers] = useState<UserRole[]>(mockUsers);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showAddUser, setShowAddUser] = useState(false);

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? {
              ...user,
              role: newRole as any,
              permissions: roleConfigs.find(r => r.id === newRole)?.permissions || []
            }
          : user
      )
    );
    setEditingUser(null);
  };

  const getRoleConfig = (roleId: string) => {
    return roleConfigs.find(r => r.id === roleId) || roleConfigs[roleConfigs.length - 1];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-100 dark:bg-green-900/20';
      case 'inactive':
        return 'text-gray-500 bg-gray-100 dark:bg-gray-900/20';
      case 'pending':
        return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20';
      default:
        return 'text-gray-500 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestione Ruoli Utente</h2>
          <p className="text-muted-foreground mt-1">
            Gestisci clienti ristoranti, dipendenti e utenti della piattaforma LAPA
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddUser(true)}
          className="glass-strong px-4 py-2 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Utente
        </motion.button>
      </div>

      {/* Role Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {roleConfigs.map((roleConfig) => {
          const count = users.filter(u => u.role === roleConfig.id).length;
          const Icon = roleConfig.icon;

          return (
            <motion.div
              key={roleConfig.id}
              whileHover={{ y: -2 }}
              className="mobile-card p-4 text-center"
            >
              <div className={`w-12 h-12 rounded-xl ${roleConfig.color} flex items-center justify-center mx-auto mb-2`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm">{roleConfig.name}</h3>
              <p className="text-2xl font-bold text-blue-500 mt-1">{count}</p>
              {roleConfig.maxUsers && (
                <p className="text-xs text-muted-foreground">
                  max {roleConfig.maxUsers}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Users List */}
      <div className="mobile-card p-6">
        <h3 className="font-semibold text-lg mb-4">Utenti Registrati</h3>

        <div className="space-y-4">
          {users.map((user, index) => {
            const roleConfig = getRoleConfig(user.role);
            const Icon = roleConfig.icon;
            const isEditing = editingUser === user.id;

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 glass rounded-xl hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-xl ${roleConfig.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{user.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.department && (
                      <p className="text-xs text-muted-foreground">
                        {user.department} • Ultimo accesso: {user.lastActive}
                      </p>
                    )}
                  </div>

                  {/* Role Badge */}
                  <div className="hidden md:block">
                    {isEditing ? (
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="bg-transparent border border-white/20 rounded-lg px-3 py-1 text-sm"
                        autoFocus
                      >
                        <option value="">Seleziona ruolo</option>
                        {roleConfigs.map((role) => (
                          <option key={role.id} value={role.id} className="bg-gray-800">
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleConfig.color}`}>
                        {roleConfig.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (selectedRole) {
                            handleRoleChange(user.id, selectedRole);
                          }
                        }}
                        className="p-2 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors"
                        disabled={!selectedRole}
                      >
                        <Save className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setEditingUser(null);
                          setSelectedRole('');
                        }}
                        className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setEditingUser(user.id);
                        setSelectedRole(user.role);
                      }}
                      disabled={user.role === 'owner'} // Can't edit owner
                      className={`p-2 rounded-lg transition-colors ${
                        user.role === 'owner'
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-blue-500 hover:bg-blue-500/20'
                      }`}
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Role Permissions Legend */}
      <div className="mobile-card p-6">
        <h3 className="font-semibold text-lg mb-4">Autorizzazioni per Ruolo</h3>

        <div className="space-y-4">
          {roleConfigs.map((roleConfig) => {
            const Icon = roleConfig.icon;

            return (
              <div key={roleConfig.id} className="flex items-start gap-4 p-4 glass rounded-xl">
                <div className={`w-10 h-10 rounded-lg ${roleConfig.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{roleConfig.name}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{roleConfig.description}</p>

                  <div className="flex flex-wrap gap-1">
                    {roleConfig.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                      >
                        {permission === '*' ? 'Tutte le autorizzazioni' : permission}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}