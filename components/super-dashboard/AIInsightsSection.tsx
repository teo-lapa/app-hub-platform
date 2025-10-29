'use client';

import { motion } from 'framer-motion';
import { Brain, Zap, Target, TrendingUp } from 'lucide-react';

import { mockAIActivity, mockAIModels } from '@/lib/super-dashboard/mockData';

export function AIInsightsSection() {
  const recentActivity = mockAIActivity;
  const models = mockAIModels;

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'text-green-400' : 'text-yellow-400';
  };

  const getStatusBg = (status: string) => {
    return status === 'active' ? 'bg-green-600/20' : 'bg-yellow-600/20';
  };

  const getConfidenceColor = (confidence: string) => {
    return confidence === 'High' ? 'text-blue-400' : 'text-orange-400';
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">🤖</span>
          AI Agents Insights
        </h2>
        <p className="text-slate-400 text-sm">
          Multi-agent system activity e performance modelli
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          </div>

          <div className="space-y-2">
            {recentActivity.map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-purple-600/10 border border-purple-600/20 rounded-lg p-3 hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-xs">{activity.time}</span>
                  <span className="text-purple-400 text-xs font-semibold px-2 py-1 bg-purple-600/20 rounded">
                    {activity.agent}
                  </span>
                </div>
                <div className="text-white font-medium text-sm mb-1">
                  {activity.action}: {activity.result}
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  {activity.impact}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Model Performance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">AI Models Performance</h3>
          </div>

          <div className="space-y-3">
            {models.map((model, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className={`${getStatusBg(model.status)} border border-slate-600/30 rounded-lg p-3`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-medium text-sm">{model.name}</span>
                  </div>
                  <span className={`${getStatusColor(model.status)} text-xs font-semibold`}>
                    {model.status === 'active' ? '✅ Active' : '🟡 Training'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400 mb-1">Accuracy</div>
                    <div className="text-white font-bold">{model.accuracy}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Confidence</div>
                    <div className={`${getConfidenceColor(model.confidence)} font-bold`}>{model.confidence}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Predictions</div>
                    <div className="text-white font-bold">{model.predictions}</div>
                  </div>
                </div>

                {/* Accuracy Bar */}
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${model.accuracy}%` }}
                      transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
