'use client';

import { useState, useMemo } from 'react';
import { X, Search, User, Building2 } from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  city?: string;
  country?: string;
}

interface ExclusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: User[];
  excludedIds: number[];
  onSave: (excludedIds: number[]) => void;
  loading?: boolean;
  type: 'dipendenti' | 'clienti';
}

export default function ExclusionModal({
  isOpen,
  onClose,
  title,
  users,
  excludedIds,
  onSave,
  loading = false,
  type
}: ExclusionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>(excludedIds);

  // Reset when opening
  const handleOpen = () => {
    setSelectedIds(excludedIds);
    setSearchTerm('');
  };

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;

    const term = searchTerm.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      (user.department && user.department.toLowerCase().includes(term)) ||
      (user.city && user.city.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  const toggleUser = (userId: number) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = () => {
    onSave(selectedIds);
    onClose();
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      // Se tutti sono selezionati, deseleziona tutti
      setSelectedIds([]);
    } else {
      // Altrimenti seleziona tutti
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const allSelected = filteredUsers.length > 0 && selectedIds.length === filteredUsers.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-slate-800 rounded-xl border border-slate-600 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              {type === 'dipendenti' ? <Building2 className="h-6 w-6" /> : <User className="h-6 w-6" />}
              {title}
            </h2>
            <p className="text-slate-400 mt-1">
              Seleziona gli utenti da escludere
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per nome, email, reparto..."
              className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {selectedIds.length} utenti esclusi
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Nessun utente trovato
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map(user => {
                const isSelected = selectedIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30'
                        : 'bg-slate-700/30 border-slate-600 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{user.name}</span>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
                              Escluso
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400 mt-1">{user.email}</div>
                        {type === 'dipendenti' && (
                          <div className="flex gap-3 mt-2 text-xs text-slate-500">
                            {user.department && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {user.department}
                              </span>
                            )}
                            {user.jobTitle && <span>{user.jobTitle}</span>}
                          </div>
                        )}
                        {type === 'clienti' && (
                          <div className="flex gap-3 mt-2 text-xs text-slate-500">
                            {user.city && <span>{user.city}</span>}
                            {user.country && <span>{user.country}</span>}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5 rounded border-slate-600 text-red-500 focus:ring-red-500 focus:ring-offset-slate-800 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
          >
            Annulla
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              disabled={loading || filteredUsers.length === 0}
              className="px-6 py-3 bg-blue-600/20 border border-blue-500/50 text-blue-300 font-medium rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {allSelected ? '❌ Deseleziona tutti' : '✅ Seleziona tutti'}
            </button>

            <button
              onClick={handleSave}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-blue-600 transition-all"
            >
              Salva Selezione
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
