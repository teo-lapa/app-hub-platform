'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, ArrowLeft, Home, BarChart3, Wand2, Calendar, Zap
} from 'lucide-react';

const tabs = [
  { href: '/social-ai-studio', label: 'Studio Manuale', icon: Wand2 },
  { href: '/social-ai-studio/autopilot', label: 'AI Autopilot', icon: Zap, badge: 'NEW' },
  { href: '/social-ai-studio/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function SocialAILayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-purple-500/30 transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 text-purple-300 group-hover:text-white" />
                  <Home className="h-4 w-4 text-purple-300 group-hover:text-white" />
                </Link>

                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-2.5 sm:p-3 rounded-xl">
                    <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">Social Marketing AI Studio</h1>
                    <p className="text-[10px] sm:text-sm text-purple-300">
                      Powered by Gemini 2.5 Flash (Nano Banana) & Veo 3.1
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 pb-0 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = tab.href === '/social-ai-studio'
                ? pathname === '/social-ai-studio'
                : pathname?.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap
                    ${isActive
                      ? 'bg-slate-800/80 text-white border-t border-l border-r border-purple-500/50'
                      : 'text-purple-300/70 hover:text-purple-200 hover:bg-slate-800/30'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
