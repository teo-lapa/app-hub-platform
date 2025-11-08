interface ClientFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ClientFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange
}: ClientFiltersProps) {
  const filters = [
    { id: 'all', label: '🔄 Tutti', icon: '🔄' },
    { id: 'active', label: '✅ Attivi', icon: '✅' },
    { id: 'warning', label: '⚠️ Attenzione', icon: '⚠️' },
    { id: 'inactive', label: '❌ Inattivi', icon: '❌' },
    { id: 'inactive_5weeks', label: '📉 Non Attivi 5 Sett.', icon: '📉' },
    { id: 'decreasing_5weeks', label: '📉 In Calo 5 Sett.', icon: '📉' }
  ];

  return (
    <div className="mb-4 sm:mb-5 md:mb-6 space-y-3">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`px-2 sm:px-3 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full border transition-all font-medium text-xs sm:text-sm min-h-touch active:scale-95 ${
              activeFilter === filter.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:shadow-sm'
            }`}
          >
            <span className="sm:hidden">{filter.icon}</span>
            <span className="hidden sm:inline">{filter.label}</span>
          </button>
        ))}
      </div>

      {/* Search Box */}
      <div className="w-full">
        <input
          type="text"
          placeholder="🔍 Cerca cliente..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 border border-slate-300 rounded-lg bg-white text-sm md:text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition min-h-touch"
        />
      </div>
    </div>
  );
}
