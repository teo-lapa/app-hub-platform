'use client';

/**
 * ROMEO LIVE - Assistente vocale in tempo reale (OpenAI Realtime via WebRTC) per Laura.
 * Gemello di Stella Live. La voce fa da ORCHESTRATORE: chiacchiera e si lascia interrompere,
 * e per qualsiasi cosa LAPA chiama il tool `chiedi_a_romeo` che inoltra al cervello vero
 * (claude -p sul PC ROMEO, via /api/romeo-live/ask). Mentre Claude pensa la voce tiene compagnia.
 */
import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'stella'; text: string; images?: string[] };
type Phase = 'off' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'recording';

const INSTRUCTIONS = [
  'Sei Romeo, l\'assistente vocale personale di Laura (amministrazione di LAPA). Parli SEMPRE in italiano,',
  'con tono caldo, calmo e sicuro, come un collega di fiducia al telefono. Frasi BREVI e parlate',
  '(spesso sei in viva voce in auto). Ti puoi lasciare interrompere: se Laura parla, fermati e ascolta.',
  '',
  'REGOLA FONDAMENTALE: tu NON hai accesso ai dati di LAPA. Per QUALSIASI cosa riguardi l\'azienda',
  '(contabilita, fatture, pagamenti, banca, clienti, ordini, fornitori, scadenze, magazzino, e ogni',
  'AZIONE su Odoo, o qualunque numero/dato reale) devi SEMPRE chiamare il tool chiedi_a_romeo.',
  'Non inventare MAI dati: se non li hai, usa il tool.',
  'Subito PRIMA di chiamare il tool, di\' a voce una frase breve tipo "un attimo, controllo" cosi',
  'Laura non resta nel vuoto. Quando ricevi il risultato, riferiscilo in modo naturale e discutilo;',
  'riporta solo quello che torna dal tool, senza aggiungere numeri non presenti.',
  '',
  'Le chiacchiere, i saluti, le riformulazioni e i chiarimenti li gestisci tu direttamente, senza tool.',
  'Per cose importanti o irreversibili, prima ripeti a voce cosa stai per fare e aspetta l\'OK di Laura.',
  'Parli in italiano (capisci anche tedesco e rumeno). Se senti un suono breve o un respiro poco chiaro, ignoralo e aspetta.',
].join(' ');

export default function RomeoLivePage() {
  const [phase, setPhase] = useState<Phase>('off');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState('Tocca la sfera e parla con Romeo in tempo reale');
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [typed, setTyped] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [notif, setNotif] = useState(0);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [recording, setRecording] = useState(false);

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
  const autoStartedRef = useRef(false);
  const handledCalls = useRef<Set<string>>(new Set());
  // Registra chiamata: Romeo ascolta MUTO il vivavoce, accumula la trascrizione e a fine la riassume.
  const recordingRef = useRef(false);
  const recordTxtRef = useRef<string[]>([]);
  const pendingRecordRef = useRef(false);

  function setPh(p: Phase) { phaseRef.current = p; setPhase(p); }
  function send(obj: any) { const dc = dcRef.current; if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)); }
  function requestResponse() { if (responseActiveRef.current) send({ type: 'response.cancel' }); send({ type: 'response.create' }); }
  function micOn(on: boolean) { micStreamRef.current?.getAudioTracks().forEach(tr => { tr.enabled = on; }); }
  function scrollBottom() { const el = scrollRef.current; if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight })); }
  // Servizio in background NATIVO (solo dentro l'APK): tiene viva la voce a schermo spento / telefono in tasca.
  function fgService(on: boolean) {
    try {
      const Cap = (window as any).Capacitor;
      if (!Cap?.isNativePlatform?.()) return;
      const FS = Cap.Plugins?.ForegroundService;
      if (!FS) return;
      if (on) {
        Promise.resolve(FS.createNotificationChannel?.({ id: 'romeo_live', name: 'Romeo Live', description: 'Voce attiva in background', importance: 3 }))
          .catch(() => {})
          .then(() => FS.startForegroundService({ id: 8, title: 'Romeo Live', body: 'In ascolto — tocca per tornare', smallIcon: 'ic_launcher', notificationChannelId: 'romeo_live', serviceType: 128 }))
          .catch(() => {});
      } else {
        Promise.resolve(FS.stopForegroundService?.()).catch(() => {});
      }
    } catch {}
  }

  useEffect(() => { scrollBottom(); }, [messages, phase]);
  useEffect(() => () => { cleanup(); }, []);
  useEffect(() => {
    fetch('/api/romeo-live/session').then(r => r.json()).then(d => setAuthed(!!d.authed)).catch(() => setAuthed(true));
  }, []);
  useEffect(() => {
    if (authed) fetch('/api/romeo-live/notifs').then(r => r.json()).then(d => { setNotif(d.count || 0); setNotifItems(d.items || []); }).catch(() => {});
  }, [authed]);
  // Modalita Auto persistente: se lasciata accesa, all'apertura dell'app (es. aperta dalla Routine quando ti
  // colleghi al Bluetooth dell'auto) parte gia in ascolto. Solo dentro l'APK nativo, una volta sola.
  useEffect(() => {
    if (authed !== true) return;
    let persisted = false;
    try { persisted = localStorage.getItem('romeoLiveAuto') === '1'; } catch {}
    if (persisted) setAutoMode(true);
    const native = !!(window as any).Capacitor?.isNativePlatform?.();
    if (persisted && native && !autoStartedRef.current && !activeRef.current) {
      autoStartedRef.current = true;
      setTimeout(() => start(), 400);
    }
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
  useEffect(() => {
    const tracks = micStreamRef.current?.getAudioTracks();
    if (tracks) tracks.forEach(tr => { tr.enabled = !showInput; });
    if (showInput && activeRef.current) setStatus('Chat scritta — microfono in pausa');
    else if (!showInput && activeRef.current && phaseRef.current === 'listening') setStatus('Parla pure, ti ascolto');
  }, [showInput]);

  function goLogin() { window.location.href = '/?redirect=' + encodeURIComponent('/romeo-live'); }

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
    else if ((ph === 'listening' || ph === 'recording') && micAnRef.current) level = rms(micAnRef.current);

    const orb = orbRef.current;
    if (orb) {
      const lv = Math.min(level, 0.5);
      orb.style.transform = `scale(${(1 + lv * 0.6).toFixed(3)})`;
      const glow = 12 + lv * 70;
      const c = ph === 'speaking' ? '120,210,160' : ph === 'thinking' ? '60,190,210' : ph === 'recording' ? '255,107,107' : ph === 'listening' ? '45,225,200' : '34,200,180';
      orb.style.boxShadow = `0 0 ${glow.toFixed(0)}px rgba(${c},.9), inset 0 0 22px rgba(255,255,255,.28)`;
      orb.style.background = `radial-gradient(circle at 36% 30%, rgba(${c},1), rgba(${c},.30))`;
    }
  }

  // passive=true (modalita Registra chiamata): Romeo trascrive ma NON risponde mai (non interrompe la telefonata).
  function sessionUpdate(passive = false) {
    return {
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: INSTRUCTIONS,
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: { model: 'gpt-4o-mini-transcribe', language: 'it' },
            turn_detection: { type: 'server_vad', threshold: 0.7, prefix_padding_ms: 300, silence_duration_ms: 900, create_response: !passive, interrupt_response: !passive },
          },
          output: { voice: process.env.NEXT_PUBLIC_ROMEO_VOICE || 'cedar' },
        },
        tools: [{
          type: 'function',
          name: 'chiedi_a_romeo',
          description: 'Inoltra al cervello LAPA QUALSIASI richiesta che riguardi dati o operativita aziendale: contabilita, fatture, pagamenti, banca, clienti, ordini, fornitori, scadenze, magazzino, e ogni azione su Odoo. Usa SEMPRE questo tool per dare risposte concrete: non rispondere a memoria.',
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
    setPh('connecting'); setStatus('Connessione a Romeo…');
    try {
      const tokenRes = await fetch('/api/romeo-live/session', { method: 'POST' });
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
      if (showInput) mic.getAudioTracks().forEach(tr => { tr.enabled = false; });

      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx(); ctxRef.current = ctx; await ctx.resume();
      const srcNode = ctx.createMediaStreamSource(mic);
      const an = ctx.createAnalyser(); an.fftSize = 1024; srcNode.connect(an); micAnRef.current = an;

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onopen = () => {
        send(sessionUpdate());
        activeRef.current = true;
        fgService(true);
        setPh('listening'); setStatus('Parla pure, ti ascolto');
        rafRef.current = requestAnimationFrame(loop);
        if (pendingRecordRef.current) { pendingRecordRef.current = false; setTimeout(() => enterRecording(), 200); }
        else if (pendingTextRef.current) { const t = pendingTextRef.current; pendingTextRef.current = ''; setTimeout(() => sendUserText(t), 250); }
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
    if (t === 'response.created') { responseActiveRef.current = true; }
    else if (t === 'input_audio_buffer.speech_started') { if (recordingRef.current) { setStatus('📞 Registro…'); } else if (phaseRef.current !== 'thinking') { setPh('listening'); setStatus('Ti ascolto…'); } }
    else if (t === 'conversation.item.input_audio_transcription.completed' || t === 'input_audio_transcription.completed') {
      if (ev.transcript) { if (recordingRef.current) recordTxtRef.current.push(ev.transcript); setMessages(m => [...m, { role: 'user', text: ev.transcript }]); }
    }
    else if (t === 'output_audio_buffer.started' || t === 'response.output_audio.delta' || t === 'response.audio_transcript.delta') {
      if (phaseRef.current !== 'thinking') { setPh('speaking'); setStatus('Romeo sta parlando…'); }
    }
    else if (t === 'response.output_audio_transcript.done' || t === 'response.audio_transcript.done') {
      if (ev.transcript) setMessages(m => [...m, { role: 'stella', text: ev.transcript }]);
    }
    else if (t === 'response.function_call_arguments.done') {
      if (ev.name === 'chiedi_a_romeo') { let d = ''; try { d = JSON.parse(ev.arguments || '{}').domanda || ''; } catch {} dispatchToBrain(d, ev.call_id); }
    }
    else if (t === 'response.output_item.done' && ev.item?.type === 'function_call') {
      if (ev.item.name === 'chiedi_a_romeo') { let d = ''; try { d = JSON.parse(ev.item.arguments || '{}').domanda || ''; } catch {} dispatchToBrain(d, ev.item.call_id); }
    }
    else if (t === 'response.done') { responseActiveRef.current = false; if (!dispatchingRef.current) resumeIdle(); }
    else if (t === 'error') {
      try { console.warn('realtime error:', ev.error?.message || ev); } catch {}
      responseActiveRef.current = false;
      if (!dispatchingRef.current) resumeIdle();
    }
  }

  async function dispatchToBrain(domanda: string, callId: string) {
    if (!callId || handledCalls.current.has(callId)) return;
    handledCalls.current.add(callId);
    dispatchingRef.current = true;
    setPh('thinking'); setStatus('Romeo sta controllando…');
    micOn(false);
    try {
      const res = await fetch('/api/romeo-live/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: domanda }) });
      const data = await res.json();
      if (res.status === 403 || data.needLogin) {
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ errore: 'Sessione scaduta: devo riaccedere.' }) } });
        dispatchingRef.current = false; micOn(!showInput); requestResponse(); setAuthed(false); return;
      }
      const reply = data.error ? ('Errore: ' + data.error) : (data.reply || 'Nessuna risposta.');
      if (data.images && data.images.length) setMessages(m => [...m, { role: 'stella', text: '', images: data.images }]);
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ risposta: reply }) } });
      dispatchingRef.current = false;
      micOn(!showInput);
      requestResponse();
    } catch (e) {
      dispatchingRef.current = false;
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ errore: 'Non sono riuscito a recuperare il dato dal gestionale.' }) } });
      micOn(!showInput);
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
    fgService(false);
    pcRef.current = null; dcRef.current = null; micStreamRef.current = null; ctxRef.current = null; micAnRef.current = null;
    activeRef.current = false; dispatchingRef.current = false; responseActiveRef.current = false; handledCalls.current.clear();
    recordingRef.current = false; pendingRecordRef.current = false; recordTxtRef.current = []; setRecording(false);
  }

  function stop() {
    cleanup();
    setPh('off'); setStatus('Conversazione terminata. Tocca per ricominciare.');
  }

  // entra in modalita passiva: Romeo trascrive ma non parla.
  // NB: sullo STESSO telefono Android in vivavoce il microfono e uno solo (lo tiene la telefonata):
  // per catturare entrambe le voci si usa un SECONDO dispositivo accanto al telefono in vivavoce.
  function enterRecording() {
    recordTxtRef.current = [];
    recordingRef.current = true; setRecording(true);
    send(sessionUpdate(true));
    micOn(true);
    setPh('recording'); setStatus('📞 Registro — parla pure');
  }

  function startRecording() {
    if (!activeRef.current) { pendingRecordRef.current = true; start(); return; }
    enterRecording();
  }

  function stopRecording() {
    recordingRef.current = false; setRecording(false);
    send(sessionUpdate(false)); // torna interattivo (Romeo riparla)
    const txt = recordTxtRef.current.join(' ').trim();
    recordTxtRef.current = [];
    if (!txt) { setPh('listening'); setStatus('Niente da trascrivere. Riprova.'); return; }
    const prompt = 'Ho appena registrato una telefonata in vivavoce con un cliente (io sono LAPA, l\'altra voce e il cliente). '
      + 'Ecco la trascrizione grezza, puo contenere errori:\n\n"' + txt + '"\n\n'
      + 'Dimmi in modo breve e parlato se e un ORDINE, un APPUNTAMENTO o un PROMEMORIA e cosa hai capito '
      + '(cliente, prodotti e quantita, oppure data e ora, oppure la nota). NON registrare ancora niente. '
      + 'Chiedimi conferma: solo quando ti dico ok usa chiedi_a_romeo per registrarlo davvero.';
    setMessages(m => [...m, { role: 'user', text: '📞 [Telefonata registrata]' }]);
    send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] } });
    setPh('thinking'); setStatus('Romeo riassume la telefonata…');
    requestResponse();
  }

  async function newChat() {
    setMessages([]);
    try { await fetch('/api/romeo-live/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) }); } catch {}
    if (activeRef.current) { stop(); setTimeout(() => start(), 300); }
    setStatus('Nuova conversazione.');
  }

  function toggleAuto() {
    const next = !autoMode; setAutoMode(next);
    try { localStorage.setItem('romeoLiveAuto', next ? '1' : '0'); } catch {}
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
    off: 'ROMEO LIVE', connecting: 'CONNESSIONE', listening: 'IN ASCOLTO', speaking: 'ROMEO PARLA', thinking: 'STO CONTROLLANDO', recording: 'REGISTRO CHIAMATA',
  };
  const phColor: Record<Phase, string> = {
    off: '#5f9b90', connecting: '#8ecfc4', listening: '#2fe1c0', speaking: '#78d6a8', thinking: '#52c7d6', recording: '#ff6b6b',
  };
  const active = phase !== 'off';

  return (
    <div className="rl-root">
      <style jsx>{`
        .rl-root{position:relative;height:100dvh;display:flex;flex-direction:column;overflow:hidden;color:#e9fff8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:radial-gradient(130% 90% at 50% -20%,#0d3a32 0%,#08231f 45%,#04100e 100%);}
        .rl-aurora{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
        .rl-b{position:absolute;border-radius:50%;filter:blur(64px);mix-blend-mode:screen;}
        .rl-b1{width:62vw;height:62vw;left:-12vw;top:-14vw;background:radial-gradient(circle,#15c8a8,transparent 70%);opacity:.5;animation:rld1 19s ease-in-out infinite;}
        .rl-b2{width:58vw;height:58vw;right:-18vw;top:6vh;background:radial-gradient(circle,#36d39a,transparent 70%);opacity:.4;animation:rld2 23s ease-in-out infinite;}
        .rl-b3{width:54vw;height:54vw;left:6vw;bottom:-24vh;background:radial-gradient(circle,#2fd0e1,transparent 70%);opacity:.3;animation:rld3 27s ease-in-out infinite;}
        @keyframes rld1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(7vw,6vh) scale(1.15)}}
        @keyframes rld2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-6vw,7vh) scale(1.1)}}
        @keyframes rld3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(5vw,-6vh) scale(1.18)}}
        .rl-header{position:relative;z-index:1;padding:14px 16px 8px;text-align:center;}
        .rl-bell{position:absolute;right:12px;top:12px;background:transparent;border:none;cursor:pointer;font-size:23px;line-height:1;}
        .rl-badge{position:absolute;top:-2px;right:-4px;background:#ff4d6d;color:#fff;border-radius:10px;font-size:11px;font-weight:700;padding:1px 5px;}
        .rl-notifs{position:absolute;right:10px;top:50px;z-index:40;background:rgba(8,35,31,.94);backdrop-filter:blur(12px);border:1px solid rgba(90,220,200,.28);border-radius:14px;padding:10px;width:280px;text-align:left;box-shadow:0 14px 40px rgba(0,0,0,.6);}
        .rl-notif-item{display:flex;width:100%;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:none;color:#e9fff8;border-radius:10px;padding:9px 10px;margin-bottom:6px;cursor:pointer;text-align:left;}
        .rl-notif-n{background:#119a82;border-radius:9px;font-size:12px;font-weight:700;padding:1px 7px;}
        .rl-eyebrow{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.34em;text-transform:uppercase;}
        .rl-title{margin:6px 0 0;font-size:19px;font-weight:800;letter-spacing:.4px;background:linear-gradient(90deg,#bfeee2,#36d39a 55%,#2fd0e1);-webkit-background-clip:text;background-clip:text;color:transparent;}
        .rl-install{margin-top:8px;background:linear-gradient(135deg,#0e9e88,#2fd0c0);border:none;color:#04221d;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;cursor:pointer;}
        .rl-convo{position:relative;z-index:1;flex:1;min-height:0;overflow-y:auto;padding:12px 14px 4px;display:flex;flex-direction:column;gap:9px;}
        .rl-empty{text-align:center;opacity:.5;margin:auto 0;line-height:1.7;font-size:14px;}
        .rl-bubble{max-width:86%;padding:10px 13px;border-radius:16px;line-height:1.45;font-size:14px;white-space:pre-wrap;word-break:break-word;}
        .rl-bubble.me{align-self:flex-end;background:linear-gradient(135deg,#0e9e88,#1fbfa6);color:#fff;border-bottom-right-radius:5px;box-shadow:0 6px 20px rgba(20,180,150,.32);}
        .rl-bubble.her{align-self:flex-start;background:rgba(255,255,255,.065);border:1px solid rgba(90,220,200,.16);border-bottom-left-radius:5px;}
        .rl-msg{animation:rlin .26s ease;}
        @keyframes rlin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .rl-dock{position:relative;z-index:1;padding:8px 14px calc(16px + env(safe-area-inset-bottom));}
        .rl-chips{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px;}
        .rl-chips::-webkit-scrollbar{display:none;}
        .rl-chip{white-space:nowrap;flex:0 0 auto;padding:7px 13px;font-size:12.5px;border-radius:14px;cursor:pointer;color:#cffdf2;background:rgba(45,210,190,.12);border:1px solid rgba(90,220,200,.22);}
        .rl-chip:disabled{opacity:.38;}
        .rl-form{display:flex;gap:8px;margin-top:8px;}
        .rl-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(90,220,200,.25);color:#e9fff8;border-radius:18px;padding:11px 15px;font-size:15px;outline:none;}
        .rl-send{flex:0 0 auto;width:44px;height:44px;border:none;border-radius:50%;background:linear-gradient(135deg,#0e9e88,#2fd0c0);color:#04221d;font-size:18px;font-weight:700;cursor:pointer;}
        .rl-send:disabled{opacity:.4;}
        .rl-status{font:500 12px/1.3 ui-monospace,Menlo,monospace;color:#7fc5b8;text-align:center;min-height:15px;margin:8px 0 10px;}
        .rl-controls{display:flex;align-items:center;gap:10px;}
        .rl-core-btn{position:relative;width:60px;height:60px;flex:0 0 auto;border:none;background:transparent;cursor:pointer;padding:0;}
        .rl-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(90,220,200,.35);animation:rlp 2.6s ease-in-out infinite;}
        .rl-ring[data-on="1"]{border-color:rgba(60,225,190,.6);}
        @keyframes rlp{0%,100%{transform:scale(.82);opacity:.45}50%{transform:scale(1);opacity:.9}}
        .rl-core{position:absolute;inset:9px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:radial-gradient(circle at 36% 30%,rgba(34,200,180,1),rgba(34,200,180,.3));box-shadow:0 0 12px rgba(34,200,180,.9),inset 0 0 22px rgba(255,255,255,.28);transition:background .25s;will-change:transform;}
        .rl-pills{display:flex;gap:7px;flex-wrap:wrap;flex:1;}
        .rl-pill{padding:8px 12px;font-size:12px;border-radius:14px;cursor:pointer;color:#9fe6d8;background:rgba(255,255,255,.045);border:1px solid rgba(90,220,200,.22);}
        .rl-pill.on{background:rgba(47,225,192,.16);border-color:rgba(47,225,192,.55);color:#9af0dd;}
        .rl-gate{position:fixed;inset:0;z-index:50;background:#04100e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center;}
        .rl-gate-orb{width:92px;height:92px;border-radius:50%;background:radial-gradient(circle at 36% 30%,#2fd0c0,rgba(34,200,180,.3));box-shadow:0 0 44px rgba(34,200,180,.7);animation:rlp 2.6s ease-in-out infinite;}
        .rl-login{background:linear-gradient(135deg,#0e9e88,#2fd0c0);border:none;color:#04221d;border-radius:24px;padding:12px 30px;font-size:16px;font-weight:800;cursor:pointer;}
        @media (prefers-reduced-motion: reduce){.rl-b,.rl-msg,.rl-ring,.rl-gate-orb{animation:none!important;}}
      `}</style>

      <div aria-hidden className="rl-aurora"><span className="rl-b rl-b1" /><span className="rl-b rl-b2" /><span className="rl-b rl-b3" /></div>
      <audio ref={audioElRef} autoPlay hidden />

      {authed === false && (
        <div className="rl-gate">
          <div className="rl-gate-orb" />
          <h2 style={{ margin: 0, fontSize: 22 }}>Romeo Live</h2>
          <p style={{ opacity: .7, maxWidth: 280, lineHeight: 1.5, fontSize: 14 }}>Per usare Romeo accedi una volta con il tuo account LAPA.</p>
          <button onClick={goLogin} className="rl-login">🔑 Accedi</button>
        </div>
      )}

      <header className="rl-header">
        <button onClick={() => setShowNotifs(s => !s)} title="Cose da fare" className="rl-bell">
          🔔{notif > 0 && <span className="rl-badge">{notif}</span>}
        </button>
        {showNotifs && (
          <div className="rl-notifs">
            <div style={{ fontSize: 13, fontWeight: 700, opacity: .85, padding: '2px 6px 8px' }}>📋 Cose da fare</div>
            {notifItems.length === 0 && <div style={{ opacity: .6, fontSize: 13, padding: '6px' }}>Tutto a posto ✅</div>}
            {notifItems.map((it: any) => (
              <button key={it.key} onClick={() => { setShowNotifs(false); sendUserText(it.ask); }} className="rl-notif-item">
                <span style={{ fontSize: 18 }}>{it.icon}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{it.label}</span>
                <span className="rl-notif-n">{it.n}</span>
              </button>
            ))}
            <div style={{ fontSize: 11, opacity: .5, padding: '4px 6px 0' }}>Tocca una voce: lo chiedo a Romeo</div>
          </div>
        )}
        <div className="rl-eyebrow" style={{ color: phColor[phase] }}>{phase === 'off' ? '○ OFFLINE' : '● ' + phaseLabel[phase]}</div>
        <h1 className="rl-title">Romeo Live</h1>
        {installEvt && <button onClick={installApp} className="rl-install">📲 Installa</button>}
      </header>

      <div ref={scrollRef} className="rl-convo">
        {messages.length === 0 && (
          <div className="rl-empty">
            Tocca la sfera e parla naturalmente.<br />Lo puoi interrompere quando vuoi.<br />“Come siamo messi con le fatture?”
            <div style={{ marginTop: 16, fontSize: 12, opacity: .85 }}>🚗 In auto: attiva Modalità Auto, collega il Bluetooth e parla a mani libere.</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'rl-msg rl-bubble ' + (m.role === 'user' ? 'me' : 'her')}>
            {renderText(m.text)}
            {m.images && m.images.map((src, j) => src.startsWith('data:application/pdf')
              ? <a key={j} href={src} target="_blank" rel="noreferrer" style={{ ...linkStyle, display: 'inline-block', marginTop: 8 }}>📄 Apri PDF</a>
              : <img key={j} src={src} alt="" onLoad={scrollBottom} style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />)}
          </div>
        ))}
      </div>

      <div className="rl-dock">
        <div className="rl-chips">
          {([
            ['☀️ Briefing', 'Fammi il briefing del mattino: in breve come va oggi (incassi e pagamenti, fatture in scadenza, banca, urgenze).'],
            ['💰 Incassi', 'Quali incassi e pagamenti abbiamo oggi?'],
            ['🧾 Fatture', 'Quali fatture sono in scadenza questa settimana?'],
            ['🏦 Scaduto', 'Quali sono i clienti con il maggior scaduto e da quanto?'],
          ] as [string, string][]).map(([label, prompt]) => (
            <button key={label} onClick={() => sendUserText(prompt)} disabled={phase === 'thinking' || phase === 'speaking'} className="rl-chip">{label}</button>
          ))}
        </div>

        {showInput && (
          <form onSubmit={(e) => { e.preventDefault(); const t = typed.trim(); if (t) { sendUserText(t); setTyped(''); } }} className="rl-form">
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder="Scrivi a Romeo…" className="rl-input" />
            <button type="submit" disabled={!typed.trim() || phase === 'thinking' || phase === 'speaking'} className="rl-send">➤</button>
          </form>
        )}

        <div className="rl-status">{status}</div>

        <div className="rl-controls">
          <button onClick={active ? stop : start} aria-label="Parla con Romeo" className="rl-core-btn">
            <span className="rl-ring" data-on={active ? '1' : '0'} />
            <div ref={orbRef} className="rl-core">{active ? '' : '🎤'}</div>
          </button>
          <div className="rl-pills">
            {!recording
              ? <button onClick={startRecording} className="rl-pill">📞 Registra chiamata</button>
              : <button onClick={stopRecording} className="rl-pill on">● Stop e riassumi</button>}
            <button onClick={toggleAuto} className={'rl-pill' + (autoMode ? ' on' : '')}>🚗 Auto{autoMode ? ' ON' : ''}</button>
            <button onClick={() => setShowInput(s => !s)} className={'rl-pill' + (showInput ? ' on' : '')}>⌨️ Scrivi</button>
            {active && <button onClick={stop} className="rl-pill">■ Stop</button>}
            <button onClick={newChat} className="rl-pill">↺ Nuova</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: '#6fe6cf', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-word',
};
