interface Team {
  id: number;
  name: string;
  leader: string;
  memberIds: number[];
  memberCount: number;
  invoiced: number;
  invoicedTarget: number;
}

interface TeamSelectorProps {
  teams: Team[];
  selectedTeam: number | null;
  onTeamChange: (teamId: number) => void;
}

export function TeamSelector({ teams, selectedTeam, onTeamChange }: TeamSelectorProps) {
  return (
    <div className="flex items-center gap-4 bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg">
      <span className="text-2xl">👥</span>
      <div className="relative">
        <select
          value={selectedTeam || ''}
          onChange={(e) => onTeamChange(Number(e.target.value))}
          className="px-4 py-3 pr-10 border-2 border-white/30 rounded-lg bg-white/15 backdrop-blur-md text-white font-semibold cursor-pointer min-w-[280px] appearance-none focus:outline-none focus:border-white/80 focus:ring-4 focus:ring-white/20 transition-all"
        >
          <option value="" className="bg-slate-800 text-white">
            🔄 Seleziona un team...
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id} className="bg-slate-800 text-white">
              {team.name} ({team.memberCount} membri)
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white">
          ▼
        </div>
      </div>
    </div>
  );
}
