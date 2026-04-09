'use client';

export function AgentStatusBadge({ online, sshReachable }: { online: boolean; sshReachable: boolean }) {
  if (!sshReachable) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Offline
      </span>
    );
  }
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-400">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        PC On - Bot Fermo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      Online
    </span>
  );
}
