'use client';

import { useState, useEffect, useRef } from 'react';
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
  Sparkles
} from 'lucide-react';

// Types
interface Agent {
  name: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  icon: React.ReactNode;
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
  acquisti: 'Fornitori, ordini, scorte',
  magazzino: 'Inventario, picking',
  vendite: 'Clienti, preventivi',
  consegne: 'Consegne, autisti',
  amministrazione: 'Fatture, pagamenti',
  customer_service: 'Supporto clienti',
  marketing: 'Social, campagne',
  direzione: 'Report, KPI',
};

export default function LapaAiAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>('acquisti');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Initialize agents
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

  // Send message
  const sendMessage = async () => {
    if (!chatMessage.trim() || !selectedAgent) return;

    setIsSending(true);
    const userMessage = chatMessage;
    setChatMessage('');

    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/agents/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessage,
          user_id: 1,
          channel: 'web',
          target_agent: selectedAgent
        })
      });

      const data = await response.json();

      if (data.content) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.content }]);
      } else if (data.error) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: `Errore: ${data.error}` }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Errore di connessione.' }]);
    } finally {
      setIsSending(false);
    }
  };

  const selectedAgentData = agents.find(a => a.name === selectedAgent);

  return (
    <div className="h-screen flex bg-slate-950 overflow-hidden">
      {/* Sidebar - Agents */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-purple-500" />
            <span className="font-bold text-white">LAPA AI</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">8 Agenti Intelligenti</p>
        </div>

        {/* Agents List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {agents.map((agent) => (
            <button
              key={agent.name}
              onClick={() => {
                setSelectedAgent(agent.name);
                setChatHistory([]);
              }}
              className={`w-full p-3 rounded-xl text-left transition-all ${
                selectedAgent === agent.name
                  ? 'bg-gradient-to-r from-purple-600/20 to-violet-600/20 border border-purple-500/30'
                  : 'hover:bg-slate-800/50 border border-transparent'
              } ${agent.status === 'inactive' ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  selectedAgent === agent.name ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm capitalize truncate ${
                      selectedAgent === agent.name ? 'text-white' : 'text-slate-300'
                    }`}>
                      {agent.name.replace('_', ' ')}
                    </p>
                    {agent.status === 'active' && (
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{agent.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-800 hover:bg-slate-700 text-slate-400 p-1.5 rounded-r-lg border border-l-0 border-slate-700 transition-all"
        style={{ left: sidebarOpen ? '256px' : '0' }}
      >
        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-6 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedAgentData && (
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20">
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
            <span className="text-xs text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </span>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 mb-4">
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
          <div className="max-w-4xl mx-auto flex gap-3">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={selectedAgent ? "Scrivi un messaggio..." : "Seleziona prima un agente"}
              disabled={!selectedAgent || isSending}
              className="flex-1 px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition-all text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!selectedAgent || !chatMessage.trim() || isSending}
              className="px-6 py-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-2xl font-medium hover:from-purple-500 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
