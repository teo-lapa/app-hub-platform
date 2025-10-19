import { motion } from 'framer-motion';

export function KPICardSkeleton() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-slate-700 rounded w-24" />
          <div className="h-8 bg-slate-700 rounded w-32" />
        </div>
        <div className="h-12 w-12 bg-slate-700 rounded-lg" />
      </div>
      <div className="mt-4 h-4 bg-slate-700 rounded w-20" />
    </div>
  );
}

export function CustomerCardSkeleton() {
  return (
    <div className="border border-slate-700 bg-slate-800 rounded-lg p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 h-12 w-12 bg-slate-700 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-slate-700 rounded w-48" />
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="flex gap-2">
            <div className="h-6 bg-slate-700 rounded w-20" />
            <div className="h-6 bg-slate-700 rounded w-24" />
          </div>
          <div className="h-16 bg-slate-700 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-10 bg-slate-700 rounded w-32" />
          <div className="flex gap-2">
            <div className="h-10 w-10 bg-slate-700 rounded" />
            <div className="h-10 w-10 bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-10 bg-slate-700 rounded w-64 animate-pulse" />
          <div className="h-4 bg-slate-700 rounded w-48 animate-pulse" />
        </div>
        <div className="h-10 bg-slate-700 rounded w-32 animate-pulse" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-48 mb-4" />
          <div className="h-64 bg-slate-700 rounded" />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={`${sizeClasses[size]} border-4 border-slate-700 border-t-blue-500 rounded-full`}
      />
    </div>
  );
}
