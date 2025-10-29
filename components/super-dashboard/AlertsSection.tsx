'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, CheckSquare, Sparkles } from 'lucide-react';
import { mockCriticalAlerts, mockRecommendations, mockPriorities } from '@/lib/super-dashboard/mockData';

export function AlertsSection() {
  const criticalAlerts = mockCriticalAlerts;
  const recommendations = mockRecommendations;
  const priorities = mockPriorities;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600/20 border-red-600/50';
      case 'high': return 'bg-orange-600/20 border-orange-600/50';
      case 'medium': return 'bg-yellow-600/20 border-yellow-600/50';
      default: return 'bg-slate-600/20 border-slate-600/50';
    }
  };

  const getActionColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600 hover:bg-red-700';
      case 'high': return 'bg-orange-600 hover:bg-orange-700';
      case 'medium': return 'bg-yellow-600 hover:bg-yellow-700';
      default: return 'bg-slate-600 hover:bg-slate-700';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl h-full"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">🚨</span>
          Alerts & Actions
        </h2>
        <p className="text-slate-400 text-sm">
          Azioni critiche e raccomandazioni AI
        </p>
      </div>

      {/* Critical Alerts */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-base font-semibold text-white">Critical Alerts</h3>
        </div>

        <div className="space-y-2">
          {criticalAlerts.map((alert, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`${getPriorityColor(alert.priority)} border rounded-lg p-3`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg">{alert.icon}</span>
                <div className="flex-1">
                  <div className="text-white font-medium text-sm">{alert.alert}</div>
                  <div className="text-slate-300 text-xs mt-1">{alert.affected}</div>
                </div>
              </div>
              <button className={`${getActionColor(alert.priority)} text-white px-3 py-1 rounded text-xs font-semibold w-full`}>
                {alert.action}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pending Recommendations */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-semibold text-white">AI Recommendations</h3>
        </div>

        <div className="space-y-2">
          {recommendations.map((rec, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-400 font-semibold text-xs px-2 py-1 bg-purple-600/20 rounded">
                  {rec.type}
                </span>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-xs font-bold">{rec.confidence}%</span>
                </div>
              </div>
              <div className="text-white text-sm mb-1">{rec.description}</div>
              <div className="text-slate-400 text-xs mb-2">{rec.customer}</div>
              <div className="flex gap-2">
                <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold flex-1">
                  ACCEPT
                </button>
                <button className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs font-semibold">
                  REVIEW
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Today's Priorities */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-semibold text-white">Today's Priorities</h3>
        </div>

        <div className="space-y-2">
          {priorities.map((priority, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.05 }}
              className="flex items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-300 flex-1">{priority}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
