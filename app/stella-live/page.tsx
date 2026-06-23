'use client';

/**
 * STELLA LIVE - Assistente vocale in tempo reale (OpenAI Realtime via WebRTC).
 * La voce fa da ORCHESTRATORE: chiacchiera e si lascia interrompere, e per
 * qualsiasi cosa LAPA chiama il tool `chiedi_a_stella` che inoltra al cervello
 * vero (claude -p sul PC STELLA, via /api/stella-live/ask). Mentre Claude pensa
 * la voce tiene compagnia; quando arriva la risposta la legge e la si discute.
 */
import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'stella'; text: string; images?: string[] };
type Phase = 'off' | 'connecting' | 'listening' | 'speaking' | 'thinking';

const INSTRUCTIONS = [
  'Sei Stella, l\'assistente vocale personale di Paul (titolare di LAPA). Parli SEMPRE in italiano,',
  'con tono caldo, naturale e sicuro, come una collega di fiducia al telefono. Frasi BREVI e parlate',
  '(spesso sei in viva voce in auto). Ti puoi lasciare interrompere: se Paul parla, fermati e ascolta.',
  '',
  'REGOLA FONDAMENTALE: tu NON hai accesso ai dati di LAPA. Per QUALSIASI cosa riguardi l\'azienda',
  '(ordini, clienti, email, fatture, pagamenti, magazzino, scorte, consegne, telecamere, prodotti,',
  'fornitori, contabilita, o qualunque numero/dato reale, e per ogni AZIONE su Odoo) devi SEMPRE',
  'chiamare il tool chiedi_a_stella. Non inventare MAI dati: se non li hai, usali il tool.',
  'Subito PRIMA di chiamare il tool, di\' a voce una frase breve tipo "un attimo, controllo" cosi',
  'Paul non resta nel vuoto. Quando ricevi il risultato, riferiscilo in modo naturale e discutilo;',
  'riporta solo quello che torna dal tool, senza aggiungere numeri non presenti.',
  '',
  'Le chiacchiere, i saluti, le riformulazioni e i chiarimenti li gestisci tu direttamente, senza tool.',
  'Per cose importanti o irreversibili, prima ripeti a voce cosa stai per fare e aspetta l\'OK di Paul.',
  '',
  'LINGUA: Paul parla quasi sempre ITALIANO, a volte TEDESCO o RUMENO. Rispondi SEMPRE in italiano,',
  'salvo che ti parli chiaramente in tedesco o rumeno e voglia risposta in quella lingua.',
  'NON interpretare MAI l\'audio come lingue asiatiche (giapponese, cinese, coreano) o altre lingue strane:',
  'se senti un suono breve, un respiro o qualcosa di poco chiaro, IGNORALO e aspetta in silenzio, non rispondere a vuoto.',
].join(' ');

export default function StellaLivePage() {
  const [phase, setPhase] = useState<Phase>('off');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState('Tocca la sfera e parla con Stella in tempo reale');
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [typed, setTyped] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [notif, setNotif] = useState(0);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);

  const phaseRef = useRef<Phase>('off');
  const activeRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const micAnRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const wakeRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingTextRef = useRef<string>('');
  const dispatchingRef = useRef(false);
  const responseActiveRef = useRef(false);
  const suppressRespIdRef = useRef<string | null>(null);
  const armSuppressRef = useRef(false);
  const handledCalls = useRef<Set<string>>(new Set());

  function setPh(p: Phase) { phaseRef.current = p; setPhase(p); }
  function send(obj: any) { const dc = dcRef.current; if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)); }
  // crea una risposta del modello, annullando prima quella eventualmente attiva (evita "active response")
  function requestResponse() { if (responseActiveRef.current) send({ type: 'response.cancel' }); send({ type: 'response.create' }); }
  function scrollBottom() { const el = scrollRef.current; if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight })); }

  useEffect(() => { scrollBottom(); }, [messages, phase]);
  useEffect(() => () => { cleanup(); }, []);
  useEffect(() => {
    fetch('/api/stella-live/session').then(r => r.json()).then(d => setAuthed(!!d.authed)).catch(() => setAuthed(true));
  }, []);
  useEffect(() => {
    if (authed) fetch('/api/stella-voce/notifs').then(r => r.json()).then(d => { setNotif(d.count || 0); setNotifItems(d.items || []); }).catch(() => {});
  }, [authed]);
  useEffect(() => {
    const h = (e: any) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible' && activeRef.current && !wakeRef.current) {
        try { wakeRef.current = await (navigator as any).wakeLock?.request('screen'); wakeRef.current?.addEventListener?.('release', () => { wakeRef.current = null; }); } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  function goLogin() { window.location.href = '/?redirect=' + encodeURIComponent('/stella-live'); }

  async function installApp() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch {}
    setInstallEvt(null);
  }

  function rms(an: AnalyserNode) {
    const buf = new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / buf.length);
  }

  function loop() {
    rafRef.current = requestAnimationFrame(loop);
    const ph = phaseRef.current;
    const t = performance.now();
    let level = 0;
    if (ph === 'speaking') level = 0.14 + 0.13 * Math.abs(Math.sin(t / 160));
    else if (ph === 'thinking') level = 0.06 + 0.05 * Math.abs(Math.sin(t / 260));
    else if (ph === 'listening' && micAnRef.current) level = rms(micAnRef.current);

    const orb = orbRef.current;
    if (orb) {
      const lv = Math.min(level, 0.5);
      orb.style.transform = `scale(${(1 + lv * 1.0).toFixed(3)})`;
      const glow = 26 + lv * 150;
      const c = ph === 'speaking' ? '176,124,255' : ph === 'thinking' ? '120,166,255' : ph === 'listening' ? '54,200,180' : '54,150,255';
      orb.style.boxShadow = `0 0 ${glow.toFixed(0)}px rgba(${c},.8), inset 0 0 50px rgba(255,255,255,.22)`;
      orb.style.background = `radial-gradient(circle at 36% 30%, rgba(${c},1), rgba(${c},.28))`;
    }
  }

  function sessionUpdate() {
    return {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: INSTRUCTIONS,
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: { model: 'gpt-4o-mini-transcribe', language: 'it', prompt: 'Conversazione di lavoro in italiano (a volte tedesco o rumeno). Azienda alimentare LAPA: ordini, clienti, fornitori, magazzino, consegne, fatture, prodotti.' },
            // meno sensibile: soglia piu alta (ignora respiri/rumori) e attesa silenzio piu lunga (non taglia sulle pause)
            turn_detection: { type: 'server_vad', threshold: 0.62, prefix_padding_ms: 300, silence_duration_ms: 1100, create_response: true, interrupt_response: true },
          },
          output: { voice: process.env.NEXT_PUBLIC_STELLA_VOICE || 'marin' },
        },
        tools: [{
          type: 'function',
          name: 'chiedi_a_stella',
          description: 'Inoltra al cervello LAPA QUALSIASI richiesta che riguardi dati o operativita aziendale: ordini, clienti, email, fatture, pagamenti, magazzino, scorte, consegne, telecamere, prodotti, fornitori, contabilita, e ogni azione su Odoo. Usa SEMPRE questo tool per dare risposte concrete: non rispondere a memoria.',
          parameters: {
            type: 'object',
            properties: { domanda: { type: 'string', description: 'La richiesta dell\'utente in italiano, riformulata in modo chiaro, completo e autonomo.' } },
            required: ['domanda'],
          },
        }],
        tool_choice: 'auto',
      },
    };
  }

  async function start() {
    if (activeRef.current || phaseRef.current === 'connecting') return;
    setPh('connecting'); setStatus('Connessione a Stella…');
    try {
      const tokenRes = await fetch('/api/stella-live/session', { method: 'POST' });
      const td = await tokenRes.json();
      if (tokenRes.status === 403 || td.needLogin) { setAuthed(false); setPh('off'); return; }
      if (!td.value) throw new Error(td.error || 'Token non disponibile');

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => { if (audioElRef.current) audioElRef.current.srcObject = e.streams[0]; };
      pc.onconnectionstatechange = () => {
        if (activeRef.current && ['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          stop(); setStatus('Connessione persa. Tocca per riprovare.');
        }
      };

      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micStreamRef.current = mic;
      mic.getTracks().forEach(tr => pc.addTrack(tr, mic));

      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx(); ctxRef.current = ctx; await ctx.resume();
      const srcNode = ctx.createMediaStreamSource(mic);
      const an = ctx.createAnalyser(); an.fftSize = 1024; srcNode.connect(an); micAnRef.current = an;

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onopen = () => {
        send(sessionUpdate());
        activeRef.current = true;
        setPh('listening'); setStatus('Parla pure, ti ascolto');
        rafRef.current = requestAnimationFrame(loop);
        if (pendingTextRef.current) { const t = pendingTextRef.current; pendingTextRef.current = ''; setTimeout(() => sendUserText(t), 250); }
      };
      dc.onmessage = (e) => { try { handleEvent(JSON.parse(e.data)); } catch {} };
      dc.onclose = () => { if (activeRef.current) { stop(); setStatus('Connessione chiusa. Tocca per riprovare.'); } };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST', body: offer.sdp,
        headers: { Authorization: 'Bearer ' + td.value, 'Content-Type': 'application/sdp' },
      });
      if (!sdpRes.ok) throw new Error('OpenAI ' + sdpRes.status);
      const answer = { type: 'answer' as RTCSdpType, sdp: await sdpRes.text() };
      await pc.setRemoteDescription(answer);

      try { wakeRef.current = await (navigator as any).wakeLock?.request('screen'); wakeRef.current?.addEventListener?.('release', () => { wakeRef.current = null; }); } catch {}
    } catch (err: any) {
      setMessages(m => [...m, { role: 'stella', text: '⚠️ Non riesco a connettermi: ' + (err?.message || 'errore') }]);
      cleanup(); setPh('off'); setStatus('Connessione fallita. Riprova.');
    }
  }

  function handleEvent(ev: any) {
    const t = ev.type as string;
    const respId = ev.response_id || ev.response?.id || null;
    if (t === 'response.created') {
      responseActiveRef.current = true;
      if (armSuppressRef.current) { suppressRespIdRef.current = respId; armSuppressRef.current = false; }
    }
    else if (t === 'input_audio_buffer.speech_started') { if (phaseRef.current !== 'thinking') setPh('listening'); setStatus('Ti ascolto…'); }
    else if (t === 'conversation.item.input_audio_transcription.completed' || t === 'input_audio_transcription.completed') {
      if (ev.transcript) setMessages(m => [...m, { role: 'user', text: ev.transcript }]);
    }
    else if (t === 'output_audio_buffer.started' || t === 'response.output_audio.delta' || t === 'response.audio_transcript.delta') {
      if (phaseRef.current !== 'thinking') { setPh('speaking'); setStatus('Stella sta parlando…'); }
    }
    else if (t === 'response.output_audio_transcript.done' || t === 'response.audio_transcript.done') {
      // salta solo il transcript della risposta che ha letto il risultato di Claude (gia mostrato come bolla autorevole)
      if (suppressRespIdRef.current && respId === suppressRespIdRef.current) { suppressRespIdRef.current = null; }
      else if (ev.transcript) setMessages(m => [...m, { role: 'stella', text: ev.transcript }]);
    }
    else if (t === 'response.function_call_arguments.done') {
      if (ev.name === 'chiedi_a_stella') { let d = ''; try { d = JSON.parse(ev.arguments || '{}').domanda || ''; } catch {} dispatchToClaude(d, ev.call_id); }
    }
    else if (t === 'response.output_item.done' && ev.item?.type === 'function_call') {
      if (ev.item.name === 'chiedi_a_stella') { let d = ''; try { d = JSON.parse(ev.item.arguments || '{}').domanda || ''; } catch {} dispatchToClaude(d, ev.item.call_id); }
    }
    else if (t === 'response.done') { responseActiveRef.current = false; if (!dispatchingRef.current) resumeIdle(); }
    else if (t === 'error') {
      const msg = ev.error?.message || 'errore realtime';
      setMessages(m => [...m, { role: 'stella', text: '⚠️ ' + msg }]);
    }
  }

  async function dispatchToClaude(domanda: string, callId: string) {
    if (!callId || handledCalls.current.has(callId)) return;
    handledCalls.current.add(callId);
    dispatchingRef.current = true;
    setPh('thinking'); setStatus('Stella sta controllando…');
    try {
      const res = await fetch('/api/stella-live/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: domanda }) });
      const data = await res.json();
      if (res.status === 403 || data.needLogin) {
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ errore: 'Sessione scaduta: devo riaccedere.' }) } });
        dispatchingRef.current = false; requestResponse(); setAuthed(false); return;
      }
      const reply = data.error ? ('Errore: ' + data.error) : (data.reply || 'Nessuna risposta.');
      const shown = !!(data.reply || (data.images && data.images.length));
      if (shown) { setMessages(m => [...m, { role: 'stella', text: data.reply || '', images: data.images }]); armSuppressRef.current = true; }
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ risposta: reply }) } });
      dispatchingRef.current = false;
      requestResponse();
    } catch (e) {
      dispatchingRef.current = false;
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ errore: 'Non sono riuscita a recuperare il dato dal gestionale.' }) } });
      requestResponse();
    }
  }

  function resumeIdle() {
    if (!activeRef.current) { setPh('off'); return; }
    setPh('listening'); setStatus('Parla pure, ti ascolto');
  }

  function sendUserText(text: string) {
    if (!activeRef.current) { pendingTextRef.current = text; start(); return; }
    setMessages(m => [...m, { role: 'user', text }]);
    send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    requestResponse();
  }

  function cleanup() {
    try { cancelAnimationFrame(rafRef.current); } catch {}
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.getSenders().forEach(s => s.track?.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    try { micStreamRef.current?.getTracks().forEach(tr => tr.stop()); } catch {}
    try { if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close(); } catch {}
    try { if (audioElRef.current) audioElRef.current.srcObject = null; } catch {}
    try { wakeRef.current?.release(); wakeRef.current = null; } catch {}
    pcRef.current = null; dcRef.current = null; micStreamRef.current = null; ctxRef.current = null; micAnRef.current = null;
    activeRef.current = false; dispatchingRef.current = false; responseActiveRef.current = false;
    suppressRespIdRef.current = null; armSuppressRef.current = false; handledCalls.current.clear();
  }

  function stop() {
    cleanup();
    setPh('off'); setStatus('Conversazione terminata. Tocca per ricominciare.');
  }

  async function newChat() {
    setMessages([]);
    try { await fetch('/api/stella-live/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) }); } catch {}
    if (activeRef.current) { stop(); setTimeout(() => start(), 300); }
    setStatus('Nuova conversazione.');
  }

  function toggleAuto() {
    const next = !autoMode; setAutoMode(next);
    if (next && !activeRef.current) start();
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
    off: 'STELLA LIVE', connecting: 'CONNESSIONE', listening: 'IN ASCOLTO', speaking: 'STELLA PARLA', thinking: 'STO CONTROLLANDO',
  };
  const active = phase !== 'off';

  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(circle at 50% -10%, #11244a, #060b16 60%)', color: '#eaf1ff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      <audio ref={audioElRef} autoPlay hidden />

      {authed === false && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#060b16', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle at 36% 30%, #3696ff, rgba(54,150,255,.3))', boxShadow: '0 0 44px rgba(54,150,255,.75)' }} />
          <h2 style={{ margin: 0, fontSize: 22 }}>Stella Live</h2>
          <p style={{ opacity: .7, maxWidth: 280, lineHeight: 1.5, fontSize: 14 }}>Per usare Stella accedi una volta con il tuo account LAPA.</p>
          <button onClick={goLogin} style={{ background: '#1f6feb', border: 'none', color: '#fff', borderRadius: 24, padding: '12px 30px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>🔑 Accedi</button>
        </div>
      )}

      <header style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid rgba(120,160,255,.12)', position: 'relative' }}>
        <button onClick={() => setShowNotifs(s => !s)} title="Cose da fare" style={{ position: 'absolute', right: 12, top: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>
          🔔{notif > 0 && <span style={{ position: 'absolute', top: -2, right: -4, background: '#ff4d4d', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 5px' }}>{notif}</span>}
        </button>
        {showNotifs && (
          <div style={{ position: 'absolute', right: 10, top: 52, zIndex: 40, background: '#0c1830', border: '1px solid rgba(120,160,255,.3)', borderRadius: 14, padding: 10, width: 280, textAlign: 'left', boxShadow: '0 10px 34px rgba(0,0,0,.55)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: .85, padding: '2px 6px 8px' }}>📋 Cose da fare</div>
            {notifItems.length === 0 && <div style={{ opacity: .6, fontSize: 13, padding: '6px' }}>Tutto a posto ✅</div>}
            {notifItems.map((it: any) => (
              <button key={it.key} onClick={() => { setShowNotifs(false); sendUserText(it.ask); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.05)', border: 'none', color: '#eaf1ff', borderRadius: 10, padding: '9px 10px', marginBottom: 6, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{it.icon}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{it.label}</span>
                <span style={{ background: '#1f6feb', borderRadius: 9, fontSize: 12, fontWeight: 700, padding: '1px 7px' }}>{it.n}</span>
              </button>
            ))}
            <div style={{ fontSize: 11, opacity: .5, padding: '4px 6px 0' }}>Tocca una voce: lo chiedo a Stella</div>
          </div>
        )}
        <div style={{ fontSize: 12, letterSpacing: 3, color: phase === 'off' ? '#5f7bb0' : '#7da8ff' }}>
          {phase === 'off' ? '○ OFFLINE' : '● ' + phaseLabel[phase]}
        </div>
        <h1 style={{ fontSize: 20, margin: '4px 0 0', fontWeight: 700 }}>Stella Live</h1>
        {installEvt && <button onClick={installApp} style={{ marginTop: 8, background: '#1f6feb', border: 'none', color: '#fff', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📲 Installa</button>}
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', opacity: .45, marginTop: 24, lineHeight: 1.7, fontSize: 14 }}>
            Tocca la sfera e parla naturalmente.<br />La puoi interrompere quando vuoi.<br />“Come stiamo con gli ordini oggi?”
            <div style={{ marginTop: 16, fontSize: 12, opacity: .8 }}>🚗 In auto: attiva Modalità Auto, collega il Bluetooth e parla a mani libere.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? '#1f6feb' : 'rgba(255,255,255,.08)', padding: '9px 13px', borderRadius: 15, borderBottomRightRadius: m.role === 'user' ? 4 : 15, borderBottomLeftRadius: m.role === 'stella' ? 4 : 15, whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 14 }}>
            {renderText(m.text)}
            {m.images && m.images.map((src, j) => src.startsWith('data:application/pdf')
              ? <a key={j} href={src} target="_blank" rel="noreferrer" style={{ ...linkStyle, display: 'inline-block', marginTop: 8 }}>📄 Apri PDF</a>
              : <img key={j} src={src} alt="" onLoad={scrollBottom} style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />)}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 16px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: '100%', width: '100%', padding: '0 2px' }}>
          {([
            ['☀️ Briefing', 'Fammi il briefing del mattino: in breve come va oggi (ordini, incassi e pagamenti, email importanti, urgenze).'],
            ['📦 Ordini oggi', 'Quanti ordini abbiamo oggi e qual e il totale?'],
            ['📧 Email', 'Leggimi le email importanti di oggi.'],
            ['📅 Scadenze', 'Cosa scade a breve nel magazzino?'],
          ] as [string, string][]).map(([label, prompt]) => (
            <button key={label} onClick={() => sendUserText(prompt)} disabled={phase === 'thinking' || phase === 'speaking'} style={chipStyle}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 13, opacity: .75, minHeight: 18, textAlign: 'center' }}>{status}</div>

        {showInput && (
          <form onSubmit={(e) => { e.preventDefault(); const t = typed.trim(); if (t) { sendUserText(t); setTyped(''); } }} style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 460 }}>
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder="Scrivi a Stella…"
              style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(120,160,255,.3)', color: '#eaf1ff', borderRadius: 22, padding: '11px 16px', fontSize: 15, outline: 'none' }} />
            <button type="submit" disabled={!typed.trim() || phase === 'thinking' || phase === 'speaking'} style={{ background: '#1f6feb', border: 'none', color: '#fff', borderRadius: '50%', width: 44, height: 44, fontSize: 18, cursor: 'pointer', flex: '0 0 auto' }}>➤</button>
          </form>
        )}

        <button onClick={active ? stop : start} aria-label="Parla con Stella"
          style={{ width: 132, height: 132, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: 'transparent', position: 'relative', outline: 'none' }}>
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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={toggleAuto} style={{ ...btnStyle, ...(autoMode ? { background: 'rgba(54,200,180,.18)', borderColor: 'rgba(54,200,180,.6)', color: '#9af0dd' } : {}) }}>🚗 Auto{autoMode ? ' ON' : ''}</button>
          <button onClick={() => setShowInput(s => !s)} style={btnStyle}>⌨️ Scrivi</button>
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
const chipStyle: React.CSSProperties = {
  whiteSpace: 'nowrap', background: 'rgba(31,111,235,.18)', border: '1px solid rgba(120,160,255,.35)', color: '#cfe0ff',
  borderRadius: 18, padding: '7px 14px', fontSize: 13, cursor: 'pointer', flex: '0 0 auto',
};
