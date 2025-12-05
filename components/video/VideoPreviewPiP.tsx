'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2, Maximize2, Video, VideoOff } from 'lucide-react';

interface VideoPreviewPiPProps {
  stream: MediaStream | null;
  recordingTime: number;
  isRecording: boolean;
  chunksCount: number;
  onMinimize?: () => void;
  minimized?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function VideoPreviewPiP({
  stream,
  recordingTime,
  isRecording,
  chunksCount,
  onMinimize,
  minimized = false
}: VideoPreviewPiPProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        setIsVideoReady(true);
        // Explicitly play the video to ensure it starts
        videoRef.current?.play().catch(err => {
          console.warn('[VideoPreviewPiP] Could not autoplay video:', err);
        });
      };
      // Also try to play immediately
      videoRef.current.play().catch(() => {
        // Ignore - will play after metadata loads
      });
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (!stream || !isRecording) {
    return null;
  }

  // Minimized view - just a small red dot indicator
  if (minimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <button
          onClick={onMinimize}
          className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm rounded-full shadow-lg border border-white/20"
        >
          {/* Pulsing red dot */}
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
          </div>
          <span className="text-white text-sm font-mono">{formatTime(recordingTime)}</span>
          <Maximize2 className="w-4 h-4 text-white/70" />
        </button>
      </motion.div>
    );
  }

  // Full preview view
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 20 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <div className="relative w-36 h-28 rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-black">
          {/* Video preview */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(1)' }} // No mirror for rear camera
          />

          {/* Loading overlay */}
          {!isVideoReady && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <Video className="w-8 h-8 text-white/50 animate-pulse" />
            </div>
          )}

          {/* REC indicator */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-600/90 rounded-full">
            <div className="relative">
              <div className="w-2 h-2 bg-white rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping" />
            </div>
            <span className="text-[10px] text-white font-bold tracking-wide">REC</span>
          </div>

          {/* Recording time */}
          <div className="absolute bottom-1 left-1.5 text-[11px] text-white font-mono bg-black/70 px-1.5 py-0.5 rounded">
            {formatTime(recordingTime)}
          </div>

          {/* Chunks count (debug info) */}
          <div className="absolute bottom-1 right-8 text-[9px] text-white/60 font-mono">
            {chunksCount}
          </div>

          {/* Minimize button */}
          <button
            onClick={onMinimize}
            className="absolute top-1.5 right-1.5 p-1 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <Minimize2 className="w-3 h-3 text-white" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Error banner component for when camera permission is denied
interface CameraErrorBannerProps {
  error: string;
  onDismiss?: () => void;
}

export function CameraErrorBanner({ error, onDismiss }: CameraErrorBannerProps) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-4 left-4 right-4 z-50 bg-amber-500/95 backdrop-blur-sm text-white p-4 rounded-xl shadow-lg flex items-center gap-3"
    >
      <VideoOff className="w-6 h-6 flex-shrink-0" />
      <div className="flex-1">
        <div className="font-semibold">Registrazione video non disponibile</div>
        <div className="text-sm opacity-90">{error}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>
      )}
    </motion.div>
  );
}

export default VideoPreviewPiP;
