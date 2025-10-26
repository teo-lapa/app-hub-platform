'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface StellaVideoAvatarSimpleProps {
  isSpeaking: boolean;
  isListening: boolean;
  audioElement?: HTMLAudioElement;
}

/**
 * Avatar video di Stella con lip-sync SEMPLICE basato su audio
 * Analizza le frequenze audio in tempo reale e anima il video
 * NO API external - tutto client-side!
 */
export default function StellaVideoAvatarSimple({
  isSpeaking,
  isListening,
  audioElement
}: StellaVideoAvatarSimpleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [audioLevel, setAudioLevel] = useState(0);
  const [mouthScale, setMouthScale] = useState(1);

  // Setup audio analyzer quando Stella parla
  useEffect(() => {
    if (isSpeaking && audioElement) {
      setupAudioAnalyzer();
    } else {
      cleanupAudioAnalyzer();
    }

    return () => cleanupAudioAnalyzer();
  }, [isSpeaking, audioElement]);

  const setupAudioAnalyzer = async () => {
    try {
      if (!audioElement) return;

      // Crea audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Crea analyzer
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Connetti audio element all'analyzer
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);

      // Start analyzing
      analyzeAudio();

      console.log('🎤 Audio analyzer attivo per lip-sync');

    } catch (error) {
      console.error('❌ Errore setup audio analyzer:', error);
    }
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const analyze = () => {
      if (!analyserRef.current || !isSpeaking) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calcola volume medio (focus su frequenze voce: 85Hz - 255Hz)
      let sum = 0;
      const startFreq = Math.floor(dataArray.length * 0.1); // ~85Hz
      const endFreq = Math.floor(dataArray.length * 0.4);   // ~255Hz

      for (let i = startFreq; i < endFreq; i++) {
        sum += dataArray[i];
      }

      const average = sum / (endFreq - startFreq);
      const normalizedVolume = Math.min(average / 128, 1); // Normalizza 0-1

      setAudioLevel(normalizedVolume);

      // Calcola scala bocca basata su volume
      // Più volume = bocca più aperta
      const scale = 1 + (normalizedVolume * 0.15); // Max 15% scaling
      setMouthScale(scale);

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  const cleanupAudioAnalyzer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
    setMouthScale(1);
  };

  // Controlla playback rate del video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isSpeaking) {
      // Quando parla: velocità basata su volume audio
      const playbackRate = 0.9 + (audioLevel * 0.6); // 0.9-1.5x
      video.playbackRate = playbackRate;

      // Effetti visivi quando parla
      video.style.filter = `brightness(${1 + audioLevel * 0.2}) contrast(${1.05 + audioLevel * 0.1}) saturate(${1.1 + audioLevel * 0.1})`;
      video.style.transform = `scale(${1 + audioLevel * 0.02})`;
    } else if (isListening) {
      video.playbackRate = 1.0;
      video.style.filter = 'brightness(1.05) contrast(1.05)';
      video.style.transform = 'scale(1)';
    } else {
      video.playbackRate = 0.8;
      video.style.filter = 'brightness(1) contrast(1)';
      video.style.transform = 'scale(1)';
    }
  }, [isSpeaking, isListening, audioLevel]);

  return (
    <div className="relative w-full h-full">
      {/* Video Stella con effetto lip-sync */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover object-center transition-all duration-100"
        autoPlay
        loop
        muted
        playsInline
        style={{
          transformOrigin: 'center center'
        }}
      >
        <source src="/videos/stella.mp4" type="video/mp4" />
      </video>

      {/* Overlay bocca animata quando parla */}
      {isSpeaking && audioLevel > 0.1 && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Highlight area bocca */}
          <div
            className="absolute"
            style={{
              bottom: '35%',
              left: '50%',
              transform: `translateX(-50%) scale(${mouthScale})`,
              width: '30%',
              height: '15%',
              background: `radial-gradient(ellipse, rgba(255, 192, 203, ${audioLevel * 0.3}) 0%, transparent 70%)`,
              borderRadius: '50%',
              filter: 'blur(20px)',
              transition: 'transform 0.05s ease-out'
            }}
          />
        </motion.div>
      )}

      {/* Voice Visualization Overlay */}
      {isSpeaking && (
        <>
          <motion.div
            className="absolute inset-0 border-4 border-pink-500/60 rounded-lg"
            animate={{
              opacity: [0.4, 0.4 + audioLevel * 0.5, 0.4],
              scale: [1, 1 + audioLevel * 0.02, 1],
              boxShadow: [
                '0 0 20px rgba(236, 72, 153, 0.3)',
                `0 0 ${20 + audioLevel * 30}px rgba(236, 72, 153, ${0.3 + audioLevel * 0.3})`,
                '0 0 20px rgba(236, 72, 153, 0.3)'
              ]
            }}
            transition={{
              duration: 0.2,
              ease: "easeOut"
            }}
          />

          {/* Pulse quando parla forte */}
          {audioLevel > 0.5 && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg"
              animate={{
                opacity: [0, audioLevel * 0.4, 0]
              }}
              transition={{
                duration: 0.3,
                ease: "easeInOut"
              }}
            />
          )}
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
          animate={{
            scale: [1, 1 + audioLevel * 0.2, 1],
            opacity: [0.8, 0.8 + audioLevel * 0.2, 0.8]
          }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2"
        >
          <span>PARLANDO</span>
          {/* Volume indicator bars */}
          <div className="flex gap-1 items-end h-4">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-white rounded-full"
                animate={{
                  height: audioLevel > (i * 0.33) ? ['40%', '100%', '40%'] : '20%'
                }}
                transition={{
                  duration: 0.3,
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Name Plate */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
        <h3 className="text-lg font-bold">Stella</h3>
        <p className="text-sm text-gray-300">Assistente LAPA</p>
        {isSpeaking && audioLevel > 0.1 && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-pink-300">🎤 Live Audio</span>
            <div className="w-12 h-1 bg-gray-600 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-pink-400"
                style={{ width: `${audioLevel * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
