'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Brain,
  ShoppingCart,
  Package,
  Truck,
  Receipt,
  HeadphonesIcon,
  Megaphone,
  BarChart3,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

// Types
interface Agent {
  name: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  icon: React.ReactNode;
  lastAction?: string;
}

interface Approval {
  id: number;
  agent: string;
  action_type: string;
  description: string;
  requested_at: string;
}

interface Alert {
  id: number;
  agent: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  created_at: string;
}

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
  acquisti: 'Gestione fornitori, ordini acquisto, scorte',
  magazzino: 'Inventario, picking, ricevimento merce',
  vendite: 'Clienti, ordini vendita, preventivi',
  consegne: 'Pianificazione consegne, autisti, DDT',
  amministrazione: 'Fatturazione, pagamenti, contabilita',
  customer_service: 'Supporto clienti, reclami, assistenza',
  marketing: 'Social media, SEO, campagne',
  direzione: 'Report, KPI, analisi business',
};

export default function LapaAiAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [isSending, setIsSending] = useState(false);

  // Initialize with available agents
  useEffect(() => {
    const defaultAgents: Agent[] = [
      { name: 'acquisti', status: 'active', description: agentDescriptions.acquisti, icon: agentIcons.acquisti },
      { name: 'magazzino', status: 'inactive', description: agentDescriptions.magazzino, icon: agentIcons.magazzino },
      { name: 'vendite', status: 'inactive', description: agentDescriptions.vendite, icon: agentIcons.vendite },
      { name: 'consegne', status: 'inactive', description: agentDescriptions.consegne, icon: agentIcons.consegne },
      { name: 'amministrazione', status: 'inactive', description: agentDescriptions.amministrazione, icon: agentIcons.amministrazione },
      { name: 'customer_service', status: 'inactive', description: agentDescriptions.customer_service, icon: agentIcons.customer_service },
      { name: 'marketing', status: 'inactive', description: agentDescriptions.marketing, icon: agentIcons.marketing },
      { name: 'direzione', status: 'inactive', description: agentDescriptions.direzione, icon: agentIcons.direzione },
    ];
    setAgents(defaultAgents);
  }, []);

  // Send chat message
  const sendMessage = async () => {
    if (!chatMessage.trim() || !selectedAgent) return;

    setIsSending(true);
    const userMessage = chatMessage;
    setChatMessage('');

    // Add user message to history
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/agents/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessage,
          user_id: 1, // Paul
          channel: 'web',
          target_agent: selectedAgent
        })
      });

      const data = await response.json();

      if (data.content) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Errore di connessione con il backend.' }]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle approval decision
  const handleApproval = async (approvalId: number, approved: boolean) => {
    try {
      await fetch(`/api/agents/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          user_id: 1,
          notes: approved ? 'Approvato' : 'Rifiutato'
        })
      });

      // Remove from list
      setApprovals(prev => prev.filter(a => a.id !== approvalId));
    } catch (error) {
      console.error('Error processing approval:', error);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-600" />
            LAPA AI Agents
          </h1>
          <p className="text-gray-600 mt-1">
            Sistema di 8 agenti AI per gestione aziendale
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Agents Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agents Status */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agenti AI
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {agents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() => {
                    setSelectedAgent(agent.name);
                    setChatHistory([]);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedAgent === agent.name
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${agent.status === 'inactive' ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`${
                      agent.status === 'active' ? 'text-purple-600' : 'text-gray-400'
                    }`}>
                      {agent.icon}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${
                      agent.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  </div>
                  <p className="font-medium capitalize text-sm">{agent.name.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{agent.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Interface */}
          <div className="bg-white rounded-lg shadow-md border">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat con {selectedAgent ? selectedAgent.replace('_', ' ').toUpperCase() : 'Agente'}
              </h2>
              {selectedAgent && (
                <span className="text-sm text-gray-500">
                  Agente selezionato
                </span>
              )}
            </div>

            {/* Chat Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {!selectedAgent ? (
                <div className="text-center text-gray-500 py-10">
                  Seleziona un agente per iniziare la conversazione
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  Inizia una conversazione con l&apos;agente {selectedAgent.replace('_', ' ')}
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border shadow-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-white border shadow-sm p-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={selectedAgent ? "Scrivi un messaggio..." : "Seleziona prima un agente"}
                  disabled={!selectedAgent || isSending}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                />
                <button
                  onClick={sendMessage}
                  disabled={!selectedAgent || !chatMessage.trim() || isSending}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Invia
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Approvals & Alerts */}
        <div className="space-y-6">
          {/* Pending Approvals */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Approvazioni Pendenti
              {approvals.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                  {approvals.length}
                </span>
              )}
            </h2>

            {approvals.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                Nessuna approvazione pendente
              </p>
            ) : (
              <div className="space-y-3">
                {approvals.map((approval) => (
                  <div key={approval.id} className="p-3 border rounded-lg bg-orange-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{approval.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {approval.agent} - {new Date(approval.requested_at).toLocaleString('it-IT')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApproval(approval.id, true)}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approva
                      </button>
                      <button
                        onClick={() => handleApproval(approval.id, false)}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center justify-center gap-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Rifiuta
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Alert Attivi
              {alerts.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                  {alerts.length}
                </span>
              )}
            </h2>

            {alerts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                Nessun alert attivo
              </p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 border rounded-lg ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                      alert.severity === 'error' ? 'bg-orange-50 border-orange-200' :
                      alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-600' :
                        alert.severity === 'error' ? 'text-orange-600' :
                        alert.severity === 'warning' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{alert.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {alert.agent} - {new Date(alert.created_at).toLocaleString('it-IT')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-lg font-semibold mb-4">Statistiche Rapide</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {agents.filter(a => a.status === 'active').length}
                </p>
                <p className="text-xs text-gray-600">Agenti Attivi</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{approvals.length}</p>
                <p className="text-xs text-gray-600">Da Approvare</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{alerts.length}</p>
                <p className="text-xs text-gray-600">Alert</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">8</p>
                <p className="text-xs text-gray-600">Agenti Totali</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
