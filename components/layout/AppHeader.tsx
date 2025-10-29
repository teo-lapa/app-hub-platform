'use client';

import { ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  icon,
  showHomeButton = true,
  showBackButton = false,
  onBack,
  rightElement,
  className = ''
}: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className={`bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              {/* Navigation Buttons */}
              <div className="flex items-center space-x-2">
                {showHomeButton && (
                  <Link
                    href="/"
                    className="flex items-center space-x-2 px-4 py-3 min-h-[48px] bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors group"
                  >
                    <ArrowLeft className="h-5 w-5 text-slate-300 group-hover:text-white" />
                    <Home className="h-5 w-5 text-slate-300 group-hover:text-white" />
                    <span className="text-slate-300 group-hover:text-white font-medium">Home</span>
                  </Link>
                )}

                {showBackButton && (
                  <button
                    onClick={handleBack}
                    className="flex items-center space-x-2 px-4 py-3 min-h-[48px] bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors group"
                  >
                    <ArrowLeft className="h-5 w-5 text-slate-300 group-hover:text-white" />
                    <span className="text-slate-300 group-hover:text-white font-medium">Indietro</span>
                  </button>
                )}
              </div>

              {/* App Title and Icon */}
              <div className="flex items-center space-x-3">
                {icon && (
                  <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-3 rounded-xl">
                    {icon}
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-white">{title}</h1>
                  {subtitle && (
                    <p className="text-slate-300">{subtitle}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Element (stats, user info, etc.) */}
            {rightElement && (
              <div className="mt-4 lg:mt-0">
                {rightElement}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile Floating Home Button Component
interface MobileHomeButtonProps {
  className?: string;
}

export function MobileHomeButton({ className = '' }: MobileHomeButtonProps) {
  return (
    <div className={`fixed bottom-6 right-6 md:hidden z-50 ${className}`}>
      <Link
        href="/"
        className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110"
      >
        <Home className="h-6 w-6" />
      </Link>
    </div>
  );
}