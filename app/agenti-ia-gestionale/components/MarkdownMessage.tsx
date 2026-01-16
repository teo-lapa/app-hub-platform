'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export default function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  return (
    <div className={`markdown-message ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mb-3 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-emerald-400 mb-2 mt-3 first:mt-0">{children}</h3>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm text-slate-200 mb-2 leading-relaxed">{children}</p>
          ),

          // Bold/Strong
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1 text-sm text-slate-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1 text-sm text-slate-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-200">{children}</li>
          ),

          // Tables - Styled for dark mode
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-600">
              <table className="min-w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-700/80">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-600/50">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-700/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-emerald-400 whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-200 whitespace-nowrap">{children}</td>
          ),

          // Code blocks
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-slate-700 px-1.5 py-0.5 rounded text-emerald-400 text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-slate-800 p-3 rounded-lg text-sm font-mono text-slate-200 overflow-x-auto my-2">
                {children}
              </code>
            );
          },

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              {children}
            </a>
          ),

          // Horizontal rule
          hr: () => <hr className="border-slate-600 my-3" />,

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500 pl-3 my-2 text-slate-300 italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
