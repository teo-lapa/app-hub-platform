'use client';

import { motion } from 'framer-motion';
import { RefreshCw, Download, Settings, Mail, Bell, Target, Users, FileText, Lock, Activity } from 'lucide-react';

import { mockSystemStatus } from '@/lib/super-dashboard/mockData';

export function QuickActionsSection() {
  const actions = [
    { icon: RefreshCw, label: 'SYNC ODOO NOW', color: 'from-blue-600 to-cyan-600' },
    { icon: Download, label: 'EXPORT REPORT', color: 'from-green-600 to-emerald-600' },
    { icon: Settings, label: 'SETTINGS', color: 'from-purple-600 to-pink-600' },
    { icon: Mail, label: 'EMAIL TEAM', color: 'from-orange-600 to-red-600' },
    { icon: Bell, label: 'SEND ALERTS', color: 'from-yellow-600 to-orange-600' },
    { icon: Target, label: 'RUN FORECAST', color: 'from-indigo-600 to-purple-600' },
    { icon: Users, label: 'USER MGMT', color: 'from-teal-600 to-cyan-600' },
    { icon: FileText, label: 'AUDIT LOG', color: 'from-slate-600 to-slate-700' },
    { icon: Lock, label: 'PERMISSIONS', color: 'from-red-600 to-pink-600' },
  ];

  const systemStatus = mockSystemStatus;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
      case 'running':
      case 'live':
        return '✅';
      default:
        return '⚠️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
      case 'running':
      case 'live':
        return 'text-green-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl h-full"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">⚡</span>
          Quick Actions
        </h2>
        <p className="text-slate-400 text-sm">
          Azioni rapide e system status
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6">
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`bg-gradient-to-r ${action.color} text-white rounded-lg p-3 flex items-center gap-3 font-semibold text-sm shadow-lg hover:shadow-xl transition-all group`}
            >
              <action.icon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              {action.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">System Status</h3>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
          {systemStatus.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex items-center justify-between pb-3 border-b border-slate-700/50 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStatusIcon(item.status)}</span>
                <span className="text-white font-medium text-sm">{item.service}</span>
              </div>
              <div className="text-right">
                <div className={`${getStatusColor(item.status)} font-semibold text-xs capitalize`}>
                  {item.status}
                </div>
                <div className="text-slate-500 text-xs">{item.lastUpdate}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* All Systems Operational Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 }}
          className="mt-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-600/30 rounded-lg p-3 text-center"
        >
          <div className="text-green-400 font-bold flex items-center justify-center gap-2">
            <span className="text-2xl">✅</span>
            All Systems Operational
          </div>
          <div className="text-slate-400 text-xs mt-1">
            Last check: just now
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
