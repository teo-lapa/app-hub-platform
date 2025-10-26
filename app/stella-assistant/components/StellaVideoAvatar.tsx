'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface StellaVideoAvatarProps {
  isSpeaking: boolean;
  isListening: boolean;
  audioStream?: MediaStream;
}

/**
 * Avatar video di Stella con animazione lip-sync REALE
 *
 * Usa D-ID per sincronizzare le labbra con l'audio
 * quando Stella parla, altrimenti mostra video statico
 */
export default function StellaVideoAvatar({ isSpeaking, isListening, audioStream }: StellaVideoAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const didVideoRef = useRef<HTMLVideoElement>(null);
  const [didStreamActive, setDidStreamActive] = useState(false);
  const [didPeerConnection, setDidPeerConnection] = useState<RTCPeerConnection | null>(null);
  const didStreamIdRef = useRef<string | null>(null);
  const didSessionIdRef = useRef<string | null>(null);

  // Inizializza D-ID stream quando Stella inizia a parlare
  useEffect(() => {
    if (isSpeaking && !didStreamActive && audioStream) {
      initDIDStream();
    } else if (!isSpeaking && didStreamActive) {
      closeDIDStream();
    }
  }, [isSpeaking, audioStream]);

  const initDIDStream = async () => {
    try {
      console.log('🎬 Inizializzazione D-ID stream per Stella');

      // Crea stream D-ID
      const response = await fetch('/api/stella/did-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Usiamo il video di Stella esistente
          videoUrl: '/videos/stella.mp4'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create DID stream');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      didStreamIdRef.current = data.data.streamId;
      didSessionIdRef.current = data.data.sessionId;

      // Setup WebRTC peer connection con D-ID
      const pc = new RTCPeerConnection({
        iceServers: data.data.iceServers || []
      });

      setDidPeerConnection(pc);

      // Ricevi video stream da D-ID
      pc.ontrack = (event) => {
        console.log('✅ D-ID video track ricevuto');
        if (didVideoRef.current && event.streams[0]) {
          didVideoRef.current.srcObject = event.streams[0];
          didVideoRef.current.play();
          setDidStreamActive(true);
        }
      };

      // Set remote description (offer da D-ID)
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: data.data.offer.sdp
      });
      await pc.setRemoteDescription(offer);

      // Crea answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Invia answer a D-ID
      await fetch(`https://api.d-id.com/talks/streams/${didStreamIdRef.current}/sdp`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${process.env.NEXT_PUBLIC_DID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answer: pc.localDescription,
          session_id: didSessionIdRef.current
        })
      });

      console.log('✅ D-ID stream connesso con successo');

    } catch (error) {
      console.error('❌ Errore inizializzazione D-ID:', error);
      // Fallback a video statico
      setDidStreamActive(false);
    }
  };

  const closeDIDStream = async () => {
    try {
      if (didPeerConnection) {
        didPeerConnection.close();
        setDidPeerConnection(null);
      }

      if (didStreamIdRef.current && didSessionIdRef.current) {
        await fetch('/api/stella/did-stream', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: didStreamIdRef.current,
            sessionId: didSessionIdRef.current
          })
        });
      }

      setDidStreamActive(false);
      didStreamIdRef.current = null;
      didSessionIdRef.current = null;

      console.log('✅ D-ID stream chiuso');

    } catch (error) {
      console.error('❌ Errore chiusura D-ID stream:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeDIDStream();
    };
  }, []);

  // Controlla playback rate del video statico
  useEffect(() => {
    const video = videoRef.current;
    if (!video || didStreamActive) return;

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
  }, [isSpeaking, isListening, didStreamActive]);

  return (
    <div className="relative w-full h-full">
      {/* Video statico (quando non parla o fallback) */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover object-center transition-all duration-300 ${
          didStreamActive ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        autoPlay
        loop
        muted
        playsInline
        style={{
          transform: isSpeaking ? 'scale(1.02)' : 'scale(1)'
        }}
      >
        <source src="/videos/stella.mp4" type="video/mp4" />
      </video>

      {/* Video animato D-ID (quando parla) */}
      {didStreamActive && (
        <video
          ref={didVideoRef}
          className="absolute inset-0 w-full h-full object-cover object-center"
          autoPlay
          playsInline
        />
      )}

      {/* Voice Visualization Overlay */}
      {isSpeaking && (
        <>
          <motion.div
            className="absolute inset-0 border-4 border-pink-500/60 rounded-lg"
            animate={{
              opacity: [0.4, 0.9, 0.4],
              scale: [1, 1.02, 1],
              boxShadow: [
                '0 0 20px rgba(236, 72, 153, 0.3)',
                '0 0 40px rgba(236, 72, 153, 0.6)',
                '0 0 20px rgba(236, 72, 153, 0.3)'
              ]
            }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg"
            animate={{
              opacity: [0, 0.3, 0]
            }}
            transition={{
              repeat: Infinity,
              duration: 0.8,
              ease: "easeInOut"
            }}
          />
        </>
      )}

      {/* Status Indicators */}
      {isListening && (
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute top-4 right-4 bg-green-500 text-white px-3 py-2 rounded-full text-sm font-semibold shadow-lg"
        >
          ASCOLTO
        </motion.div>
      )}

      {isSpeaking && (
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-full text-sm font-semibold shadow-lg"
        >
          {didStreamActive ? 'PARLANDO (LIP-SYNC)' : 'PARLANDO'}
        </motion.div>
      )}

      {/* Name Plate */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
        <h3 className="text-lg font-bold">Stella</h3>
        <p className="text-sm text-gray-300">Assistente LAPA</p>
        {didStreamActive && (
          <p className="text-xs text-pink-300 mt-1">🎬 Live Animation</p>
        )}
      </div>
    </div>
  );
}
