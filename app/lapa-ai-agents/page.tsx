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
  Sparkles,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Music,
  Video
} from 'lucide-react';

// Types
interface Agent {
  name: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  icon: React.ReactNode;
}

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'pdf' | 'audio' | 'video' | 'other';
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Create preview for images and videos
      if (fileType === 'image' || fileType === 'video') {
        attachedFile.preview = URL.createObjectURL(file);
      }

      newFiles.push(attachedFile);
    });

    setAttachedFiles(prev => [...prev, ...newFiles]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attached file
  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => {
      const newFiles = [...prev];
      // Revoke preview URL if exists
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
        // Remove the data:xxx;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Send message
  const sendMessage = async () => {
    if ((!chatMessage.trim() && attachedFiles.length === 0) || !selectedAgent) return;

    setIsSending(true);
    const userMessage = chatMessage;
    const filesToSend = [...attachedFiles];
    setChatMessage('');
    setAttachedFiles([]);

    // Build user message display
    let displayMessage = userMessage;
    if (filesToSend.length > 0) {
      const fileNames = filesToSend.map(f => f.file.name).join(', ');
      displayMessage = userMessage
        ? `${userMessage}\n\n📎 Allegati: ${fileNames}`
        : `📎 Allegati: ${fileNames}`;
    }

    setChatHistory(prev => [...prev, { role: 'user', content: displayMessage }]);

    try {
      // Prepare attachments as base64
      const attachments = await Promise.all(
        filesToSend.map(async (f) => ({
          filename: f.file.name,
          mimetype: f.file.type,
          data: await fileToBase64(f.file),
          size: f.file.size
        }))
      );

      const response = await fetch('/api/agents/chat/message', {
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
      // Clean up preview URLs
      filesToSend.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
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
              {/* Hidden File Input - accepts all media types */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Attach Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedAgent || isSending}
                className="px-4 py-4 bg-slate-800 border border-slate-700 text-slate-400 rounded-2xl hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Allega file"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={selectedAgent ? "Scrivi un messaggio..." : "Seleziona prima un agente"}
                disabled={!selectedAgent || isSending}
                className="flex-1 px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition-all text-sm"
              />

              {/* Send Button */}
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
    </div>
  );
}
