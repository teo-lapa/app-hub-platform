'use client';

import { useRef, useState, useEffect } from 'react';

type Msg = { role: 'user' | 'stella'; text: string };

export default function StellaVocePage() {
  const [recording, setRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState('Tocca il microfono e parla con Stella');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, thinking]);

  function speak(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT';
      const v = speechSynthesis.getVoices().find(x => x.lang.startsWith('it'));
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {}
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mime = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mime)) {
        mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      }
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); send(new Blob(chunksRef.current, { type: mr.mimeType })); };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setStatus('Ti ascolto... tocca di nuovo per inviare');
    } catch {
      setStatus('Non riesco ad accedere al microfono. Concedi il permesso.');
    }
  }

  function stopRec() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function send(blob: Blob) {
    setThinking(true);
    setStatus('Stella sta pensando...');
    const fd = new FormData();
    fd.append('audio', blob, 'audio.webm');
    try {
      const res = await fetch('/api/stella-voce', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.transcript) setMessages(m => [...m, { role: 'user', text: data.transcript }]);
      if (data.error) {
        setMessages(m => [...m, { role: 'stella', text: '⚠️ ' + data.error }]);
        setStatus('Tocca il microfono e riprova');
      } else {
        setMessages(m => [...m, { role: 'stella', text: data.reply }]);
        speak(data.reply);
        setStatus('Tocca il microfono per continuare');
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'stella', text: '⚠️ Errore di connessione' }]);
      setStatus('Riprova');
    } finally {
      setThinking(false);
    }
  }

  async function newChat() {
    speechSynthesis.cancel();
    setMessages([]);
    setStatus('Nuova conversazione. Tocca e parla.');
    const fd = new FormData();
    fd.append('reset', '1');
    fd.append('text', '');
    try { await fetch('/api/stella-voce', { method: 'POST', body: fd }); } catch {}
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(circle at 50% 0%, #0b1e3a, #050a14)', color: '#e8eefc', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '18px 16px', textAlign: 'center', borderBottom: '1px solid rgba(120,160,255,.15)' }}>
        <div style={{ fontSize: 13, letterSpacing: 3, color: '#7da8ff' }}>● STELLA ONLINE</div>
        <h1 style={{ fontSize: 22, margin: '4px 0 0', fontWeight: 700 }}>Parla con Stella</h1>
        <button onClick={newChat} style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(120,160,255,.3)', color: '#9bb8ff', borderRadius: 20, padding: '4px 14px', fontSize: 12, cursor: 'pointer' }}>Nuova conversazione</button>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', opacity: .5, marginTop: 40, lineHeight: 1.6 }}>
            Prova a chiederle:<br />“Come stiamo con gli ordini oggi?”<br />“Leggimi le email importanti”<br />“Come stanno i PC?”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? '#1f6feb' : 'rgba(255,255,255,.08)', padding: '10px 14px', borderRadius: 16, borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'stella' ? 4 : 16, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {m.text}
          </div>
        ))}
        {thinking && <div style={{ alignSelf: 'flex-start', opacity: .6 }}>Stella sta pensando…</div>}
      </div>

      <div style={{ padding: '16px 16px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: .7, marginBottom: 14, minHeight: 18 }}>{status}</div>
        <button
          onClick={recording ? stopRec : startRec}
          disabled={thinking}
          style={{
            width: 88, height: 88, borderRadius: '50%', border: 'none', cursor: thinking ? 'default' : 'pointer',
            background: recording ? '#ff4d4d' : '#1f6feb',
            boxShadow: recording ? '0 0 0 10px rgba(255,77,77,.2)' : '0 0 0 8px rgba(31,111,235,.18)',
            color: '#fff', fontSize: 34, transition: 'all .2s',
          }}
          aria-label="Parla con Stella"
        >
          {recording ? '■' : '🎤'}
        </button>
      </div>
    </div>
  );
}
