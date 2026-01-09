'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  ShoppingCart,
  Package,
  Truck,
  Receipt,
  HeadphonesIcon,
  Megaphone,
  BarChart3,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Music,
  Video,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  AlertTriangle,
  Bell,
  Eye,
  Play,
  Pause,
  RefreshCw,
  Settings,
  MessageCircle,
  Users,
  Zap,
  ArrowRight,
  Filter,
  LayoutDashboard,
  History,
  Radio
} from 'lucide-react';

// Types
interface Agent {
  name: string;
  status: 'idle' | 'working' | 'error' | 'offline';
  description: string;
  icon: React.ReactNode;
  currentTask?: string;
  lastActivity?: string;
  todayActions?: number;
  todayMessages?: number;
}

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'pdf' | 'audio' | 'video' | 'other';
}

interface BackgroundTask {
  task_id: number;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  task_description: string;
  result?: string;
  error?: string;
  actions_taken?: Array<{ tool: string; status: string }>;
  created_at?: string;
  completed_at?: string;
}

interface ActivityItem {
  id: number;
  type: 'action' | 'message' | 'task' | 'handoff' | 'alert';
  agent: string;
  content: string;
  timestamp: string;
  status?: 'success' | 'error' | 'pending';
  metadata?: Record<string, unknown>;
}

interface UnifiedMessage {
  id: number;
  agent: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  user_id?: number;
}

interface Alert {
  id: number;
  type: 'warning' | 'error' | 'info';
  agent: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface DashboardSummary {
  total_actions_today: number;
  active_tasks: number;
  pending_alerts: number;
  total_conversations: number;
  agents_working: number;
  agents_idle: number;
  agents_error: number;
}

// View types
type ViewType = 'dashboard' | 'unified-chat' | 'agent-chat' | 'activity' | 'alerts';

// Agent icons mapping
const agentIcons: Record<string, React.ReactNode> = {
  acquisti: <ShoppingCart className="h-5 w-5" />,
  magazzino: <Package className="h-5 w-5" />,
  vendite: <Receipt className="h-5 w-5" />,
  consegne: <Truck className="h-5 w-5" />,
  amministrazione: <Receipt className="h-5 w-5" />,
  customer_service: <HeadphonesIcon className="h-5 w-5" />,
  marketing: <Megaphone className="h-5 w-5" />,
  direzione: <BarChart3 className="h-5 w-5" />,
};

const agentDescriptions: Record<string, string> = {
  acquisti: 'Fornitori, ordini, scorte',
  magazzino: 'Inventario, picking',
  vendite: 'Clienti, preventivi',
  consegne: 'Consegne, autisti',
  amministrazione: 'Fatture, pagamenti',
  customer_service: 'Supporto clienti',
  marketing: 'Social, campagne',
  direzione: 'Report, KPI',
};

const agentColors: Record<string, string> = {
  acquisti: 'from-blue-500 to-cyan-500',
  magazzino: 'from-amber-500 to-orange-500',
  vendite: 'from-green-500 to-emerald-500',
  consegne: 'from-purple-500 to-pink-500',
  amministrazione: 'from-red-500 to-rose-500',
  customer_service: 'from-teal-500 to-cyan-500',
  marketing: 'from-fuchsia-500 to-pink-500',
  direzione: 'from-indigo-500 to-violet-500',
};

const API_BASE = '/api/agents';

export default function LapaAiAgentsPage() {
  // View state
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [unifiedMessages, setUnifiedMessages] = useState<UnifiedMessage[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  // UI state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, unifiedMessages]);

  // Fetch dashboard summary
  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/control-room/summary`);
      if (response.ok) {
        const data = await response.json();
        // Map the response to our expected format
        const summaryData = data.summary || data;
        setSummary({
          total_actions_today: summaryData.total_actions_today || 0,
          active_tasks: summaryData.running_tasks || 0,
          pending_alerts: summaryData.unacknowledged_alerts || 0,
          total_conversations: summaryData.active_conversations || 0,
          agents_working: 0,
          agents_idle: 0,
          agents_error: 0
        });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  // Fetch agents status
  const fetchAgentsStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/control-room/agents-status`);
      if (response.ok) {
        const data = await response.json();
        const updatedAgents: Agent[] = data.agents.map((a: Record<string, unknown>) => ({
          name: (a.key || a.name) as string,
          status: (a.status === 'active' ? 'idle' : a.status) as Agent['status'],
          description: agentDescriptions[(a.key || a.name) as string] || a.description as string || '',
          icon: agentIcons[(a.key || a.name) as string],
          currentTask: a.current_task as string | undefined,
          lastActivity: a.last_activity as string | undefined,
          todayActions: (a.actions_today || a.today_actions) as number | undefined,
          todayMessages: a.today_messages as number | undefined,
        }));
        setAgents(updatedAgents);
      }
    } catch (error) {
      console.error('Error fetching agents status:', error);
      // Fallback to default agents
      initializeDefaultAgents();
    }
  }, []);

  // Fetch activity feed
  const fetchActivityFeed = useCallback(async () => {
    try {
      const url = activityFilter
        ? `${API_BASE}/control-room/activity-feed?agent=${activityFilter}`
        : `${API_BASE}/control-room/activity-feed`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const activities = (data.activities || []).map((a: Record<string, unknown>, idx: number) => ({
          id: a.id || idx,
          type: a.type as ActivityItem['type'],
          agent: (a.agent || a.from_agent) as string,
          content: (a.description || a.action_type || a.message_type || '') as string,
          timestamp: a.timestamp as string,
          status: a.status as ActivityItem['status'],
          metadata: a
        }));
        setActivityFeed(activities);
      }
    } catch (error) {
      console.error('Error fetching activity feed:', error);
    }
  }, [activityFilter]);

  // Fetch unified messages
  const fetchUnifiedMessages = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/control-room/unified-messages`);
      if (response.ok) {
        const data = await response.json();
        setUnifiedMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching unified messages:', error);
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/control-room/alerts`);
      if (response.ok) {
        const data = await response.json();
        const alertsData = (data.alerts || []).map((a: Record<string, unknown>) => ({
          id: a.id as number,
          type: (a.severity === 'critical' || a.severity === 'error' ? 'error' :
                 a.severity === 'warning' ? 'warning' : 'info') as Alert['type'],
          agent: a.agent as string,
          message: (a.message || a.title) as string,
          timestamp: (a.created_at || a.timestamp) as string,
          acknowledged: a.acknowledged as boolean
        }));
        setAlerts(alertsData);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  // Initialize default agents
  const initializeDefaultAgents = () => {
    const defaultAgents: Agent[] = [
      { name: 'acquisti', status: 'idle', description: agentDescriptions.acquisti, icon: agentIcons.acquisti },
      { name: 'magazzino', status: 'idle', description: agentDescriptions.magazzino, icon: agentIcons.magazzino },
      { name: 'vendite', status: 'idle', description: agentDescriptions.vendite, icon: agentIcons.vendite },
      { name: 'consegne', status: 'idle', description: agentDescriptions.consegne, icon: agentIcons.consegne },
      { name: 'amministrazione', status: 'idle', description: agentDescriptions.amministrazione, icon: agentIcons.amministrazione },
      { name: 'customer_service', status: 'idle', description: agentDescriptions.customer_service, icon: agentIcons.customer_service },
      { name: 'marketing', status: 'idle', description: agentDescriptions.marketing, icon: agentIcons.marketing },
      { name: 'direzione', status: 'idle', description: agentDescriptions.direzione, icon: agentIcons.direzione },
    ];
    setAgents(defaultAgents);
  };

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchSummary(),
      fetchAgentsStatus(),
      fetchActivityFeed(),
      fetchUnifiedMessages(),
      fetchAlerts(),
    ]);
    setIsRefreshing(false);
  }, [fetchSummary, fetchAgentsStatus, fetchActivityFeed, fetchUnifiedMessages, fetchAlerts]);

  // Initial load and auto-refresh
  useEffect(() => {
    refreshAll();

    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        refreshAll();
      }, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshAll]);

  // Poll for task status
  const pollTaskStatus = useCallback(async (taskId: number) => {
    try {
      const response = await fetch(`${API_BASE}/chat/task/${taskId}`);
      const data = await response.json();

      if (data.task_id) {
        setBackgroundTasks(prev => {
          const existing = prev.find(t => t.task_id === taskId);
          if (existing) {
            return prev.map(t => t.task_id === taskId ? data : t);
          }
          return [...prev, data];
        });

        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setActiveTaskId(null);

          if (data.status === 'completed' && data.result) {
            const actionsInfo = data.actions_taken?.length
              ? `\n\n[${data.actions_taken.length} azioni eseguite]`
              : '';
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: data.result + actionsInfo
            }]);
          } else if (data.status === 'failed') {
            setChatHistory(prev => [...prev, {
              role: 'assistant',
              content: `Task fallito: ${data.error || 'Errore sconosciuto'}`
            }]);
          }

          // Refresh data after task completion
          refreshAll();
        }
      }
    } catch (error) {
      console.error('Error polling task:', error);
    }
  }, [refreshAll]);

  // Start polling when we have an active task
  useEffect(() => {
    if (activeTaskId) {
      pollTaskStatus(activeTaskId);
      pollingRef.current = setInterval(() => {
        pollTaskStatus(activeTaskId);
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeTaskId, pollTaskStatus]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];

    Array.from(files).forEach(file => {
      let fileType: AttachedFile['type'] = 'other';

      if (file.type.startsWith('image/')) {
        fileType = 'image';
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
      } else if (file.type.startsWith('audio/')) {
        fileType = 'audio';
      } else if (file.type.startsWith('video/')) {
        fileType = 'video';
      }

      const attachedFile: AttachedFile = {
        file,
        type: fileType
      };

      if (fileType === 'image' || fileType === 'video') {
        attachedFile.preview = URL.createObjectURL(file);
      }

      newFiles.push(attachedFile);
    });

    setAttachedFiles(prev => [...prev, ...newFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attached file
  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Send message (agent chat)
  const sendMessage = async () => {
    if ((!chatMessage.trim() && attachedFiles.length === 0) || !selectedAgent) return;

    setIsSending(true);
    const userMessage = chatMessage;
    const filesToSend = [...attachedFiles];
    setChatMessage('');
    setAttachedFiles([]);

    let displayMessage = userMessage;
    if (filesToSend.length > 0) {
      const fileNames = filesToSend.map(f => f.file.name).join(', ');
      displayMessage = userMessage
        ? `${userMessage}\n\n📎 Allegati: ${fileNames}`
        : `📎 Allegati: ${fileNames}`;
    }

    setChatHistory(prev => [...prev, { role: 'user', content: displayMessage }]);

    try {
      const attachments = await Promise.all(
        filesToSend.map(async (f) => ({
          filename: f.file.name,
          mimetype: f.file.type,
          data: await fileToBase64(f.file),
          size: f.file.size
        }))
      );

      const response = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessage || `Ho allegato ${filesToSend.length} file. Per favore analizzali.`,
          user_id: 1,
          channel: 'web',
          target_agent: selectedAgent,
          attachments: attachments.length > 0 ? attachments : undefined
        })
      });

      const data = await response.json();

      if (data.task_id) {
        const newTask: BackgroundTask = {
          task_id: data.task_id,
          agent: selectedAgent,
          status: 'pending',
          task_description: userMessage
        };
        setBackgroundTasks(prev => [...prev, newTask]);
        setActiveTaskId(data.task_id);
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `Task avviato in background (ID: ${data.task_id}). Sto elaborando...`
        }]);
      } else if (data.content) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else if (data.error) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: `Errore: ${data.error}` }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Errore di connessione.' }]);
    } finally {
      setIsSending(false);
      filesToSend.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Send intervention
  const sendIntervention = async (agentName: string, message: string) => {
    try {
      const response = await fetch(`${API_BASE}/control-room/intervene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          message: message,
          user_id: 1
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending intervention:', error);
      throw error;
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: number) => {
    try {
      await fetch(`${API_BASE}/control-room/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  // Get status color
  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'working': return 'bg-green-500';
      case 'idle': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      case 'offline': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  // Get status text
  const getStatusText = (status: Agent['status']) => {
    switch (status) {
      case 'working': return 'In esecuzione';
      case 'idle': return 'Pronto';
      case 'error': return 'Errore';
      case 'offline': return 'Offline';
      default: return 'Sconosciuto';
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedAgentData = agents.find(a => a.name === selectedAgent);
  const pendingAlerts = alerts.filter(a => !a.acknowledged).length;

  // ========================
  // RENDER FUNCTIONS
  // ========================

  // Dashboard View
  const renderDashboard = () => (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20">
              <Zap className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary?.total_actions_today || 0}</p>
              <p className="text-xs text-slate-400">Azioni oggi</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/20">
              <Activity className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary?.active_tasks || 0}</p>
              <p className="text-xs text-slate-400">Task attivi</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingAlerts}</p>
              <p className="text-xs text-slate-400">Alert pendenti</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20">
              <MessageCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{summary?.total_conversations || 0}</p>
              <p className="text-xs text-slate-400">Conversazioni</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-400" />
          Stato Agenti
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <button
              key={agent.name}
              onClick={() => {
                setSelectedAgent(agent.name);
                setCurrentView('agent-chat');
                setChatHistory([]);
              }}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 text-left hover:border-purple-500/50 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${agentColors[agent.name]} bg-opacity-20`}>
                  {agent.icon}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${getStatusColor(agent.status)} ${agent.status === 'working' ? 'animate-pulse' : ''}`} />
                  <span className="text-xs text-slate-400">{getStatusText(agent.status)}</span>
                </div>
              </div>
              <h3 className="font-medium text-white capitalize group-hover:text-purple-400 transition-colors">
                {agent.name.replace('_', ' ')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{agent.description}</p>
              {agent.currentTask && (
                <p className="text-xs text-purple-400 mt-2 truncate">
                  <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                  {agent.currentTask}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700">
                <span className="text-xs text-slate-400">
                  <Zap className="h-3 w-3 inline mr-1" />
                  {agent.todayActions || 0} azioni
                </span>
                <span className="text-xs text-slate-400">
                  <MessageSquare className="h-3 w-3 inline mr-1" />
                  {agent.todayMessages || 0} msg
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-400" />
          Attività Recente
        </h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl divide-y divide-slate-700">
          {activityFeed.slice(0, 5).map((activity) => (
            <div key={activity.id} className="p-4 flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${agentColors[activity.agent]} bg-opacity-20`}>
                {agentIcons[activity.agent]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white capitalize">{activity.agent.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">{formatTime(activity.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-300 truncate">{activity.content}</p>
              </div>
              {activity.status && (
                <span className={`px-2 py-1 rounded-full text-xs ${
                  activity.status === 'success' ? 'bg-green-500/20 text-green-400' :
                  activity.status === 'error' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {activity.status}
                </span>
              )}
            </div>
          ))}
          {activityFeed.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              Nessuna attività recente
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Unified Chat View
  const renderUnifiedChat = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Radio className="h-5 w-5 text-purple-400" />
          Chat Unificata
          <span className="text-xs text-slate-500 font-normal">Tutte le conversazioni</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {unifiedMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[70%]">
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded bg-gradient-to-br ${agentColors[msg.agent]}`}>
                    {agentIcons[msg.agent]}
                  </div>
                  <span className="text-xs text-slate-400 capitalize">{msg.agent.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              <div
                className={`p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white'
                    : 'bg-slate-800/80 text-slate-100 border border-slate-700/50'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <p className="text-xs text-slate-500 text-right mt-1">{formatTime(msg.timestamp)}</p>
              )}
            </div>
          </div>
        ))}
        {unifiedMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-4">
              <MessageSquare className="h-12 w-12 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Chat Unificata</h2>
            <p className="text-slate-400 max-w-md">
              Qui vedrai tutte le conversazioni degli agenti in tempo reale.
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  // Activity View
  const renderActivityView = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="h-5 w-5 text-purple-400" />
          Storico Attività
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={activityFilter || ''}
            onChange={(e) => setActivityFilter(e.target.value || null)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="">Tutti gli agenti</option>
            {agents.map(a => (
              <option key={a.name} value={a.name}>{a.name.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {activityFeed.map((activity) => (
            <div
              key={activity.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-start gap-4"
            >
              <div className={`p-2 rounded-xl bg-gradient-to-br ${agentColors[activity.agent]} bg-opacity-20`}>
                {agentIcons[activity.agent]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white capitalize">{activity.agent.replace('_', ' ')}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    activity.type === 'action' ? 'bg-blue-500/20 text-blue-400' :
                    activity.type === 'message' ? 'bg-green-500/20 text-green-400' :
                    activity.type === 'task' ? 'bg-purple-500/20 text-purple-400' :
                    activity.type === 'handoff' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {activity.type}
                  </span>
                  <span className="text-xs text-slate-500">{formatTime(activity.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-300">{activity.content}</p>
              </div>
              {activity.status && (
                <div className="flex items-center">
                  {activity.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : activity.status === 'error' ? (
                    <XCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-400" />
                  )}
                </div>
              )}
            </div>
          ))}
          {activityFeed.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Nessuna attività trovata
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Alerts View
  const renderAlertsView = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-400" />
          Alert Sistema
          {pendingAlerts > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {pendingAlerts}
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-xl p-4 flex items-start gap-4 ${
                alert.acknowledged
                  ? 'bg-slate-800/30 border-slate-700/50 opacity-60'
                  : alert.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30'
                  : alert.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <div className={`p-2 rounded-xl ${
                alert.type === 'error' ? 'bg-red-500/20' :
                alert.type === 'warning' ? 'bg-amber-500/20' :
                'bg-blue-500/20'
              }`}>
                <AlertTriangle className={`h-5 w-5 ${
                  alert.type === 'error' ? 'text-red-400' :
                  alert.type === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white capitalize">{alert.agent.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">{formatTime(alert.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-300">{alert.message}</p>
              </div>
              {!alert.acknowledged && (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Conferma
                </button>
              )}
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Nessun alert
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Agent Chat View
  const renderAgentChat = () => (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-6 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedAgentData && (
            <div className={`p-2 rounded-xl bg-gradient-to-br ${agentColors[selectedAgentData.name]}`}>
              {selectedAgentData.icon}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              {selectedAgent ? selectedAgent.replace('_', ' ').toUpperCase() : 'Seleziona Agente'}
              <Sparkles className="h-4 w-4 text-purple-400" />
            </h1>
            <p className="text-xs text-slate-500">
              {selectedAgentData?.description || 'Scegli un agente dalla sidebar'}
            </p>
          </div>
        </div>
        {selectedAgent && (
          <div className="flex items-center gap-3">
            {activeTaskId && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Task #{activeTaskId} in corso...
              </span>
            )}
            <span className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
              selectedAgentData?.status === 'working'
                ? 'text-green-400 bg-green-500/10 border-green-500/20'
                : selectedAgentData?.status === 'error'
                ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${getStatusColor(selectedAgentData?.status || 'idle')} ${selectedAgentData?.status === 'working' ? 'animate-pulse' : ''}`} />
              {getStatusText(selectedAgentData?.status || 'idle')}
            </span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${selectedAgent ? agentColors[selectedAgent] : 'from-purple-500 to-violet-500'} bg-opacity-20 border border-purple-500/20 mb-4`}>
              <MessageSquare className="h-12 w-12 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Ciao! Sono il tuo assistente {selectedAgent?.replace('_', ' ')}
            </h2>
            <p className="text-slate-400 max-w-md">
              Scrivi un messaggio per iniziare la conversazione. Posso aiutarti con {selectedAgentData?.description.toLowerCase()}.
            </p>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-800/80 text-slate-100 border border-slate-700/50'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 border border-slate-700/50 p-4 rounded-2xl">
              <div className="flex space-x-2">
                <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce" />
                <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/80 backdrop-blur border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 group"
                >
                  {file.type === 'image' && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="h-8 w-8 object-cover rounded"
                    />
                  ) : file.type === 'video' && file.preview ? (
                    <video
                      src={file.preview}
                      className="h-8 w-8 object-cover rounded"
                    />
                  ) : file.type === 'pdf' ? (
                    <FileText className="h-5 w-5 text-red-400" />
                  ) : file.type === 'audio' ? (
                    <Music className="h-5 w-5 text-green-400" />
                  ) : file.type === 'video' ? (
                    <Video className="h-5 w-5 text-blue-400" />
                  ) : (
                    <File className="h-5 w-5 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-300 max-w-[150px] truncate">
                    {file.file.name}
                  </span>
                  <button
                    onClick={() => removeAttachedFile(index)}
                    className="p-1 hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-slate-400 hover:text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedAgent || isSending}
              className="px-4 py-4 bg-slate-800 border border-slate-700 text-slate-400 rounded-2xl hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Allega file"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={selectedAgent ? "Scrivi un messaggio..." : "Seleziona prima un agente"}
              disabled={!selectedAgent || isSending}
              autoFocus
              className="flex-1 px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition-all text-sm"
            />

            <button
              onClick={sendMessage}
              disabled={!selectedAgent || (!chatMessage.trim() && attachedFiles.length === 0) || isSending}
              className="px-6 py-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-2xl font-medium hover:from-purple-500 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ========================
  // MAIN RENDER
  // ========================

  return (
    <div className="h-screen flex bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-purple-500" />
            <span className="font-bold text-white">LAPA Control Room</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Centro di controllo agenti</p>
        </div>

        {/* Navigation */}
        <div className="p-2 space-y-1 border-b border-slate-800">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
              currentView === 'dashboard'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentView('unified-chat')}
            className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
              currentView === 'unified-chat'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <Radio className="h-5 w-5" />
            <span className="font-medium">Chat Unificata</span>
          </button>

          <button
            onClick={() => setCurrentView('activity')}
            className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
              currentView === 'activity'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <History className="h-5 w-5" />
            <span className="font-medium">Storico</span>
          </button>

          <button
            onClick={() => setCurrentView('alerts')}
            className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 justify-between ${
              currentView === 'alerts'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5" />
              <span className="font-medium">Alert</span>
            </div>
            {pendingAlerts > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {pendingAlerts}
              </span>
            )}
          </button>
        </div>

        {/* Agents List */}
        <div className="p-2">
          <p className="px-3 py-2 text-xs text-slate-500 uppercase tracking-wider">Agenti</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {agents.map((agent) => (
            <button
              key={agent.name}
              onClick={() => {
                setSelectedAgent(agent.name);
                setCurrentView('agent-chat');
                setChatHistory([]);
              }}
              className={`w-full p-3 rounded-xl text-left transition-all ${
                currentView === 'agent-chat' && selectedAgent === agent.name
                  ? 'bg-gradient-to-r from-purple-600/20 to-violet-600/20 border border-purple-500/30'
                  : 'hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${agentColors[agent.name]} bg-opacity-20`}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm capitalize truncate ${
                      currentView === 'agent-chat' && selectedAgent === agent.name ? 'text-white' : 'text-slate-300'
                    }`}>
                      {agent.name.replace('_', ' ')}
                    </p>
                    <span className={`h-2 w-2 rounded-full ${getStatusColor(agent.status)} ${agent.status === 'working' ? 'animate-pulse' : ''}`} />
                  </div>
                  <p className="text-xs text-slate-500 truncate">{agent.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {autoRefresh ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              Auto
            </button>
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-400 rounded-lg text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800 hover:bg-slate-700 text-slate-400 p-1.5 rounded-r-lg border border-l-0 border-slate-700 transition-all"
        style={{ left: sidebarOpen ? '288px' : '0' }}
      >
        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'unified-chat' && renderUnifiedChat()}
        {currentView === 'activity' && renderActivityView()}
        {currentView === 'alerts' && renderAlertsView()}
        {currentView === 'agent-chat' && renderAgentChat()}
      </div>
    </div>
  );
}
