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
    <div className="flex flex-wrap gap-3 mb-6">
      {/* Filter Buttons */}
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={`px-5 py-2.5 rounded-full border transition-all font-medium ${
            activeFilter === filter.id
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:shadow-sm'
          }`}
        >
          {filter.label}
        </button>
      ))}

      {/* Search Box */}
      <input
        type="text"
        placeholder="🔍 Cerca cliente..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-5 py-2.5 border border-slate-300 rounded-lg bg-white text-sm flex-grow md:flex-grow-0 md:w-72 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
      />
    </div>
  );
}
