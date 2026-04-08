'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, Navigation, Users, TrendingUp, Clock, Search, ChevronDown, ArrowLeft, MessageSquare, Check, AlertCircle, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { clientiAlessandro, zoneConfig, tierConfig, type ClienteRecupero } from './clienti-data';

const ZONE = ['lunedi', 'mercoledi', 'giovedi'] as const;
const LS_KEY = 'recupero-clienti-note';

interface ClienteNoteData {
  stato: string;
  note: string;
  data: string;
}

function formatCHF(n: number) {
  return 'CHF ' + n.toLocaleString('de-CH');
}

function loadNotes(): Record<string, ClienteNoteData> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function saveNote(id: number, stato: string, note: string) {
  const notes = loadNotes();
  notes[id] = { stato, note, data: new Date().toISOString().split('T')[0] };
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
  return notes;
}

export default function RecuperoClientiPage() {
  const [zona, setZona] = useState<typeof ZONE[number]>('lunedi');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClienteRecupero | null>(null);
  const [notes, setNotes] = useState<Record<string, ClienteNoteData>>({});
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => { setNotes(loadNotes()); }, []);

  // Salva nota nel chatter Odoo + localStorage
  async function handleSaveNote(clientId: number, clientName: string, text: string) {
    setSavingNote(true);
    try {
      await fetch('/api/recupero-clienti/nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: clientId, note: text, autore: 'Mihai' }),
      });
    } catch (e) { console.error('Errore salvataggio Odoo:', e); }
    setNotes(saveNote(clientId, 'contattato', text));
    setEditingNote(null);
    setNoteText('');
    setSavingNote(false);
  }

  const clientiFiltrati = useMemo(() => {
    let list = clientiAlessandro.filter(c => c.zona === zona);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s));
    }
    return list;
  }, [zona, search]);

  const stats = useMemo(() => {
    const all = clientiAlessandro;
    const zonaClients = all.filter(c => c.zona === zona);
    return {
      totale: all.length,
      zonaCount: zonaClients.length,
      zonaFatturato: zonaClients.reduce((s, c) => s + c.fatturato2026, 0),
      tierA: zonaClients.filter(c => c.tier === 'A').length,
      tierB: zonaClients.filter(c => c.tier === 'B').length,
      tierC: zonaClients.filter(c => c.tier === 'C').length,
    };
  }, [zona]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const loadMap = async () => {
      const L = (await import('leaflet')).default;
      // @ts-ignore
      await import('leaflet/dist/leaflet.css');
      const map = L.map(mapRef.current!, { zoomControl: true }).setView([47.38, 8.54], 11);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        maxZoom: 19
      }).addTo(map);
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    };
    loadMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when zona/search changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const bounds: [number, number][] = [];

    clientiFiltrati.forEach(cl => {
      if (!cl.lat || !cl.lng) return;
      bounds.push([cl.lat, cl.lng]);

      const tierCfg = tierConfig[cl.tier];
      const zonaCfg = zoneConfig[cl.zona];

      const icon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${tierCfg.color}" stroke="#fff" stroke-width="1.5"/><circle cx="14" cy="14" r="6" fill="#fff" opacity="0.9"/></svg>`,
        className: '',
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -36]
      });

      const navigaUrl = `https://www.google.com/maps/dir/?api=1&destination=${cl.lat},${cl.lng}`;
      const phoneHtml = cl.phone ? `<a href="tel:${cl.phone}" style="color:#60A5FA;text-decoration:none">${cl.phone}</a>` : '<span style="color:#6B7280">N/D</span>';

      const odooUrl = `https://lapa-v2.odoo.com/web#id=${cl.id}&model=res.partner&view_type=form`;
      const popup = `
        <div style="font-family:system-ui;min-width:220px">
          <a href="${odooUrl}" target="_blank" rel="noopener" style="font-size:15px;font-weight:700;margin-bottom:4px;display:block;color:#60A5FA;text-decoration:none">${cl.name}</a>
          <div style="font-size:12px;color:#9CA3AF;margin-bottom:8px">${cl.street}, ${cl.zip} ${cl.city}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#9CA3AF">Telefono</span>${phoneHtml}
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#9CA3AF">Fatt. 2026</span>
            <span style="font-weight:700;color:${tierCfg.color}">${formatCHF(cl.fatturato2026)}</span>
          </div>
          ${cl.fatturato2025 > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#9CA3AF">Picco 2025</span>
            <span style="color:#F59E0B">${formatCHF(cl.fatturato2025)}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#9CA3AF">Ultimo ordine</span>
            <span>${cl.ultimoOrdine || 'N/D'}</span>
          </div>
          <a href="${navigaUrl}" target="_blank" rel="noopener" style="display:block;text-align:center;background:#3B82F6;color:#fff;padding:8px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px">
            📍 Naviga
          </a>
        </div>`;

      const marker = L.marker([cl.lat, cl.lng], { icon }).addTo(map).bindPopup(popup);
      marker.on('click', () => setSelectedClient(cl));
      markersRef.current.push(marker);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [clientiFiltrati]);

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      {/* Header — hidden in fullscreen */}
      <div className={`bg-gradient-to-r from-[#16213e] to-[#0f3460] px-4 py-4 shadow-lg ${mapFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-lg font-bold">Recupero Clienti Alessandro</h1>
            <p className="text-xs text-gray-400">{clientiAlessandro.length} clienti · 3 zone · Piano per Mihai</p>
          </div>
        </div>

        {/* Zone tabs */}
        <div className="flex gap-2 mb-3">
          {ZONE.map(z => {
            const cfg = zoneConfig[z];
            const count = clientiAlessandro.filter(c => c.zona === z).length;
            return (
              <button
                key={z}
                onClick={() => { setZona(z); setSearch(''); setSelectedClient(null); }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  zona === z
                    ? 'text-white shadow-lg'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                style={zona === z ? { backgroundColor: cfg.color + '33', borderColor: cfg.color, borderWidth: 1 } : {}}
              >
                <div className="font-bold">{cfg.label}</div>
                <div className="text-xs opacity-70">{count} clienti</div>
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="flex gap-2 text-xs">
          <div className="bg-white/5 rounded-lg px-3 py-1.5 flex-1 text-center">
            <div className="text-gray-400">Fatturato zona</div>
            <div className="font-bold text-sm">{formatCHF(stats.zonaFatturato)}</div>
          </div>
          <div className="bg-amber-500/10 rounded-lg px-3 py-1.5 text-center border border-amber-500/20">
            <div className="text-amber-400">Top</div>
            <div className="font-bold text-sm">{stats.tierA}</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg px-3 py-1.5 text-center border border-blue-500/20">
            <div className="text-blue-400">Medio</div>
            <div className="font-bold text-sm">{stats.tierB}</div>
          </div>
          <div className="bg-gray-500/10 rounded-lg px-3 py-1.5 text-center border border-gray-500/20">
            <div className="text-gray-400">Piccolo</div>
            <div className="font-bold text-sm">{stats.tierC}</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className={`relative ${mapFullscreen ? 'fixed inset-0 z-50' : ''}`}>
        <div ref={mapRef} className="w-full" style={{ height: mapFullscreen ? '100vh' : '40vh' }} />
        <button
          onClick={() => {
            setMapFullscreen(!mapFullscreen);
            setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
          }}
          className="absolute top-3 right-3 z-[1000] bg-[#16213e] hover:bg-[#1e3a5f] text-white p-2 rounded-lg shadow-lg border border-white/20"
        >
          {mapFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        {mapFullscreen && (
          <div className="absolute top-3 left-3 z-[1000] flex gap-1">
            {ZONE.map(z => {
              const cfg = zoneConfig[z];
              return (
                <button
                  key={z}
                  onClick={() => { setZona(z); setSearch(''); }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold shadow-lg transition-all ${zona === z ? 'text-white' : 'bg-[#16213e]/90 text-gray-300 hover:bg-[#1e3a5f]'}`}
                  style={zona === z ? { backgroundColor: cfg.color, borderColor: cfg.color } : { border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Search — hidden in fullscreen */}
      <div className={`px-4 py-3 bg-[#0f0f23] sticky top-0 z-10 ${mapFullscreen ? 'hidden' : ''}`}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Cerca cliente o città..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Client List — hidden in fullscreen */}
      <div className={`px-4 pb-20 ${mapFullscreen ? 'hidden' : ''}`}>
        {clientiFiltrati.map(cl => {
          const tierCfg = tierConfig[cl.tier];
          const navigaUrl = `https://www.google.com/maps/dir/?api=1&destination=${cl.lat},${cl.lng}`;
          return (
            <motion.div
              key={cl.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-3 rounded-xl border ${tierCfg.border} bg-white/[0.03] overflow-hidden`}
            >
              <div className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tierCfg.bg} ${tierCfg.text} font-bold`}>
                        {tierCfg.label}
                      </span>
                      <h3 className="font-semibold text-sm">{cl.name}</h3>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{cl.street}, {cl.zip} {cl.city}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm" style={{ color: tierCfg.color }}>{formatCHF(cl.fatturato2026)}</div>
                    <div className="text-xs text-gray-500">2026</div>
                  </div>
                </div>

                {cl.fatturato2025 > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-400 mt-1">
                    <TrendingUp size={12} />
                    <span>Picco 2025: {formatCHF(cl.fatturato2025)}</span>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {cl.phone && (
                    <a href={`tel:${cl.phone}`} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                      <Phone size={12} />{cl.phone}
                    </a>
                  )}
                  {cl.ultimoOrdine && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />{cl.ultimoOrdine}
                    </span>
                  )}
                </div>

                {(cl.note || notes[cl.id]?.note) && (
                  <div className="mt-2 text-xs text-yellow-400/80 bg-yellow-500/10 rounded px-2 py-1">
                    {cl.note && <span>💡 {cl.note}</span>}
                    {notes[cl.id]?.note && <div>📝 {notes[cl.id].note} <span className="text-gray-500">({notes[cl.id].data})</span></div>}
                  </div>
                )}

                {notes[cl.id]?.stato === 'contattato' && (
                  <div className="mt-1 text-xs text-green-400 flex items-center gap-1"><Check size={12} /> Contattato</div>
                )}

                {/* Note editing */}
                {editingNote === cl.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Scrivi nota..."
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveNote(cl.id, cl.name, noteText)}
                      disabled={savingNote}
                      className="bg-green-600 text-white text-xs px-3 rounded font-medium disabled:opacity-50 flex items-center gap-1"
                    >{savingNote ? <><Loader2 size={12} className="animate-spin" /> Salvo...</> : 'Salva'}</button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <a
                    href={navigaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                  >
                    <Navigation size={14} /> Naviga
                  </a>
                  {cl.phone && (
                    <a
                      href={`tel:${cl.phone}`}
                      className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      <Phone size={14} /> Chiama
                    </a>
                  )}
                  <button
                    onClick={() => { setEditingNote(editingNote === cl.id ? null : cl.id); setNoteText(notes[cl.id]?.note || ''); }}
                    className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    <MessageSquare size={14} /> Nota
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {clientiFiltrati.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>Nessun cliente trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}
