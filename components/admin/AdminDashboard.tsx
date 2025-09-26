'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Settings,
  BarChart3,
  Shield,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { UserRoleManager } from './UserRoleManager';

interface AdminSection {
  id: string;
  name: string;
  icon: typeof Users;
  description: string;
  component?: React.ComponentType;
}

const adminSections: AdminSection[] = [
  {
    id: 'users',
    name: 'Gestione Utenti',
    icon: Users,
    description: 'Gestisci utenti, ruoli e permessi',
    component: UserRoleManager,
  },
  {
    id: 'apps',
    name: 'Gestione App',
    icon: Settings,
    description: 'Configura e gestisci le applicazioni',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: BarChart3,
    description: 'Visualizza statistiche e report',
  },
  {
    id: 'security',
    name: 'Sicurezza',
    icon: Shield,
    description: 'Configurazioni di sicurezza e log',
  },
  {
    id: 'database',
    name: 'Database',
    icon: Database,
    description: 'Gestione database e backup',
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: Activity,
    description: 'Monitoraggio sistema e performance',
  },
];

// Mock data for dashboard stats
const dashboardStats = [
  {
    title: 'Utenti Totali',
    value: '1,234',
    change: '+12%',
    changeType: 'positive' as const,
    icon: Users,
  },
  {
    title: 'App Attive',
    value: '8',
    change: '+1',
    changeType: 'positive' as const,
    icon: Settings,
  },
  {
    title: 'Sessioni Oggi',
    value: '456',
    change: '+8%',
    changeType: 'positive' as const,
    icon: Activity,
  },
  {
    title: 'Issues Aperti',
    value: '3',
    change: '-2',
    changeType: 'negative' as const,
    icon: AlertTriangle,
  },
];

const recentActivities = [
  {
    id: '1',
    action: 'Nuovo utente registrato',
    user: 'Mario Rossi',
    timestamp: '2 minuti fa',
    type: 'user' as const,
  },
  {
    id: '2',
    action: 'App Menu aggiornata',
    user: 'Sistema',
    timestamp: '15 minuti fa',
    type: 'app' as const,
  },
  {
    id: '3',
    action: 'Backup completato',
    user: 'Sistema',
    timestamp: '1 ora fa',
    type: 'system' as const,
  },
  {
    id: '4',
    action: 'Ruolo utente modificato',
    user: 'Admin',
    timestamp: '2 ore fa',
    type: 'security' as const,
  },
];

export function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<string>('overview');

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user':
        return Users;
      case 'app':
        return Settings;
      case 'system':
        return Activity;
      case 'security':
        return Shield;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'text-blue-500 bg-blue-100 dark:bg-blue-900/20';
      case 'app':
        return 'text-green-500 bg-green-100 dark:bg-green-900/20';
      case 'system':
        return 'text-purple-500 bg-purple-100 dark:bg-purple-900/20';
      case 'security':
        return 'text-orange-500 bg-orange-100 dark:bg-orange-900/20';
      default:
        return 'text-gray-500 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  if (activeSection !== 'overview') {
    const section = adminSections.find(s => s.id === activeSection);
    if (section?.component) {
      const Component = section.component;
      return (
        <div className="space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => setActiveSection('overview')}
              className="hover:text-foreground transition-colors"
            >
              Dashboard Admin
            </button>
            <span>•</span>
            <span className="text-foreground">{section.name}</span>
          </div>

          <Component />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Amministratore</h1>
        <p className="text-muted-foreground mt-1">
          Benvenuto nel pannello di controllo amministrativo
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="mobile-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stat.change}
                </span>
              </div>

              <h3 className="text-2xl font-bold mb-1">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Admin Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section, index) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveSection(section.id)}
              className="mobile-card p-6 cursor-pointer group hover:border-blue-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 flex items-center justify-center group-hover:from-blue-500 group-hover:to-purple-600 transition-all duration-300">
                  <Icon className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors duration-300" />
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-lg group-hover:text-blue-500 transition-colors">
                    {section.name}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{section.description}</p>

              {/* Progress indicator */}
              <div className="mt-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-0 group-hover:w-full transition-all duration-700 ease-out" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="mobile-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Attività Recente</h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            Visualizza tutto
          </motion.button>
        </div>

        <div className="space-y-4">
          {recentActivities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type);
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 dark:hover:bg-black/5 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg ${getActivityColor(activity.type)} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1">
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">
                    da {activity.user} • {activity.timestamp}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="mobile-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <h3 className="font-semibold">Stato Sistema</h3>
          </div>
          <p className="text-sm text-muted-foreground">Tutti i servizi operativi</p>
        </div>

        <div className="mobile-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <h3 className="font-semibold">Database</h3>
          </div>
          <p className="text-sm text-muted-foreground">Ultimo backup: 2 ore fa</p>
        </div>

        <div className="mobile-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <h3 className="font-semibold">Performance</h3>
          </div>
          <p className="text-sm text-muted-foreground">CPU: 45% • RAM: 62%</p>
        </div>
      </div>
    </div>
  );
}