'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Trash2,
  User as UserIcon,
  TrendingUp,
  MapPin,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useMaestroChat } from '@/hooks/useMaestroChat';

/**
 * ChatWidget Component
 *
 * Main Maestro AI chat interface with:
 * - Floating button (bottom-right with notification badge)
 * - Slide-in chat panel (400px on desktop, full screen on mobile)
 * - Message list with auto-scroll
 * - Quick action buttons
 * - Typing indicator
 * - Clear history option
 * - Dark mode compatible design
 */
export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, clearHistory, isTyping } = useMaestroChat();

  const hasMessages = messages.length > 0;
  const unreadCount = 0; // TODO: Implement unread count logic

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen]);

  // Hide welcome message after first interaction
  useEffect(() => {
    if (hasMessages) {
      setShowWelcome(false);
    }
  }, [hasMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleClearHistory = () => {
    if (confirm('Vuoi davvero cancellare tutta la cronologia chat?')) {
      clearHistory();
      setShowWelcome(true);
    }
  };

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`
          fixed bottom-6 right-6 z-40
          w-14 h-14 rounded-full
          bg-gradient-to-br from-blue-600 to-blue-700
          hover:from-blue-700 hover:to-blue-800
          text-white shadow-lg hover:shadow-xl
          transition-all duration-300 ease-out
          flex items-center justify-center
          group
          ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        aria-label="Apri chat Maestro AI"
      >
        <MessageCircle className="w-6 h-6 transition-transform group-hover:scale-110" />

        {/* Notification Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Pulse animation */}
        <span className="absolute inset-0 rounded-full bg-blue-500 opacity-0 group-hover:opacity-20 animate-ping" />
      </button>

      {/* Chat Panel */}
      <div
        className={`
          fixed bottom-0 right-0 z-50
          w-full md:w-[400px] h-full md:h-[600px]
          md:bottom-6 md:right-6 md:rounded-2xl
          bg-slate-950 border border-slate-800
          shadow-2xl
          flex flex-col
          transition-all duration-300 ease-out
          ${isOpen
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full md:translate-x-[450px] opacity-0 pointer-events-none'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Maestro AI</h2>
              <p className="text-xs text-slate-400">
                {isTyping ? 'Sta scrivendo...' : 'Il tuo assistente intelligente'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Clear History Button */}
            {hasMessages && (
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                aria-label="Cancella cronologia"
                title="Cancella cronologia"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={toggleChat}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Chiudi chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-950">
          {/* Welcome Message */}
          {showWelcome && !hasMessages && (
            <div className="text-center py-8 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Ciao! Sono Maestro AI
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Il tuo assistente intelligente per vendite e consegne.
                Chiedi pure quello che ti serve!
              </p>

              {/* Quick Action Buttons */}
              <div className="space-y-2">
                <QuickActionButton
                  icon={UserIcon}
                  label="Info sui miei clienti"
                  onClick={() => handleQuickAction('Mostrami le info sui miei clienti principali')}
                />
                <QuickActionButton
                  icon={MapPin}
                  label="Route di oggi"
                  onClick={() => handleQuickAction('Qual è il mio percorso di consegne di oggi?')}
                />
                <QuickActionButton
                  icon={TrendingUp}
                  label="Le mie performance"
                  onClick={() => handleQuickAction('Mostrami le mie performance recenti')}
                />
              </div>
            </div>
          )}

          {/* Messages List */}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions (shown when messages exist) */}
        {hasMessages && !isTyping && (
          <div className="px-4 py-2 border-t border-slate-800 bg-slate-950">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <QuickActionChip
                icon={UserIcon}
                label="Clienti"
                onClick={() => handleQuickAction('Info clienti')}
              />
              <QuickActionChip
                icon={MapPin}
                label="Route"
                onClick={() => handleQuickAction('Route oggi')}
              />
              <QuickActionChip
                icon={TrendingUp}
                label="Stats"
                onClick={() => handleQuickAction('Performance')}
              />
            </div>
          </div>
        )}

        {/* Input Area */}
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          disabled={isTyping}
        />
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleChat}
        />
      )}
    </>
  );
}

/**
 * QuickActionButton Component
 * Large button for welcome screen
 */
interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function QuickActionButton({ icon: Icon, label, onClick }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-600 hover:bg-slate-800 text-slate-300 hover:text-white transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-blue-600/10 group-hover:bg-blue-600/20 flex items-center justify-center text-blue-500 transition-colors">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

/**
 * QuickActionChip Component
 * Small chip for quick actions bar
 */
interface QuickActionChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function QuickActionChip({ icon: Icon, label, onClick }: QuickActionChipProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-blue-600 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium whitespace-nowrap transition-all"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
