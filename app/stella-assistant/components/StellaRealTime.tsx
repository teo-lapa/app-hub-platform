'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface StellaRealTimeProps {
  actionId: string;
  onListeningChange: (listening: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
}

export default function StellaRealTime({
  actionId,
  onListeningChange,
  onSpeakingChange
}: StellaRealTimeProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [conversation, setConversation] = useState<Array<{type: 'user' | 'assistant', text: string}>>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load prompt for the selected action
  useEffect(() => {
    loadPromptForAction();
  }, [actionId]);

  // Video state sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
      video.playbackRate = 1.2;
      video.style.filter = 'brightness(1.15) contrast(1.1) saturate(1.1)';
    } else if (isListening) {
      video.playbackRate = 1.0;
      video.style.filter = 'brightness(1.05) contrast(1.05)';
    } else {
      video.playbackRate = 0.8;
      video.style.filter = 'brightness(1) contrast(1)';
    }
  }, [isSpeaking, isListening]);

  // Update parent component
  useEffect(() => {
    onListeningChange(isListening);
    onSpeakingChange(isSpeaking);
  }, [isListening, isSpeaking, onListeningChange, onSpeakingChange]);

  const loadPromptForAction = async () => {
    try {
      const response = await fetch(`/api/stella/tasks?action_id=${actionId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentPrompt(data.prompt || getDefaultPrompt(actionId));
      } else {
        setCurrentPrompt(getDefaultPrompt(actionId));
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
      setCurrentPrompt(getDefaultPrompt(actionId));
    }
  };

  const getDefaultPrompt = (actionId: string) => {
    const prompts = {
      general: "Sei Stella, un'assistente AI amichevole per LAPA. Rispondi in modo naturale e utile in italiano.",
      inventory: "Sei Stella, esperta di gestione magazzino. Aiuta con inventario, scorte e movimentazioni.",
      sales: "Sei Stella, assistente vendite. Aiuta con ordini, clienti e gestione commerciale.",
      support: "Sei Stella, supporto tecnico. Risolvi problemi e fornisci assistenza tecnica.",
      training: "Sei Stella, formatrice aziendale. Aiuta con formazione e procedure aziendali."
    };
    return prompts[actionId as keyof typeof prompts] || prompts.general;
  };

  const connectToOpenAI = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    toast.loading('Connessione a Stella in corso...');

    try {
      // Get ephemeral token
      const tokenResponse = await fetch('/api/openai/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get token');
      }

      const { client_secret } = await tokenResponse.json();

      // Create WebRTC connection
      const peerConnection = new RTCPeerConnection();

      // Add audio element for playback
      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;

      // Handle incoming audio stream
      peerConnection.ontrack = (event) => {
        if (audioElement) {
          audioElement.srcObject = event.streams[0];
        }
      };

      // Create data channel for communication
      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener('open', () => {
        console.log('📡 Data channel opened');
        setIsConnected(true);
        setIsConnecting(false);
        toast.dismiss();
        toast.success('Connessa a Stella! 🌟');

        // Send session configuration
        const sessionUpdate = {
          type: 'session.update',
          session: {
            instructions: currentPrompt,
            voice: 'nova',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        };
        dataChannel.send(JSON.stringify(sessionUpdate));
      });

      dataChannel.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      // Set up peer connection
      peerConnectionRef.current = peerConnection;

      // Create offer and set local description
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Connect to OpenAI
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';

      const response = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client_secret}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!response.ok) {
        throw new Error(`OpenAI connection failed: ${response.status}`);
      }

      const answerSDP = await response.text();
      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSDP
      });

      console.log('✅ WebRTC connection established');

    } catch (error) {
      console.error('❌ Connection error:', error);
      setIsConnecting(false);
      setIsConnected(false);
      toast.dismiss();
      toast.error('Errore di connessione a Stella');
    }
  };

  const handleRealtimeMessage = (message: any) => {
    switch (message.type) {
      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech started');
        setIsListening(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 Speech stopped');
        setIsListening(false);
        break;

      case 'response.audio.start':
        console.log('🔊 Response audio started');
        setIsSpeaking(true);
        break;

      case 'response.audio.done':
        console.log('🔊 Response audio done');
        setIsSpeaking(false);
        break;

      case 'conversation.item.created':
        if (message.item.type === 'message') {
          const content = message.item.content?.[0]?.text || '';
          if (message.item.role === 'user') {
            setConversation(prev => [...prev, { type: 'user', text: content }]);
          } else if (message.item.role === 'assistant') {
            setConversation(prev => [...prev, { type: 'assistant', text: content }]);
          }
        }
        break;

      case 'error':
        console.error('❌ OpenAI error:', message);
        toast.error(`Errore Stella: ${message.error?.message || 'Errore sconosciuto'}`);
        break;

      default:
        console.log('📨 Message:', message.type);
    }
  };

  const disconnect = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    toast.success('Disconnessa da Stella');
  };

  return (
    <div className="space-y-6">
      {/* Stella Video Avatar */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex justify-center mb-6"
      >
        <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-purple-400/50 shadow-2xl">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="/stella-avatar.mp4" type="video/mp4" />
            {/* Fallback animated gradient */}
            <div className="w-full h-full bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 animate-pulse flex items-center justify-center">
              <span className="text-4xl">🌟</span>
            </div>
          </video>

          {/* Status Overlay */}
          <AnimatePresence>
            {isSpeaking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"
              >
                <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-pulse"></div>
              </motion.div>
            )}
            {isListening && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-500/20 flex items-center justify-center"
              >
                <div className="w-16 h-16 border-4 border-red-400 rounded-full animate-ping"></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Connection Controls */}
      <div className="text-center">
        {!isConnected ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={connectToOpenAI}
            disabled={isConnecting}
            className={`px-8 py-4 rounded-full text-white font-semibold text-lg transition-all
              ${isConnecting
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
              }`}
          >
            {isConnecting ? (
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Connessione...</span>
              </div>
            ) : (
              '🎤 Inizia Conversazione'
            )}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={disconnect}
            className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-lg transition-all"
          >
            🛑 Disconnetti
          </motion.button>
        )}
      </div>

      {/* Conversation History */}
      {conversation.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-h-64 overflow-y-auto space-y-2 bg-white/5 rounded-lg p-4 backdrop-blur-sm"
        >
          <h4 className="font-semibold text-purple-300 mb-2">Conversazione:</h4>
          {conversation.map((msg, index) => (
            <div
              key={index}
              className={`p-2 rounded ${
                msg.type === 'user'
                  ? 'bg-blue-600/20 text-blue-200 ml-8'
                  : 'bg-purple-600/20 text-purple-200 mr-8'
              }`}
            >
              <strong>{msg.type === 'user' ? 'Tu:' : 'Stella:'}</strong> {msg.text}
            </div>
          ))}
        </motion.div>
      )}

      {/* Current Prompt Display */}
      {currentPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-purple-300 bg-white/5 p-3 rounded-lg"
        >
          <strong>Prompt attivo:</strong> {currentPrompt}
        </motion.div>
      )}
    </div>
  );
}