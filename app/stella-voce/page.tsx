'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'stella'; text: string; image?: string; images?: string[] };
type Phase = 'off' | 'listening' | 'recording' | 'thinking' | 'speaking';

export default function StellaVocePage() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>('off');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState('Tocca la sfera e parla con Stella');

  const phaseRef = useRef<Phase>('off');
  const activeRef = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micAnRef = useRef<AnalyserNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const lastLoudRef = useRef(0);
  const recStartRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // taratura rilevamento voce
  const SPEECH_ON = 0.05, SILENCE = 0.032, SILENCE_MS = 1100, MIN_SPEECH_MS = 350;

  function setPh(p: Phase) { phaseRef.current = p; setPhase(p); }

  function scrollBottom() { const el = scrollRef.current; if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight })); }
  useEffect(() => { scrollBottom(); }, [messages, phase]);
  useEffect(() => () => { cleanup(); }, []);

  function rms(an: AnalyserNode) {
    const buf = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / buf.length);
  }

  function startRecorder() {
    const stream = streamRef.current!;
    let mime = 'audio/webm;codecs=opus';
    if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mime)) {
      mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    }
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = () => send(new Blob(chunksRef.current, { type: mr.mimeType }));
    recRef.current = mr;
    mr.start();
  }

  function loop() {
    rafRef.current = requestAnimationFrame(loop);
    const ph = phaseRef.current;
    const t = performance.now();
    let level = 0;
    if (ph === 'speaking') level = 0.13 + 0.13 * Math.abs(Math.sin(t / 170));
    else if ((ph === 'listening' || ph === 'recording') && micAnRef.current) level = rms(micAnRef.current);
    else if (ph === 'thinking') level = 0.06 + 0.05 * Math.abs(Math.sin(t / 260));

    const orb = orbRef.current;
    if (orb) {
      const lv = Math.min(level, 0.5);
      orb.style.transform = `scale(${(1 + lv * 1.0).toFixed(3)})`;
      const glow = 26 + lv * 150;
      const c = ph === 'recording' ? '255,96,96' : ph === 'speaking' ? '176,124,255' : ph === 'thinking' ? '120,166,255' : '54,150,255';
      orb.style.boxShadow = `0 0 ${glow.toFixed(0)}px rgba(${c},.8), inset 0 0 50px rgba(255,255,255,.22)`;
      orb.style.background = `radial-gradient(circle at 36% 30%, rgba(${c},1), rgba(${c},.28))`;
    }

    if (ph === 'listening') {
      if (level > SPEECH_ON) { recStartRef.current = t; lastLoudRef.current = t; startRecorder(); setPh('recording'); setStatus('Ti ascolto…'); }
    } else if (ph === 'recording') {
      if (level > SILENCE) lastLoudRef.current = t;
      if (t - lastLoudRef.current > SILENCE_MS && t - recStartRef.current > MIN_SPEECH_MS) {
        const mr = recRef.current;
        if (mr && mr.state !== 'inactive') mr.stop();
        setPh('thinking'); setStatus('Stella sta pensando…');
      }
    }
  }

  async function send(blob: Blob) {
    const fd = new FormData();
    fd.append('audio', blob, 'audio.webm');
    try {
      const res = await fetch('/api/stella-voce', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.transcript) setMessages(m => [...m, { role: 'user', text: data.transcript }]);
      if (data.error) { setMessages(m => [...m, { role: 'stella', text: '⚠️ ' + data.error }]); resumeListen(); return; }
      setMessages(m => [...m, { role: 'stella', text: data.reply, images: data.images }]);
      if (data.audio) playAudio(data.audio);
      else speakFallback(data.reply);
    } catch {
      setMessages(m => [...m, { role: 'stella', text: '⚠️ Connessione interrotta' }]);
      resumeListen();
    }
  }

  function playAudio(url: string) {
    const el = audioElRef.current!;
    setPh('speaking'); setStatus('Stella sta parlando…');
    el.src = url;
    el.onended = () => resumeListen();
    el.play().catch(() => resumeListen());
  }

  function speakFallback(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT';
      u.onend = () => resumeListen();
      speechSynthesis.cancel(); setPh('speaking'); setStatus('Stella sta parlando…');
      speechSynthesis.speak(u);
    } catch { resumeListen(); }
  }

  function resumeListen() {
    if (!activeRef.current) { setPh('off'); return; }
    lastLoudRef.current = performance.now();
    setPh('listening'); setStatus('Parla pure, ti ascolto');
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an); micAnRef.current = an;
      activeRef.current = true; setActive(true);
      lastLoudRef.current = performance.now();
      setPh('listening'); setStatus('Parla pure, ti ascolto');
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setStatus('Non riesco ad accedere al microfono. Concedi il permesso e riprova.');
    }
  }

  function cleanup() {
    try { cancelAnimationFrame(rafRef.current); } catch {}
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { speechSynthesis.cancel(); } catch {}
    try { audioElRef.current?.pause(); } catch {}
    try { ctxRef.current?.close(); } catch {}
    ctxRef.current = null; streamRef.current = null; micAnRef.current = null;
  }

  function stop() {
    activeRef.current = false; setActive(false);
    cleanup();
    setPh('off'); setStatus('Conversazione terminata. Tocca per ricominciare.');
  }

  async function newChat() {
    setMessages([]);
    const fd = new FormData(); fd.append('reset', '1'); fd.append('text', '');
    try { await fetch('/api/stella-voce', { method: 'POST', body: fd }); } catch {}
    setStatus(active ? 'Nuova conversazione. Parla pure.' : 'Nuova conversazione.');
  }

  async function sendImage(file: File) {
    setPh('thinking'); setStatus('Stella sta guardando la foto…');
    const fd = new FormData(); fd.append('image', file, 'foto.jpg');
    try {
      const res = await fetch('/api/stella-voce', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) { setMessages(m => [...m, { role: 'stella', text: '⚠️ ' + data.error }]); resumeListen(); return; }
      setMessages(m => [...m, { role: 'stella', text: data.reply, images: data.images }]);
      if (data.audio) playAudio(data.audio); else speakFallback(data.reply);
    } catch {
      setMessages(m => [...m, { role: 'stella', text: '⚠️ Connessione interrotta' }]); resumeListen();
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setMessages(m => [...m, { role: 'user', text: '', image: String(reader.result) }]); sendImage(file); };
    reader.readAsDataURL(file);
  }

  function renderText(text: string) {
    if (!text) return null;
    const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
    const out: React.ReactNode[] = [];
    let last = 0, k = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[1] && m[2]) out.push(<a key={k++} href={m[2]} target="_blank" rel="noreferrer" style={linkStyle}>{m[1]}</a>);
      else if (m[3]) { const lbl = m[3].replace(/^https?:\/\//, '').split('/')[0]; out.push(<a key={k++} href={m[3]} target="_blank" rel="noreferrer" style={linkStyle}>🔗 {lbl}</a>); }
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  const phaseLabel: Record<Phase, string> = {
    off: 'STELLA', listening: 'IN ASCOLTO', recording: 'TI ASCOLTO', thinking: 'STO PENSANDO', speaking: 'STELLA PARLA',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(circle at 50% -10%, #11244a, #060b16 60%)', color: '#eaf1ff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      <audio ref={audioElRef} hidden />

      <header style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid rgba(120,160,255,.12)' }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: phase === 'off' ? '#5f7bb0' : '#7da8ff' }}>
          {phase === 'off' ? '○ OFFLINE' : '● ' + phaseLabel[phase]}
        </div>
        <h1 style={{ fontSize: 20, margin: '4px 0 0', fontWeight: 700 }}>Stella</h1>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', opacity: .45, marginTop: 24, lineHeight: 1.7, fontSize: 14 }}>
            Avvia e parla naturalmente:<br />“Come stiamo con gli ordini oggi?”<br />“Leggimi le email importanti”<br />“Come stanno i PC?”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? '#1f6feb' : 'rgba(255,255,255,.08)', padding: '9px 13px', borderRadius: 15, borderBottomRightRadius: m.role === 'user' ? 4 : 15, borderBottomLeftRadius: m.role === 'stella' ? 4 : 15, whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 14 }}>
            {m.image && <img src={m.image} alt="" onLoad={scrollBottom} style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginBottom: m.text ? 8 : 0 }} />}
            {renderText(m.text)}
            {m.images && m.images.map((src, j) => src.startsWith('data:application/pdf')
              ? <a key={j} href={src} target="_blank" rel="noreferrer" style={{ ...linkStyle, display: 'inline-block', marginTop: 8 }}>📄 Apri PDF</a>
              : <img key={j} src={src} alt="" onLoad={scrollBottom} style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />)}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 16px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 13, opacity: .75, minHeight: 18, textAlign: 'center' }}>{status}</div>

        <button
          onClick={active ? stop : start}
          aria-label="Parla con Stella"
          style={{
            width: 132, height: 132, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
            background: 'transparent', position: 'relative', outline: 'none',
          }}
        >
          <div ref={orbRef} style={{
            width: 132, height: 132, borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, rgba(54,150,255,1), rgba(54,150,255,.28))',
            boxShadow: '0 0 26px rgba(54,150,255,.8), inset 0 0 50px rgba(255,255,255,.22)',
            transition: 'background .25s', willChange: 'transform',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
          }}>
            {active ? '' : '🎤'}
          </div>
        </button>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickImage} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => fileRef.current?.click()} style={btnStyle}>📷 Foto</button>
          {active && <button onClick={stop} style={btnStyle}>■ Termina</button>}
          <button onClick={newChat} style={btnStyle}>Nuova conversazione</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(120,160,255,.3)', color: '#9bb8ff',
  borderRadius: 20, padding: '6px 16px', fontSize: 12, cursor: 'pointer',
};

const linkStyle: React.CSSProperties = {
  color: '#7db4ff', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-word',
};
