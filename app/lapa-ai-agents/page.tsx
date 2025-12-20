'use client';

/**
 * LAPA AI AGENTS - Dashboard Agenti Clienti
 *
 * Pagina per gestire gli agenti AI che assistono i clienti:
 * - Orchestratore (smista le richieste)
 * - Agente Ordini
 * - Agente Fatture
 * - Agente Spedizioni
 * - Agente Prodotti
 * - Agente Helpdesk
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  ShoppingCart,
  FileText,
  Truck,
  Package,
  HeadphonesIcon,
  Brain,
  Activity,
  Settings,
  Play,
  Pause,
  RefreshCw,
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Zap,
  Globe,
  Send,
  Loader2,
  Eye,
  Edit3,
  Save,
  X
} from 'lucide-react';

// Tipi
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'active' | 'paused' | 'error' | 'offline';
  enabled: boolean;
  permissions: string[];
  supportedLanguages: string[];
  stats: {
    requestsToday: number;
    requestsTotal: number;
    avgResponseTime: number;
    successRate: number;
    lastActive: string;
  };
  systemPrompt?: string;
}

interface ConversationLog {
  id: string;
  customerId?: number;
  customerName?: string;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  agentId: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }[];
  status: 'active' | 'resolved' | 'escalated';
  createdAt: string;
}

interface DashboardStats {
  totalRequests: number;
  activeConversations: number;
  resolvedToday: number;
  escalatedToday: number;
  avgResponseTime: number;
  customerSatisfaction: number;
}

// Configurazione agenti di default
const defaultAgents: AgentConfig[] = [
  {
    id: 'orchestrator',
    name: 'Orchestratore',
    description: 'Smista le richieste agli agenti specializzati',
    icon: 'Brain',
    color: 'purple',
    status: 'active',
    enabled: true,
    permissions: ['route_requests', 'analyze_intent', 'manage_context'],
    supportedLanguages: ['it', 'de', 'fr', 'en'],
    stats: {
      requestsToday: 156,
      requestsTotal: 4523,
      avgResponseTime: 0.8,
      successRate: 98.5,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'orders',
    name: 'Agente Ordini',
    description: 'Gestisce ordini, storico, creazione e modifiche',
    icon: 'ShoppingCart',
    color: 'blue',
    status: 'active',
    enabled: true,
    permissions: ['read_orders', 'create_orders_b2b', 'modify_orders', 'cancel_orders'],
    supportedLanguages: ['it', 'de', 'fr', 'en'],
    stats: {
      requestsToday: 45,
      requestsTotal: 1234,
      avgResponseTime: 1.2,
      successRate: 96.8,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'invoices',
    name: 'Agente Fatture',
    description: 'Mostra fatture, scadenze e link pagamento',
    icon: 'FileText',
    color: 'green',
    status: 'active',
    enabled: true,
    permissions: ['read_invoices', 'generate_payment_links', 'send_reminders'],
    supportedLanguages: ['it', 'de', 'fr', 'en'],
    stats: {
      requestsToday: 32,
      requestsTotal: 892,
      avgResponseTime: 0.9,
      successRate: 99.1,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'shipping',
    name: 'Agente Spedizioni',
    description: 'Tracking, ETA e info consegne',
    icon: 'Truck',
    color: 'orange',
    status: 'active',
    enabled: true,
    permissions: ['track_shipments', 'get_eta', 'report_issues'],
    supportedLanguages: ['it', 'de', 'fr', 'en'],
    stats: {
      requestsToday: 28,
      requestsTotal: 756,
      avgResponseTime: 1.1,
      successRate: 97.3,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'products',
    name: 'Agente Prodotti',
    description: 'Info prodotti, disponibilità e prezzi',
    icon: 'Package',
    color: 'pink',
    status: 'active',
    enabled: true,
    permissions: ['search_products', 'check_availability', 'get_prices'],
    supportedLanguages: ['it', 'de', 'fr', 'en'],
    stats: {
      requestsToday: 67,
      requestsTotal: 2341,
      avgResponseTime: 0.7,
      successRate: 99.5,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'helpdesk',
    name: 'Agente Helpdesk',
    description: 'Supporto, ticket e escalation',
    icon: 'HeadphonesIcon',
    color: 'red',
    status: 'active',
    enabled: true,
    permissions: ['create_tickets', 'escalate', 'notify_team'],
    supportedLanguages: ['it', 'de', 'fr', 'en'],
    stats: {
      requestsToday: 12,
      requestsTotal: 456,
      avgResponseTime: 1.5,
      successRate: 94.2,
      lastActive: new Date().toISOString()
    }
  }
];

// Icone mapping
const iconMap: Record<string, any> = {
  Brain,
  ShoppingCart,
  FileText,
  Truck,
  Package,
  HeadphonesIcon
};

// Colori mapping
const colorMap: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', gradient: 'from-purple-600 to-purple-400' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', gradient: 'from-blue-600 to-blue-400' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', gradient: 'from-green-600 to-green-400' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', gradient: 'from-orange-600 to-orange-400' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', gradient: 'from-pink-600 to-pink-400' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', gradient: 'from-red-600 to-red-400' }
};

export default function LapaAIAgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>(defaultAgents);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 340,
    activeConversations: 8,
    resolvedToday: 145,
    escalatedToday: 3,
    avgResponseTime: 1.0,
    customerSatisfaction: 4.7
  });
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'logs' | 'test'>('overview');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationLog[]>([]);

  // Test chat state
  const [testMessages, setTestMessages] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [testInput, setTestInput] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testCustomerType, setTestCustomerType] = useState<'b2b' | 'b2c' | 'anonymous'>('b2b');

  // Carica dati
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh ogni 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // In futuro: chiamata API reale
      // const response = await fetch('/api/lapa-agents/status');
      // const data = await response.json();
      // setAgents(data.agents);
      // setStats(data.stats);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const toggleAgent = async (agentId: string) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id === agentId) {
        return {
          ...agent,
          enabled: !agent.enabled,
          status: !agent.enabled ? 'active' : 'paused'
        };
      }
      return agent;
    }));
  };

  const sendTestMessage = async () => {
    if (!testInput.trim() || testSending) return;

    const userMessage = { role: 'user' as const, content: testInput };
    setTestMessages(prev => [...prev, userMessage]);
    setTestInput('');
    setTestSending(true);

    try {
      const response = await fetch('/api/lapa-agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testInput,
          customerType: testCustomerType,
          sessionId: 'test-session'
        })
      });

      const data = await response.json();

      setTestMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message || 'Risposta ricevuta'
      }]);
    } catch (error) {
      setTestMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Errore nella comunicazione con gli agenti'
      }]);
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">LAPA AI Agents</h1>
                <p className="text-sm text-slate-400">Sistema Multi-Agente per Assistenza Clienti</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadData}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </motion.button>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-green-400 font-medium">Sistema Attivo</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatsCard
            icon={MessageSquare}
            label="Richieste Oggi"
            value={stats.totalRequests}
            color="blue"
          />
          <StatsCard
            icon={Activity}
            label="Conversazioni Attive"
            value={stats.activeConversations}
            color="green"
          />
          <StatsCard
            icon={CheckCircle}
            label="Risolte Oggi"
            value={stats.resolvedToday}
            color="emerald"
          />
          <StatsCard
            icon={AlertTriangle}
            label="Escalation"
            value={stats.escalatedToday}
            color="orange"
          />
          <StatsCard
            icon={Clock}
            label="Tempo Medio"
            value={`${stats.avgResponseTime}s`}
            color="purple"
          />
          <StatsCard
            icon={TrendingUp}
            label="Soddisfazione"
            value={`${stats.customerSatisfaction}/5`}
            color="pink"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Panoramica', icon: Activity },
            { id: 'agents', label: 'Agenti', icon: Bot },
            { id: 'logs', label: 'Conversazioni', icon: MessageSquare },
            { id: 'test', label: 'Test Chat', icon: Send }
          ].map(tab => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab agents={agents} />
          )}

          {activeTab === 'agents' && (
            <AgentsTab
              agents={agents}
              onToggle={toggleAgent}
              onSelect={setSelectedAgent}
            />
          )}

          {activeTab === 'logs' && (
            <LogsTab conversations={conversations} />
          )}

          {activeTab === 'test' && (
            <TestChatTab
              messages={testMessages}
              input={testInput}
              setInput={setTestInput}
              onSend={sendTestMessage}
              sending={testSending}
              customerType={testCustomerType}
              setCustomerType={setTestCustomerType}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <AgentDetailModal
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
            onSave={(updated) => {
              setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
              setSelectedAgent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Stats Card Component
function StatsCard({ icon: Icon, label, value, color }: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'from-blue-600 to-blue-400',
    green: 'from-green-600 to-green-400',
    emerald: 'from-emerald-600 to-emerald-400',
    orange: 'from-orange-600 to-orange-400',
    purple: 'from-purple-600 to-purple-400',
    pink: 'from-pink-600 to-pink-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
    >
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </motion.div>
  );
}

// Overview Tab
function OverviewTab({ agents }: { agents: AgentConfig[] }) {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Agents Grid */}
      <div className="lg:col-span-2">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-red-400" />
          Stato Agenti
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {agents.map(agent => {
            const Icon = iconMap[agent.icon] || Bot;
            const colors = colorMap[agent.color];

            return (
              <motion.div
                key={agent.id}
                whileHover={{ scale: 1.02 }}
                className={`relative bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border ${colors.border} overflow-hidden`}
              >
                {/* Status indicator */}
                <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${
                  agent.status === 'active' ? 'bg-green-400 animate-pulse' :
                  agent.status === 'paused' ? 'bg-yellow-400' :
                  agent.status === 'error' ? 'bg-red-400' :
                  'bg-slate-500'
                }`} />

                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>

                <h4 className="text-white font-medium text-sm mb-1">{agent.name}</h4>
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{agent.description}</p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{agent.stats.requestsToday} oggi</span>
                  <span className={`${colors.text} font-medium`}>{agent.stats.successRate}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Activity Chart Placeholder */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Attività Ultime 24h
        </h3>
        <div className="h-48 flex items-end gap-1">
          {Array.from({ length: 24 }).map((_, i) => {
            const height = 20 + Math.random() * 80;
            return (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-red-600 to-red-400 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>00:00</span>
          <span>12:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Languages */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          Lingue Supportate
        </h3>
        <div className="space-y-3">
          {[
            { lang: 'Italiano', code: 'it', flag: '🇮🇹', percentage: 45 },
            { lang: 'Tedesco', code: 'de', flag: '🇩🇪', percentage: 30 },
            { lang: 'Francese', code: 'fr', flag: '🇫🇷', percentage: 15 },
            { lang: 'Inglese', code: 'en', flag: '🇬🇧', percentage: 10 }
          ].map(item => (
            <div key={item.code}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{item.flag} {item.lang}</span>
                <span className="text-slate-400">{item.percentage}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-red-600 to-red-400"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Agents Tab
function AgentsTab({ agents, onToggle, onSelect }: {
  agents: AgentConfig[];
  onToggle: (id: string) => void;
  onSelect: (agent: AgentConfig) => void;
}) {
  return (
    <motion.div
      key="agents"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {agents.map(agent => {
        const Icon = iconMap[agent.icon] || Bot;
        const colors = colorMap[agent.color];

        return (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border ${colors.border} overflow-hidden`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{agent.name}</h3>
                    <p className="text-slate-400 text-sm mb-3">{agent.description}</p>

                    {/* Permissions */}
                    <div className="flex flex-wrap gap-2">
                      {agent.permissions.map(perm => (
                        <span
                          key={perm}
                          className={`px-2 py-1 rounded text-xs ${colors.bg} ${colors.text}`}
                        >
                          {perm.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Stats */}
                  <div className="text-right mr-4">
                    <div className="text-2xl font-bold text-white">{agent.stats.requestsToday}</div>
                    <div className="text-xs text-slate-400">richieste oggi</div>
                  </div>

                  {/* Toggle */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onToggle(agent.id)}
                    className={`p-3 rounded-xl ${
                      agent.enabled
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {agent.enabled ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </motion.button>

                  {/* Settings */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onSelect(agent)}
                    className="p-3 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white"
                  >
                    <Settings className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/50">
                <div>
                  <div className="text-slate-400 text-xs mb-1">Totale Richieste</div>
                  <div className="text-white font-medium">{agent.stats.requestsTotal.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-1">Tempo Medio</div>
                  <div className="text-white font-medium">{agent.stats.avgResponseTime}s</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-1">Success Rate</div>
                  <div className="text-green-400 font-medium">{agent.stats.successRate}%</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-1">Ultima Attività</div>
                  <div className="text-white font-medium">
                    {new Date(agent.stats.lastActive).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// Logs Tab
function LogsTab({ conversations }: { conversations: ConversationLog[] }) {
  return (
    <motion.div
      key="logs"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Conversazioni Recenti
        </h3>
        <div className="flex gap-2">
          <select className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600">
            <option>Tutti gli agenti</option>
            <option>Orchestratore</option>
            <option>Agente Ordini</option>
            <option>Agente Fatture</option>
          </select>
          <select className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm border border-slate-600">
            <option>Ultimo ora</option>
            <option>Ultime 24h</option>
            <option>Ultima settimana</option>
          </select>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nessuna conversazione registrata</p>
          <p className="text-sm mt-2">Le conversazioni appariranno qui quando i clienti useranno il chatbot</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-medium">
                    {conv.customerName || 'Visitatore Anonimo'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    conv.customerType === 'b2b' ? 'bg-blue-500/20 text-blue-400' :
                    conv.customerType === 'b2c' ? 'bg-green-500/20 text-green-400' :
                    'bg-slate-600 text-slate-400'
                  }`}>
                    {conv.customerType.toUpperCase()}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  conv.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                  conv.status === 'escalated' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {conv.status}
                </span>
              </div>
              <p className="text-slate-400 text-sm line-clamp-1">
                {conv.messages[conv.messages.length - 1]?.content || 'Nessun messaggio'}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Test Chat Tab
function TestChatTab({
  messages,
  input,
  setInput,
  onSend,
  sending,
  customerType,
  setCustomerType
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  setCustomerType: (v: 'b2b' | 'b2c' | 'anonymous') => void;
}) {
  return (
    <motion.div
      key="test"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-red-400" />
          Test Chat - Simula Cliente
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Tipo cliente:</span>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as any)}
            className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm border border-slate-600"
          >
            <option value="b2b">B2B (Azienda)</option>
            <option value="b2c">B2C (Privato)</option>
            <option value="anonymous">Anonimo</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="h-[400px] overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-16">
            <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Testa gli agenti LAPA AI</p>
            <p className="text-sm">Prova a scrivere:</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                'Vorrei ordinare della mozzarella',
                'Dove si trova il mio ordine?',
                'Ho fatture da pagare?',
                'Avete la burrata disponibile?'
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center mr-3 flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div className={`max-w-[70%] p-4 rounded-xl ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-100'
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-slate-700 p-4 rounded-xl">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !sending && onSend()}
            placeholder="Scrivi un messaggio come farebbe un cliente..."
            disabled={sending}
            className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-xl border border-slate-600 focus:outline-none focus:border-red-500 disabled:opacity-50"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSend}
            disabled={sending || !input.trim()}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-50"
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

// Agent Detail Modal
function AgentDetailModal({
  agent,
  onClose,
  onSave
}: {
  agent: AgentConfig;
  onClose: () => void;
  onSave: (agent: AgentConfig) => void;
}) {
  const [editedAgent, setEditedAgent] = useState(agent);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
  const Icon = iconMap[agent.icon] || Bot;
  const colors = colorMap[agent.color];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b border-slate-700 bg-gradient-to-r ${colors.gradient}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
                <p className="text-white/80 text-sm">{agent.description}</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
            <div>
              <div className="text-white font-medium">Stato Agente</div>
              <div className="text-slate-400 text-sm">Attiva o disattiva questo agente</div>
            </div>
            <button
              onClick={() => setEditedAgent(prev => ({
                ...prev,
                enabled: !prev.enabled,
                status: !prev.enabled ? 'active' : 'paused'
              }))}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                editedAgent.enabled ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <motion.div
                animate={{ x: editedAgent.enabled ? 28 : 4 }}
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
              />
            </button>
          </div>

          {/* Permissions */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Permessi
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {agent.permissions.map(perm => (
                <label key={perm} className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700">
                  <input
                    type="checkbox"
                    checked={editedAgent.permissions.includes(perm)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditedAgent(prev => ({
                          ...prev,
                          permissions: [...prev.permissions, perm]
                        }));
                      } else {
                        setEditedAgent(prev => ({
                          ...prev,
                          permissions: prev.permissions.filter(p => p !== perm)
                        }));
                      }
                    }}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-slate-300 text-sm">{perm.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-400" />
              System Prompt (Istruzioni)
            </h3>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Inserisci le istruzioni per questo agente..."
              className="w-full h-32 bg-slate-700 text-white px-4 py-3 rounded-xl border border-slate-600 focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          {/* Languages */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-green-400" />
              Lingue Attive
            </h3>
            <div className="flex gap-2">
              {[
                { code: 'it', flag: '🇮🇹', name: 'Italiano' },
                { code: 'de', flag: '🇩🇪', name: 'Tedesco' },
                { code: 'fr', flag: '🇫🇷', name: 'Francese' },
                { code: 'en', flag: '🇬🇧', name: 'Inglese' }
              ].map(lang => (
                <button
                  key={lang.code}
                  onClick={() => {
                    if (editedAgent.supportedLanguages.includes(lang.code)) {
                      setEditedAgent(prev => ({
                        ...prev,
                        supportedLanguages: prev.supportedLanguages.filter(l => l !== lang.code)
                      }));
                    } else {
                      setEditedAgent(prev => ({
                        ...prev,
                        supportedLanguages: [...prev.supportedLanguages, lang.code]
                      }));
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editedAgent.supportedLanguages.includes(lang.code)
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-slate-700 text-slate-400 border border-slate-600'
                  }`}
                >
                  {lang.flag} {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
          >
            Annulla
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSave({ ...editedAgent, systemPrompt })}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salva Modifiche
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
