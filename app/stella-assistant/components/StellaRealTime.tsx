'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import StellaVideoAvatarSimple from './StellaVideoAvatarSimple';

interface StellaRealTimeProps {
  action: any;
  userContext: any;
  onClose: () => void;
  onMessageReceived?: (message: { text: string; isUser: boolean; timestamp: number }) => void;
}

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export default function StellaRealTime({ action, userContext, onClose, onMessageReceived }: StellaRealTimeProps) {
  // WebRTC refs COME NEL TUO HTML FUNZIONANTE
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const currentResponseRef = useRef<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Component state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<string[]>([]);
  const [stellaInstructions, setStellaInstructions] = useState('');
  const [textInput, setTextInput] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const hasTriedConnecting = useRef(false);
  const isCreatingResponse = useRef(false); // Previene risposte multiple

  // WebRTC connection ESATTAMENTE come nel tuo HTML errors.txt
  const initializeConnection = useCallback(async () => {
    if (isConnecting || isConnected || hasTriedConnecting.current) return;

    hasTriedConnecting.current = true;
    setIsConnecting(true);
    setHasError(false);
    setErrorMessage('');

    try {
      // Get session setup
      const setupResponse = await fetch('/api/openai/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userContext,
          taskId: '108'
        })
      });

      const setupData = await setupResponse.json();
      if (!setupData.success) {
        throw new Error(setupData.error);
      }

      setStellaInstructions(setupData.instructions);

      // ✅ USA WEBRTC COME NEL FILE FUNZIONANTE
      pcRef.current = new RTCPeerConnection();

      // Setup microfono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      stream.getTracks().forEach(track => pcRef.current!.addTrack(track, stream));

      // Audio output
      const audio = new Audio();
      audio.autoplay = true;
      pcRef.current.ontrack = e => audio.srcObject = e.streams[0];

      // Canale dati per prompt
      dataChannelRef.current = pcRef.current.createDataChannel('oai-events');

      dataChannelRef.current.onopen = function() {
        const fullPrompt = setupData.instructions;

        console.log('📝 Prompt vocale lunghezza:', fullPrompt.length);
        console.log('👤 Cliente per voce:', setupData.userData?.name || 'GUEST');

        // ✅ USA LA CONFIGURAZIONE CHE FUNZIONA + TRASCRIZIONE INPUT
        dataChannelRef.current!.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: fullPrompt,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200
            }
          }
        }));

        setIsConnected(true);
        setIsConnecting(false);

        // Messaggio di benvenuto personalizzato
        const userName = setupData.userData?.name || userContext?.userName || 'Cliente';
        const welcomeMsg = `Ciao ${userName}! 👋 Sono Stella, la tua assistente personale. Parla con me oppure scrivi il tuo messaggio.`;

        console.log('✅ Stella vocale attiva - Puoi parlare!');
        toast.success(`🎙️ Connesso a Stella!`);
        setConversation(prev => [...prev, welcomeMsg]);
      };

      // Gestione eventi WebRTC
      dataChannelRef.current.onmessage = function(event) {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeEvent(message);
        } catch (error) {
          console.log('📥 Messaggio audio ricevuto da Stella');
        }
      };

      // WebRTC offer
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      // ✅ USA L'URL CHE FUNZIONA con token sicuro da Vercel
      const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': 'Bearer ' + setupData.client_secret,
          'Content-Type': 'application/sdp'
        }
      });

      if (!response.ok) {
        throw new Error('Errore connessione OpenAI: ' + response.status);
      }

      const sdp = await response.text();
      await pcRef.current.setRemoteDescription({ type: 'answer', sdp });

      console.log('✅ Stella vocale WebRTC connessa con successo!');

    } catch (error) {
      console.error('❌ Errore connessione vocale WebRTC:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Errore di connessione');
      setIsConnecting(false);
      toast.error('Errore: ' + (error instanceof Error ? error.message : 'Sconosciuto'));
      hasTriedConnecting.current = false;
    }
  }, [action, userContext]);

  // Handle Realtime events SEMPLICE
  const handleRealtimeEvent = (data: any) => {
    console.log('📥 Evento Realtime:', data.type);

    if (data.type === 'session.created') {
      console.log('✅ Sessione Realtime creata con successo');
    }
    else if (data.type === 'session.updated') {
      console.log('✅ Sessione aggiornata con successo');
    }
    else if (data.type === 'input_audio_buffer.speech_started') {
      console.log('🎤 Rilevato inizio parlato - Stella ti sta ascoltando!');
      setIsListening(true);
    }
    else if (data.type === 'input_audio_buffer.speech_stopped') {
      console.log('🛑 Rilevata fine parlato - Stella sta processando...');
      setIsListening(false);
    }
    else if (data.type === 'conversation.item.input_audio_transcription.completed') {
      if (data.transcript) {
        console.log('📝 Trascrizione cliente completata:', data.transcript);
        setConversation(prev => [...prev, `🎤 Tu: ${data.transcript}`]);
        // Salva nel messaggio principale
        if (onMessageReceived) {
          onMessageReceived({
            text: data.transcript,
            isUser: true,
            timestamp: Date.now()
          });
        }
      }
    }
    else if (data.type === 'input_audio_transcription.completed') {
      if (data.transcript) {
        console.log('📝 Trascrizione cliente (alt):', data.transcript);
        setConversation(prev => [...prev, `🎤 Tu: ${data.transcript}`]);
      }
    }
    else if (data.type === 'conversation.item.done' && data.item && data.item.content && data.item.content[0] && data.item.content[0].transcript) {
      const transcript = data.item.content[0].transcript;
      if (data.item.role === 'user') {
        console.log('📝 Trascrizione cliente (via item):', transcript);
        setConversation(prev => [...prev, `🎤 Tu: ${transcript}`]);
      } else if (data.item.role === 'assistant') {
        console.log('📝 Trascrizione Stella (via item):', transcript);
        setConversation(prev => [...prev, `🔊 Stella: ${transcript}`]);
      }
    }
    else if (data.type === 'response.created') {
      console.log('🤖 Stella sta creando una risposta...');
      setIsSpeaking(true);
      isCreatingResponse.current = true;
    }
    else if (data.type === 'response.text.delta') {
      if (!currentResponseRef.current) {
        currentResponseRef.current = '';
      }
      currentResponseRef.current += data.delta;
      // Update a live text response in conversation
      setConversation(prev => {
        const newConv = [...prev];
        const lastIndex = newConv.length - 1;
        if (newConv[lastIndex] && newConv[lastIndex].startsWith('💭 Stella (testo):')) {
          newConv[lastIndex] = `💭 Stella (testo): ${currentResponseRef.current}`;
        } else {
          newConv.push(`💭 Stella (testo): ${currentResponseRef.current}`);
        }
        return newConv;
      });
    }
    else if (data.type === 'response.text.done') {
      if (currentResponseRef.current) {
        console.log('✅ Risposta testo completata via Realtime unificata');
        currentResponseRef.current = '';
      }
    }
    else if (data.type === 'response.audio.delta') {
      console.log('🔊 Audio delta ricevuto (lunghezza:', data.delta ? data.delta.length : 0, ')');
      if (data.delta) {
        playReceivedAudio(data.delta);
      }
    }
    else if (data.type === 'response.audio_transcript.done') {
      if (data.transcript) {
        console.log('🔊 Trascrizione risposta Stella:', data.transcript);
        setConversation(prev => [...prev, `🔊 Stella: ${data.transcript}`]);
        // Salva nel messaggio principale
        if (onMessageReceived) {
          onMessageReceived({
            text: data.transcript,
            isUser: false,
            timestamp: Date.now()
          });
        }
      }
    }
    else if (data.type === 'response.output_audio_transcript.done') {
      if (data.transcript) {
        console.log('🔊 Trascrizione risposta Stella (alt):', data.transcript);
        setConversation(prev => [...prev, `🔊 Stella: ${data.transcript}`]);
      }
    }
    else if (data.type === 'response.audio.done') {
      console.log('✅ Audio risposta completato');
    }
    else if (data.type === 'response.done') {
      console.log('✅ Risposta completa di Stella terminata');
      setIsSpeaking(false);
      isCreatingResponse.current = false; // Reset flag
    }
    else if (data.type === 'error') {
      const errorMsg = data.error.message || 'Errore sconosciuto';
      console.error('❌ Errore Realtime:', errorMsg);
      toast.error('Stella error: ' + errorMsg);
      setConversation(prev => [...prev, `❌ Errore: ${errorMsg}`]);
    }
    else {
      console.log('❓ Evento sconosciuto:', data.type);
    }
  };

  // Send text message via WebRTC Data Channel COME NEL TUO HTML
  const sendTextMessage = () => {
    const text = textInput.trim();

    if (!text || !isConnected || !dataChannelRef.current) {
      return;
    }

    // Check se c'è già una risposta in corso
    if (isCreatingResponse.current) {
      console.log('⚠️ Risposta già in corso, attendi...');
      toast.error('Aspetta che Stella finisca di parlare!');
      return;
    }

    // Show user message
    setConversation(prev => [...prev, `📝 Tu: ${text}`]);
    setTextInput('');

    // Send message to OpenAI Realtime via WebRTC Data Channel
    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    };

    dataChannelRef.current.send(JSON.stringify(message));

    // Request response SOLO se non c'è già una risposta
    if (!isCreatingResponse.current) {
      isCreatingResponse.current = true;

      const responseRequest = {
        type: 'response.create'
      };

      dataChannelRef.current.send(JSON.stringify(responseRequest));
      setIsSpeaking(true);
    }
  };

  // Audio variables COME NEL TUO HTML
  const audioQueue = useRef<string[]>([]);
  const isPlayingAudio = useRef(false);

  // Play received audio ESATTAMENTE come nel tuo HTML errors.txt
  const playReceivedAudio = (base64Audio: string) => {
    try {
      audioQueue.current.push(base64Audio);

      if (!isPlayingAudio.current) {
        processAudioQueue();
      }

    } catch (error) {
      console.log('❌ Errore gestione audio:', error);
    }
  };

  // Process audio queue ESATTAMENTE come nel tuo HTML
  const processAudioQueue = async () => {
    if (audioQueue.current.length === 0) {
      isPlayingAudio.current = false;
      return;
    }

    isPlayingAudio.current = true;
    const base64Audio = audioQueue.current.shift()!;

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setTimeout(() => processAudioQueue(), 10);
      };

      source.start(0);
      console.log('🔊 Riproduzione audio Stella');

    } catch (error) {
      console.log('❌ Errore riproduzione audio:', error);
      setTimeout(() => processAudioQueue(), 100);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (audioStreamRef.current) {
      const audioTracks = audioStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      toast.success(isMuted ? '🎤 Microfono attivato' : '🔇 Microfono silenziato');
    }
  };

  // Cleanup function WebRTC COME NEL TUO HTML
  const cleanup = () => {
    // Ferma stream microfono
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Track audio fermato:', track.kind);
      });
      audioStreamRef.current = null;
      console.log('🔇 Stream microfono completamente fermato');
    }

    // Chiudi WebRTC PeerConnection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
      console.log('🔇 WebRTC PeerConnection chiuso');
    }

    // Chiudi Data Channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
      console.log('🔇 Data Channel chiuso');
    }

    // Chiudi audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    console.log('⏹️ Conversazione terminata');
  };

  // End conversation
  const endConversation = () => {
    cleanup();
    onClose();
    toast.success('👋 Conversazione con Stella terminata');
  };

  // Handle text input keypress
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendTextMessage();
    }
  };

  // Retry connection function
  const retryConnection = () => {
    hasTriedConnecting.current = false;
    setHasError(false);
    setErrorMessage('');
    cleanup();
    initializeConnection();
  };

  // Control video playback based on Stella's state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
      // Stella sta parlando - aumenta velocità video e luminosità
      video.playbackRate = 1.2; // Velocità leggermente più alta
      video.style.filter = 'brightness(1.15) contrast(1.1) saturate(1.1)';
    } else if (isListening) {
      // Stella sta ascoltando - velocità normale ma più attenta
      video.playbackRate = 1.0;
      video.style.filter = 'brightness(1.05) contrast(1.05)';
    } else {
      // Stella in idle - velocità più lenta e normale
      video.playbackRate = 0.8; // Più rilassata
      video.style.filter = 'brightness(1) contrast(1)';
    }
  }, [isSpeaking, isListening]);

  // Auto-connect on mount (only once)
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeConnection();
    }, 100); // Small delay to prevent race conditions

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, []); // Empty dependency array - only run once

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Left Side - Stella Video Avatar */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -100, opacity: 0 }}
        className="w-1/2 relative bg-gradient-to-br from-blue-900 to-purple-900"
      >
        {/* Office Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent">
          {/* Simulated office environment */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-800/50 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-gray-800/30 to-transparent" />
        </div>

        {/* Stella Video Container - NUOVO AVATAR ANIMATO */}
        <div className="relative w-full h-full flex items-center justify-center">
          <motion.div
            className="relative w-full h-full max-w-md mx-auto"
            animate={isSpeaking ? {
              scale: [1, 1.02, 1]
            } : {}}
            transition={{
              repeat: isSpeaking ? Infinity : 0,
              duration: 2,
              ease: "easeInOut"
            }}
          >
            {/* NUOVO: Avatar con lip-sync basato su audio */}
            <StellaVideoAvatarSimple
              isSpeaking={isSpeaking}
              isListening={isListening}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Chat Interface */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        className="w-1/2 bg-white flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <h2 className="text-2xl font-bold mb-2">
            {isConnecting ? 'Connessione in corso...' :
             isConnected ? 'Stella - Assistente LAPA' :
             'Offline'}
          </h2>

          <p className="text-blue-100">
            {hasError ? (
              <span className="text-red-300">❌ {errorMessage}</span>
            ) : isConnecting ? 'Sto preparando la conversazione vocale...' :
             isConnected ? (
               isListening ? 'Ti sto ascoltando con attenzione...' :
               isSpeaking ? 'Stella sta parlando...' :
               'Ciao! Parla o scrivi per iniziare!'
             ) : 'Connessione interrotta'}
          </p>

          {/* Connection Status */}
          <div className="mt-3 text-sm">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              hasError ? 'bg-red-400' :
              isConnected ? 'bg-green-400' :
              isConnecting ? 'bg-yellow-400' :
              'bg-gray-400'
            }`}></span>
            {hasError ? 'Errore' :
             isConnected ? 'Connesso (WebRTC)' :
             isConnecting ? 'Connessione...' :
             'Disconnesso'}
          </div>
        </div>

        {/* Retry button for errors */}
        {hasError && (
          <div className="p-4 bg-red-50 border-b">
            <button
              onClick={retryConnection}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              🔄 Riprova connessione
            </button>
          </div>
        )}

        {/* Action context */}
        {action && (
          <div className="p-4 bg-blue-50 border-b">
            <p className="text-sm text-blue-800">
              <strong>Contesto:</strong> {action.title}
            </p>
          </div>
        )}

        {/* Conversation */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <div className="space-y-4">
            {conversation.map((message, index) => {
              const isUser = message.startsWith('Tu:') || message.startsWith('🎤 Tu:') || message.startsWith('📝 Tu:');
              const isError = message.startsWith('❌ Errore:');
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      isUser
                        ? 'bg-blue-500 text-white'
                        : isError
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-white text-gray-800 shadow-sm border'
                    }`}
                  >
                    {message}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Text Input */}
        {isConnected && (
          <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Scrivi il tuo messaggio qui..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={sendTextMessage}
                disabled={!textInput.trim() || isSpeaking}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-semibold"
              >
                Invia
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 bg-gray-100 border-t flex justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all font-semibold ${
              isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={!isConnected || !audioStreamRef.current}
            title={isMuted ? 'Attiva microfono' : 'Disattiva microfono'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={endConversation}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all font-semibold"
            title="Termina conversazione"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}