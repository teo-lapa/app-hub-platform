'use client';

/**
 * 🎛️ AGENT DASHBOARD
 * Dashboard completa per controllare il sistema multi-agente
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  MessageSquare,
  Activity,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  Send,
  Loader2
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  appName?: string;
  category?: string;
  capabilities: string[];
  stats: {
    tasksCompleted: number;
    tasksInProgress: number;
    tasksFailed: number;
    successRate: number;
    averageCompletionTime: number;
    lastActive: string;
  };
}

interface Stats {
  totalAgents: number;
  activeTasks: number;
  completedTasks: number;
  queuedTasks: number;
  activeCoordinations: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  success?: boolean;
}

export default function AgentDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'chat'>('overview');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/api/agents/status');
      const data = await response.json();

      setAgents(data.agents || []);
      setStats(data.stats || null);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const initializeOrchestrator = async () => {
    setInitializing(true);

    try {
      const response = await fetch('/api/agents/status', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setInitializing(false);
    }
  };

  const rediscoverApps = async () => {
    setDiscovering(true);

    try {
      const response = await fetch('/api/agents/discover', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        await loadData();
      }
    } catch (error) {
      console.error('Failed to discover:', error);
    } finally {
      setDiscovering(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || sendingMessage) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setSendingMessage(true);

    try {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput })
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Task completed',
        timestamp: new Date(),
        success: data.success
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: new Date(),
        success: false
      };

      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'text-green-400 bg-green-400/10';
      case 'busy':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'error':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'magazzino':
        return '📦';
      case 'vendite':
        return '💰';
      case 'delivery':
        return '🚚';
      case 'admin':
        return '⚙️';
      default:
        return '🔧';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-12 h-12 text-purple-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <Bot className="w-10 h-10 text-purple-400" />
                Agent Dashboard
              </h1>
              <p className="text-gray-400 mt-2">
                Sistema Multi-Agente Orchestrato
              </p>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={initializeOrchestrator}
                disabled={initializing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {initializing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Initialize
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={rediscoverApps}
                disabled={discovering}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {discovering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Discover Apps
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadData}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8"
          >
            <StatsCard
              icon={Bot}
              label="Total Agents"
              value={stats.totalAgents}
              color="purple"
            />
            <StatsCard
              icon={Activity}
              label="Active Tasks"
              value={stats.activeTasks}
              color="blue"
            />
            <StatsCard
              icon={CheckCircle}
              label="Completed"
              value={stats.completedTasks}
              color="green"
            />
            <StatsCard
              icon={Clock}
              label="Queued"
              value={stats.queuedTasks}
              color="yellow"
            />
            <StatsCard
              icon={TrendingUp}
              label="Coordinations"
              value={stats.activeCoordinations}
              color="pink"
            />
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['overview', 'agents', 'chat'].map(tab => (
            <motion.button
              key={tab}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab agents={agents} stats={stats} />
          )}

          {activeTab === 'agents' && (
            <AgentsTab agents={agents} getStatusColor={getStatusColor} getCategoryIcon={getCategoryIcon} />
          )}

          {activeTab === 'chat' && (
            <ChatTab
              messages={chatMessages}
              input={chatInput}
              setInput={setChatInput}
              onSend={sendChatMessage}
              sending={sendingMessage}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Stats Card Component
function StatsCard({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  const colorClasses = {
    purple: 'from-purple-600 to-purple-400',
    blue: 'from-blue-600 to-blue-400',
    green: 'from-green-600 to-green-400',
    yellow: 'from-yellow-600 to-yellow-400',
    pink: 'from-pink-600 to-pink-400'
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-gray-800 rounded-xl p-6 border border-gray-700"
    >
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </motion.div>
  );
}

// Overview Tab
function OverviewTab({ agents, stats }: { agents: Agent[]; stats: Stats | null }) {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Agent Status Summary */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Agent Status
        </h3>

        <div className="space-y-3">
          {['idle', 'busy', 'error', 'offline'].map(status => {
            const count = agents.filter(a => a.status === status).length;
            const percentage = agents.length > 0 ? (count / agents.length) * 100 : 0;

            return (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400 capitalize">{status}</span>
                  <span className="text-white font-medium">{count}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className={`h-full ${
                      status === 'idle' ? 'bg-green-500' :
                      status === 'busy' ? 'bg-yellow-500' :
                      status === 'error' ? 'bg-red-500' :
                      'bg-gray-500'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Performing Agents */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Top Performers
        </h3>

        <div className="space-y-3">
          {agents
            .sort((a, b) => b.stats.successRate - a.stats.successRate)
            .slice(0, 5)
            .map(agent => (
              <div key={agent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">{agent.name}</div>
                    <div className="text-xs text-gray-400">
                      {agent.stats.tasksCompleted} tasks
                    </div>
                  </div>
                </div>
                <div className="text-green-400 font-bold">
                  {agent.stats.successRate.toFixed(0)}%
                </div>
              </div>
            ))}
        </div>
      </div>
    </motion.div>
  );
}

// Agents Tab
function AgentsTab({
  agents,
  getStatusColor,
  getCategoryIcon
}: {
  agents: Agent[];
  getStatusColor: (status: string) => string;
  getCategoryIcon: (category?: string) => string;
}) {
  return (
    <motion.div
      key="agents"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {agents.map(agent => (
        <motion.div
          key={agent.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.02 }}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{getCategoryIcon(agent.category)}</div>
              <div>
                <h3 className="text-white font-bold">{agent.name}</h3>
                <p className="text-xs text-gray-400">{agent.appName}</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
              {agent.status}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Completed</span>
              <span className="text-green-400 font-medium">{agent.stats.tasksCompleted}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">In Progress</span>
              <span className="text-yellow-400 font-medium">{agent.stats.tasksInProgress}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Success Rate</span>
              <span className="text-white font-medium">{agent.stats.successRate.toFixed(0)}%</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Capabilities</div>
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 3).map(cap => (
                <span
                  key={cap}
                  className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs"
                >
                  {cap}
                </span>
              ))}
              {agent.capabilities.length > 3 && (
                <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs">
                  +{agent.capabilities.length - 3}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Chat Tab
function ChatTab({
  messages,
  input,
  setInput,
  onSend,
  sending
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
    >
      {/* Chat Messages */}
      <div className="h-[500px] overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Start a conversation with the orchestrator</p>
            <p className="text-sm mt-2">Try: "Fix the bug in inventario app" or "Add export feature to delivery"</p>
          </div>
        )}

        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[70%] p-4 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : msg.success === false
                  ? 'bg-red-600/20 text-red-300 border border-red-600/30'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              <div className="text-sm">{msg.content}</div>
              <div className="text-xs opacity-60 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm">You</span>
              </div>
            )}
          </motion.div>
        ))}

        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !sending && onSend()}
            placeholder="Ask the orchestrator to do something..."
            disabled={sending}
            className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:opacity-50"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSend}
            disabled={sending || !input.trim()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
