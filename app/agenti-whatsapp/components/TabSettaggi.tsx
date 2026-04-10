'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import type { WhatsAppAgentConfig } from '@/lib/agents/whatsapp-agents';

interface ConfigData {
  agent: {
    name: string;
    model: string;
    maxTurns: { default: number; heavy?: number };
    whatsapp: string;
    owner: { name: string; number: string };
    pc: { ip: string; ssh: string; os: string };
  };
  claude: string | null;
  soul: string | null;
}

export function TabSettaggi({ slug, agent }: { slug: string; agent: WhatsAppAgentConfig }) {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [activeDoc, setActiveDoc] = useState<'claude' | 'soul' | null>(null);
  const [loading, setLoading] = useState(true);

  // QR state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrPolling, setQrPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/agenti-whatsapp/${slug}/config`)
      .then(r => r.json())
      .then(d => { setConfig(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const fetchQr = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch(`/api/agenti-whatsapp/${slug}/qr`);
      const data = await res.json();
      if (data.available && data.qr) {
        const dataUrl = await QRCode.toDataURL(data.qr, { width: 280, margin: 2 });
        setQrImage(dataUrl);
        setQrError(null);
        // Start polling to keep QR fresh
        if (!pollRef.current) {
          setQrPolling(true);
          pollRef.current = setInterval(async () => {
            try {
              const r = await fetch(`/api/agenti-whatsapp/${slug}/qr`);
              const d = await r.json();
              if (d.available && d.qr) {
                const img = await QRCode.toDataURL(d.qr, { width: 280, margin: 2 });
                setQrImage(img);
              } else {
                // Bot connected, stop polling
                setQrImage(null);
                setQrError('Agente connesso! QR non piu\' necessario.');
                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = null;
                setQrPolling(false);
              }
            } catch {}
          }, 15000);
        }
      } else {
        setQrImage(null);
        setQrError('Agente gia\' connesso a WhatsApp. QR disponibile solo quando il bot e\' disconnesso.');
      }
    } catch {
      setQrError('Errore di connessione al backend.');
    }
    setQrLoading(false);
  }, [slug]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const closeQr = () => {
    setQrImage(null);
    setQrError(null);
    setQrPolling(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  if (loading) return <p className="text-white/40">Caricamento settaggi...</p>;

  return (
    <div className="space-y-6">
      {/* Config summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <ConfigItem label="Modello" value={agent.model} />
        <ConfigItem label="Max Turns" value={`${agent.maxTurns.default}${agent.maxTurns.heavy ? ` / ${agent.maxTurns.heavy}` : ''}`} />
        <ConfigItem label="WhatsApp" value={agent.whatsapp} />
        <ConfigItem label="Proprietario" value={agent.owner.name} />
        <ConfigItem label="PC" value={`${agent.pc.ip} (${agent.pc.os})`} />
        <ConfigItem label="SSH" value={agent.pc.ssh} />
      </div>

      {/* QR Code WhatsApp */}
      <div>
        <button
          onClick={qrImage ? closeQr : fetchQr}
          disabled={qrLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50"
        >
          {qrLoading ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full" />
          ) : (
            <span>📱</span>
          )}
          {qrImage ? 'Chiudi QR' : 'QR Code WhatsApp'}
        </button>

        {qrImage && (
          <div className="mt-3 bg-white rounded-lg p-4 inline-block">
            <img src={qrImage} alt="WhatsApp QR Code" className="w-[280px] h-[280px]" />
            {qrPolling && (
              <p className="text-xs text-gray-500 mt-2 text-center">Aggiornamento automatico ogni 15s</p>
            )}
          </div>
        )}

        {qrError && (
          <p className="mt-3 text-sm text-yellow-400/80">{qrError}</p>
        )}
      </div>

      {/* CLAUDE.md / SOUL.md */}
      <div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveDoc(activeDoc === 'claude' ? null : 'claude')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDoc === 'claude' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            CLAUDE.md
          </button>
          <button
            onClick={() => setActiveDoc(activeDoc === 'soul' ? null : 'soul')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDoc === 'soul' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            SOUL.md
          </button>
        </div>
        {activeDoc && (
          <div className="bg-white/5 rounded-lg p-4 max-h-[400px] overflow-y-auto">
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">
              {config?.[activeDoc] || 'File non trovato'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}
