'use client';

import { User, Brain, Sparkles } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * ChatMessage Component
 *
 * Displays individual chat messages with:
 * - Role-based styling (user: blue, assistant: slate)
 * - Avatar icons (user: User icon, AI: Brain icon)
 * - Formatted timestamps
 * - Markdown-style rendering for AI responses
 * - Smooth fade-in animations
 */
export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  timestamp,
}: ChatMessageProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const isUser = role === 'user';
  const formattedTime = formatTimestamp(timestamp);

  return (
    <div
      className={`
        flex gap-3 transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${isUser ? 'flex-row-reverse' : 'flex-row'}
      `}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
          }
        `}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Brain className="w-4 h-4" />
        )}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`
            rounded-2xl px-4 py-2.5 shadow-sm
            ${isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-sm'
            }
          `}
        >
          {isUser ? (
            // User messages: plain text
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
          ) : (
            // Assistant messages: markdown-style rendering
            <div className="text-sm leading-relaxed">
              <MarkdownContent content={content} />
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-slate-500 px-2">
          {formattedTime}
        </span>
      </div>
    </div>
  );
});

/**
 * MarkdownContent Component
 *
 * Simple markdown-style rendering for AI responses:
 * - **bold** text
 * - Bullet lists (- item)
 * - Numbered lists (1. item)
 * - Line breaks
 */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let listKey = 0;

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.type;
      elements.push(
        <ListTag
          key={`list-${listKey++}`}
          className={`ml-4 my-2 space-y-1 ${
            currentList.type === 'ul' ? 'list-disc' : 'list-decimal'
          }`}
        >
          {currentList.items.map((item, idx) => (
            <li key={idx} className="text-slate-100">
              <RichText text={item} />
            </li>
          ))}
        </ListTag>
      );
      currentList = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(trimmed.substring(2));
      return;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numberedMatch[2]);
      return;
    }

    // Not a list item - flush any pending list
    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`br-${idx}`} className="h-2" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        <RichText text={line} />
      </p>
    );
  });

  // Flush any remaining list
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

/**
 * RichText Component
 *
 * Renders text with:
 * - **bold** formatting
 * - [text](url) clickable links
 * - Plain URLs (https://...)
 */
function RichText({ text }: { text: string }) {
  // Combined regex for bold, markdown links, and plain URLs
  // Order matters: check markdown links first, then bold, then plain URLs
  const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*.*?\*\*)|(https?:\/\/[^\s<>"{}|\\^\[\]`]+)/g;

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Markdown link: [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline hover:no-underline transition-colors"
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      // Bold: **text**
      const boldText = match[4].slice(2, -2);
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold text-white">
          {boldText}
        </strong>
      );
    } else if (match[5]) {
      // Plain URL
      parts.push(
        <a
          key={`url-${keyIndex++}`}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline hover:no-underline transition-colors break-all"
        >
          {match[5]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no special formatting found, return original text
  if (parts.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, idx) =>
        typeof part === 'string' ? <span key={`text-${idx}`}>{part}</span> : part
      )}
    </>
  );
}

/**
 * Formats timestamp to human-readable time
 * Examples: "Adesso", "2 min fa", "14:30"
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Adesso';
  if (diffMins < 60) return `${diffMins} min fa`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    // Today: show time
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Other days: show date and time
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
