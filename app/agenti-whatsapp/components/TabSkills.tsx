'use client';

import { useState, useEffect } from 'react';

export function TabSkills({ slug }: { slug: string }) {
  const [skills, setSkills] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agenti-whatsapp/${slug}/skills`)
      .then(r => r.json())
      .then(d => { setSkills(d.skills || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const loadSkill = async (name: string) => {
    setSelectedSkill(name);
    setSkillContent('Caricamento...');
    try {
      const res = await fetch(`/api/agenti-whatsapp/${slug}/skills?skill=${encodeURIComponent(name)}`);
      const data = await res.json();
      setSkillContent(data.content || 'Vuoto');
    } catch {
      setSkillContent('Errore nel caricamento');
    }
  };

  if (loading) return <p className="text-white/40">Caricamento skills...</p>;

  return (
    <div className="flex gap-4 h-[500px]">
      {/* Skills list */}
      <div className="w-1/3 overflow-y-auto space-y-1">
        {skills.length === 0 ? (
          <p className="text-white/40 text-sm">Nessuna skill trovata</p>
        ) : (
          skills.map(s => (
            <button
              key={s}
              onClick={() => loadSkill(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedSkill === s ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              {s.replace('.md', '')}
            </button>
          ))
        )}
      </div>
      {/* Skill content */}
      <div className="flex-1 bg-white/5 rounded-lg p-4 overflow-y-auto">
        {selectedSkill ? (
          <>
            <h3 className="text-sm font-bold text-white mb-3">{selectedSkill}</h3>
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">{skillContent}</pre>
          </>
        ) : (
          <p className="text-white/40 text-sm">Seleziona una skill per vederne il contenuto</p>
        )}
      </div>
    </div>
  );
}
