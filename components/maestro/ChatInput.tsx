'use client';

import { Send, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';

export interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * ChatInput Component
 *
 * Chat input area with:
 * - Auto-resizing textarea (max 5 rows)
 * - Enter to send, Shift+Enter for new line
 * - Character counter
 * - Send button (disabled when empty or loading)
 * - Loading state with spinner
 */
export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Chiedi a Maestro AI...',
  maxLength = 500,
  disabled = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = message.length;
  const isOverLimit = characterCount > maxLength;
  const canSend = message.trim().length > 0 && !isLoading && !isOverLimit && !disabled;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120); // Max 5 rows (~24px per row)
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleSend = () => {
    if (!canSend) return;

    const trimmedMessage = message.trim();
    if (trimmedMessage) {
      onSend(trimmedMessage);
      setMessage('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900 p-4">
      <div className="flex items-end gap-2">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={`
              w-full resize-none rounded-lg px-4 py-3 pr-12
              bg-slate-800 border border-slate-700
              text-slate-100 placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              ${isOverLimit ? 'ring-2 ring-red-500 border-red-500' : ''}
            `}
            style={{
              maxHeight: '120px',
              minHeight: '48px',
            }}
          />

          {/* Character Counter */}
          <div
            className={`
              absolute bottom-2 right-2 text-xs tabular-nums
              ${isOverLimit
                ? 'text-red-400 font-semibold'
                : characterCount > maxLength * 0.8
                ? 'text-yellow-400'
                : 'text-slate-500'
              }
            `}
          >
            {characterCount}/{maxLength}
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            flex-shrink-0 w-12 h-12 rounded-lg
            flex items-center justify-center
            transition-all duration-200
            ${canSend
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }
          `}
          aria-label="Invia messaggio"
          title={
            isLoading
              ? 'Invio in corso...'
              : !message.trim()
              ? 'Scrivi un messaggio'
              : isOverLimit
              ? 'Messaggio troppo lungo'
              : 'Invia messaggio (Enter)'
          }
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Helper Text */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
            Enter
          </kbd>{' '}
          per inviare,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
            Shift+Enter
          </kbd>{' '}
          per nuova riga
        </span>

        {isOverLimit && (
          <span className="text-red-400 font-medium">
            Riduci di {characterCount - maxLength} caratteri
          </span>
        )}
      </div>
    </div>
  );
}
