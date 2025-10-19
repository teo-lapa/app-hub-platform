/**
 * Maestro AI Chat Widget - Integration Examples
 *
 * This file shows different ways to integrate the ChatWidget
 * into your Next.js application.
 */

// ============================================================================
// Example 1: Root Layout Integration (Recommended)
// ============================================================================
// File: app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ChatWidget } from '@/components/maestro';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LAPA App - Fornitore Finest Italian Food',
  description: 'Piattaforma LAPA per grossisti alimentari.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}

          {/* Maestro AI Chat Widget - Available globally */}
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}

// ============================================================================
// Example 2: Conditional Rendering (Auth-gated)
// ============================================================================
// File: app/dashboard/layout.tsx

'use client';

import { ChatWidget } from '@/components/maestro';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {children}

      {/* Show chat only for authenticated users */}
      {isAuthenticated && <ChatWidget />}
    </div>
  );
}

// ============================================================================
// Example 3: Custom Wrapper with Analytics
// ============================================================================
// File: components/maestro/ChatWidgetWithAnalytics.tsx

'use client';

import { ChatWidget } from './ChatWidget';
import { useEffect } from 'react';

export function ChatWidgetWithAnalytics() {
  useEffect(() => {
    // Track chat widget mount
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'chat_widget_loaded', {
        event_category: 'maestro_ai',
        event_label: 'widget_available',
      });
    }
  }, []);

  return <ChatWidget />;
}

// Then in layout:
// import { ChatWidgetWithAnalytics } from '@/components/maestro/ChatWidgetWithAnalytics';
// <ChatWidgetWithAnalytics />

// ============================================================================
// Example 4: Programmatic Control
// ============================================================================
// File: components/custom/CustomChatTrigger.tsx

'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

/**
 * Custom trigger button that opens chat via state management
 * (Requires modifying ChatWidget to accept isOpen/onOpenChange props)
 */
export function CustomChatTrigger() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {/* Custom trigger button in navbar */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
      >
        <MessageCircle className="w-4 h-4" />
        Chiedi a Maestro
      </button>

      {/* Chat widget controlled externally */}
      {/* <ChatWidget isOpen={isChatOpen} onOpenChange={setIsChatOpen} /> */}
      {/* Note: Current implementation manages its own state */}
    </>
  );
}

// ============================================================================
// Example 5: Feature Flag Gating
// ============================================================================
// File: components/maestro/MaestroChatFeature.tsx

'use client';

import { ChatWidget } from './ChatWidget';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function MaestroChatFeature() {
  const isEnabled = useFeatureFlag('maestro_ai_chat');

  if (!isEnabled) {
    return null;
  }

  return <ChatWidget />;
}

// ============================================================================
// Example 6: Integration with Existing Chat System
// ============================================================================
// File: components/chat/UnifiedChatWidget.tsx

'use client';

import { useState } from 'react';
import { ChatWidget as MaestroChat } from '@/components/maestro';
import { SupportChat } from '@/components/support/SupportChat';

export function UnifiedChatWidget() {
  const [activeChat, setActiveChat] = useState<'maestro' | 'support' | null>(null);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {/* Maestro AI - Smart assistant */}
      <MaestroChat />

      {/* Human Support - Separate button */}
      {/* <SupportChat /> */}
    </div>
  );
}

// ============================================================================
// Example 7: SSR-Safe Implementation
// ============================================================================
// File: components/maestro/ClientOnlyChatWidget.tsx

'use client';

import dynamic from 'next/dynamic';
import { MessageCircle } from 'lucide-react';

/**
 * Dynamically import ChatWidget with no SSR
 * Useful if localStorage causes hydration issues
 */
const ChatWidget = dynamic(
  () => import('./ChatWidget').then((mod) => ({ default: mod.ChatWidget })),
  {
    ssr: false,
    loading: () => (
      <button className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center">
        <MessageCircle className="w-6 h-6" />
      </button>
    ),
  }
);

export function ClientOnlyChatWidget() {
  return <ChatWidget />;
}

// ============================================================================
// Example 8: Role-Based Access
// ============================================================================
// File: components/maestro/RoleBasedChatWidget.tsx

'use client';

import { ChatWidget } from './ChatWidget';
import { useUser } from '@/hooks/useUser';

const ALLOWED_ROLES = ['admin', 'sales_rep', 'driver'];

export function RoleBasedChatWidget() {
  const { user } = useUser();

  // Only show for specific roles
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  return <ChatWidget />;
}

// ============================================================================
// Example 9: Custom Styling Override
// ============================================================================
// File: components/maestro/BrandedChatWidget.tsx

'use client';

import { ChatWidget } from './ChatWidget';

/**
 * Wrapper with custom CSS variables for brand colors
 */
export function BrandedChatWidget() {
  return (
    <div
      style={{
        // Override default colors with CSS variables
        '--chat-primary': '#dc2626', // LAPA red
        '--chat-secondary': '#1e40af',
      } as React.CSSProperties}
    >
      <ChatWidget />
    </div>
  );
}

// ============================================================================
// Example 10: Integration with Context
// ============================================================================
// File: components/providers/ChatProvider.tsx

'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { ChatWidget } from '@/components/maestro';

interface ChatContextValue {
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (message: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value: ChatContextValue = {
    openChat: () => setIsOpen(true),
    closeChat: () => setIsOpen(false),
    sendMessage: (message) => {
      setIsOpen(true);
      // TODO: Pass message to ChatWidget
    },
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
      <ChatWidget />
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}

// Usage in a component:
// const { openChat, sendMessage } = useChat();
// <button onClick={() => sendMessage('Mostra route di oggi')}>Route</button>

// ============================================================================
// CURRENT RECOMMENDED INTEGRATION
// ============================================================================

/**
 * For immediate implementation, add to app/layout.tsx:
 *
 * import { ChatWidget } from '@/components/maestro';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html lang="it" suppressHydrationWarning>
 *       <body className={inter.className}>
 *         <ThemeProvider>
 *           {children}
 *           <ChatWidget />
 *         </ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
