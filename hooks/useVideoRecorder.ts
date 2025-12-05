import { useState, useRef, useCallback, useEffect } from 'react';
import { getControlloVideoDB } from '@/lib/db/controlloVideoDB';

interface UseVideoRecorderOptions {
  batchId: number | null;
  chunkIntervalMs?: number;  // Default: 30000 (30 seconds)
  facingMode?: 'user' | 'environment';  // Default: 'environment' (rear camera)
}

interface UseVideoRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  previewStream: MediaStream | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: string | null;
  permissionDenied: boolean;
  chunksCount: number;
}

export function useVideoRecorder(options: UseVideoRecorderOptions): UseVideoRecorderReturn {
  const { batchId, chunkIntervalMs = 30000, facingMode = 'environment' } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [chunksCount, setChunksCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkIndexRef = useRef(0);
  const batchIdRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update batchId ref
  useEffect(() => {
    batchIdRef.current = batchId;
  }, [batchId]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!batchId) {
      setError('Batch ID non specificato');
      return false;
    }

    try {
      setError(null);
      setPermissionDenied(false);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 24 }
        },
        audio: false // No audio needed for control video
      });

      streamRef.current = stream;
      setPreviewStream(stream);

      // Find best supported mime type
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }

      console.log(`📹 [VideoRecorder] Using mimeType: ${mimeType}`);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 500000 // 500kbps for reasonable quality/size balance
      });

      // Reset chunk counter
      chunkIndexRef.current = 0;
      setChunksCount(0);

      // Initialize database recording
      const db = getControlloVideoDB();
      await db.startRecording(batchId);

      // Handle data chunks
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && batchIdRef.current) {
          try {
            const db = getControlloVideoDB();
            await db.saveChunk(batchIdRef.current, chunkIndexRef.current, event.data);
            chunkIndexRef.current++;
            setChunksCount(chunkIndexRef.current);
          } catch (err) {
            console.error('❌ [VideoRecorder] Errore salvataggio chunk:', err);
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ [VideoRecorder] MediaRecorder error:', event);
        setError('Errore durante la registrazione');
      };

      mediaRecorderRef.current = mediaRecorder;

      // Start recording with timeslice to get periodic chunks
      mediaRecorder.start(chunkIntervalMs);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      console.log(`🎬 [VideoRecorder] Registrazione avviata per batch ${batchId}`);
      return true;

    } catch (err: any) {
      console.error('❌ [VideoRecorder] Error starting recording:', err);

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setPermissionDenied(true);
          setError('Permesso fotocamera negato');
        } else if (err.name === 'NotFoundError') {
          setError('Nessuna fotocamera trovata');
        } else if (err.name === 'NotReadableError') {
          setError('Fotocamera già in uso');
        } else {
          setError(`Errore fotocamera: ${err.message}`);
        }
      } else {
        setError('Impossibile avviare la registrazione');
      }

      return false;
    }
  }, [batchId, facingMode, chunkIntervalMs]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise(async (resolve) => {
      console.log('🛑 [VideoRecorder] stopRecording chiamato, isRecording:', isRecording);

      if (!mediaRecorderRef.current || !isRecording) {
        console.warn('⚠️ [VideoRecorder] Nessuna registrazione attiva da fermare');
        resolve(null);
        return;
      }

      const currentBatchId = batchIdRef.current;
      const currentChunkIndex = chunkIndexRef.current;
      const currentRecordingTime = recordingTime;

      console.log(`🛑 [VideoRecorder] Fermando registrazione batch ${currentBatchId}, chunks: ${currentChunkIndex}`);

      // Track if we've received the final dataavailable event
      let finalChunkReceived = false;
      const originalOnDataAvailable = mediaRecorderRef.current.ondataavailable;

      // Override ondataavailable to track the final chunk
      mediaRecorderRef.current.ondataavailable = async (event) => {
        console.log(`📦 [VideoRecorder] ondataavailable durante stop, size: ${event.data.size}`);
        if (event.data.size > 0 && currentBatchId) {
          try {
            const db = getControlloVideoDB();
            await db.saveChunk(currentBatchId, chunkIndexRef.current, event.data);
            chunkIndexRef.current++;
            setChunksCount(chunkIndexRef.current);
            console.log(`✅ [VideoRecorder] Chunk finale salvato: ${chunkIndexRef.current}`);
          } catch (err) {
            console.error('❌ [VideoRecorder] Errore salvataggio chunk finale:', err);
          }
        }
        finalChunkReceived = true;
      };

      // Set up onstop handler before stopping
      mediaRecorderRef.current.onstop = async () => {
        console.log('🏁 [VideoRecorder] onstop triggered, finalChunkReceived:', finalChunkReceived);

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Stop camera stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setPreviewStream(null);

        // Small delay to ensure the final chunk is saved
        await new Promise(r => setTimeout(r, 200));

        // Combine all chunks
        if (currentBatchId) {
          try {
            const db = getControlloVideoDB();

            // Check how many chunks we have
            const chunksCount = await db.countChunks(currentBatchId);
            console.log(`📊 [VideoRecorder] Chunks in DB: ${chunksCount}`);

            if (chunksCount === 0) {
              console.error('❌ [VideoRecorder] Nessun chunk salvato!');
              resolve(null);
              return;
            }

            const combinedBlob = await db.combineChunks(currentBatchId);

            if (!combinedBlob || combinedBlob.size === 0) {
              console.error('❌ [VideoRecorder] Blob combinato vuoto!');
              resolve(null);
              return;
            }

            console.log(`✅ [VideoRecorder] Blob combinato: ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB`);

            // Update recording metadata
            await db.updateRecording(currentBatchId, {
              endTime: Date.now(),
              duration: currentRecordingTime,
              uploadStatus: 'pending',
              chunksCount: chunkIndexRef.current
            });

            console.log(`🎬 [VideoRecorder] Registrazione fermata, ${chunkIndexRef.current} chunks, ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB`);
            resolve(combinedBlob);
          } catch (err) {
            console.error('❌ [VideoRecorder] Errore combinazione chunks:', err);
            resolve(null);
          }
        } else {
          console.error('❌ [VideoRecorder] currentBatchId è null!');
          resolve(null);
        }
      };

      // Stop the recorder (this will trigger onstop)
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    });
  }, [isRecording, recordingTime]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    previewStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
    permissionDenied,
    chunksCount
  };
}
