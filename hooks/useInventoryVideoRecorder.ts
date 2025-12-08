import { useState, useRef, useCallback, useEffect } from 'react';
import { getInventoryVideoDB } from '@/lib/db/inventoryVideoDB';

interface UseInventoryVideoRecorderOptions {
  locationId: number | null;
  chunkIntervalMs?: number;  // Default: 30000 (30 seconds)
  facingMode?: 'user' | 'environment';  // Default: 'environment' (rear camera)
}

interface UseInventoryVideoRecorderReturn {
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

export function useInventoryVideoRecorder(options: UseInventoryVideoRecorderOptions): UseInventoryVideoRecorderReturn {
  const { locationId, chunkIntervalMs = 30000, facingMode = 'environment' } = options;

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
  const locationIdRef = useRef<number | null>(null);

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

  // Update locationId ref
  useEffect(() => {
    locationIdRef.current = locationId;
  }, [locationId]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!locationId) {
      setError('Location ID non specificato');
      return false;
    }

    try {
      setError(null);
      setPermissionDenied(false);

      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 24, max: 30 }
        },
        audio: true // Include audio in inventory video
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

      console.log(`📹 [InventoryVideoRecorder] Using mimeType: ${mimeType}`);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1000000 // 1Mbps for higher quality
      });

      // Reset chunk counter
      chunkIndexRef.current = 0;
      setChunksCount(0);

      // Initialize database recording
      const db = getInventoryVideoDB();
      await db.startRecording(locationId);

      // Handle data chunks
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && locationIdRef.current) {
          try {
            const db = getInventoryVideoDB();
            await db.saveChunk(locationIdRef.current, chunkIndexRef.current, event.data);
            chunkIndexRef.current++;
            setChunksCount(chunkIndexRef.current);
          } catch (err) {
            console.error('❌ [InventoryVideoRecorder] Errore salvataggio chunk:', err);
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ [InventoryVideoRecorder] MediaRecorder error:', event);
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

      console.log(`🎬 [InventoryVideoRecorder] Registrazione avviata per location ${locationId}`);
      return true;

    } catch (err: any) {
      console.error('❌ [InventoryVideoRecorder] Error starting recording:', err);

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
  }, [locationId, facingMode, chunkIntervalMs]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise(async (resolve) => {
      console.log('🛑 [InventoryVideoRecorder] stopRecording chiamato, isRecording:', isRecording);

      if (!mediaRecorderRef.current || !isRecording) {
        console.warn('⚠️ [InventoryVideoRecorder] Nessuna registrazione attiva da fermare');
        resolve(null);
        return;
      }

      const currentLocationId = locationIdRef.current;
      const currentChunkIndex = chunkIndexRef.current;
      const currentRecordingTime = recordingTime;

      console.log(`🛑 [InventoryVideoRecorder] Fermando registrazione location ${currentLocationId}, chunks: ${currentChunkIndex}`);

      // Track if we've received the final dataavailable event
      let finalChunkReceived = false;
      const originalOnDataAvailable = mediaRecorderRef.current.ondataavailable;

      // Override ondataavailable to track the final chunk
      mediaRecorderRef.current.ondataavailable = async (event) => {
        console.log(`📦 [InventoryVideoRecorder] ondataavailable durante stop, size: ${event.data.size}`);
        if (event.data.size > 0 && currentLocationId) {
          try {
            const db = getInventoryVideoDB();
            await db.saveChunk(currentLocationId, chunkIndexRef.current, event.data);
            chunkIndexRef.current++;
            setChunksCount(chunkIndexRef.current);
            console.log(`✅ [InventoryVideoRecorder] Chunk finale salvato: ${chunkIndexRef.current}`);
          } catch (err) {
            console.error('❌ [InventoryVideoRecorder] Errore salvataggio chunk finale:', err);
          }
        }
        finalChunkReceived = true;
      };

      // Set up onstop handler before stopping
      mediaRecorderRef.current.onstop = async () => {
        console.log('🏁 [InventoryVideoRecorder] onstop triggered, finalChunkReceived:', finalChunkReceived);

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
        if (currentLocationId) {
          try {
            const db = getInventoryVideoDB();

            // Check how many chunks we have
            const chunksCount = await db.countChunks(currentLocationId);
            console.log(`📊 [InventoryVideoRecorder] Chunks in DB: ${chunksCount}`);

            if (chunksCount === 0) {
              console.error('❌ [InventoryVideoRecorder] Nessun chunk salvato!');
              resolve(null);
              return;
            }

            const combinedBlob = await db.combineChunks(currentLocationId);

            if (!combinedBlob || combinedBlob.size === 0) {
              console.error('❌ [InventoryVideoRecorder] Blob combinato vuoto!');
              resolve(null);
              return;
            }

            console.log(`✅ [InventoryVideoRecorder] Blob combinato: ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB`);

            // Update recording metadata - but don't fail if this errors
            try {
              await db.updateRecording(currentLocationId, {
                endTime: Date.now(),
                duration: currentRecordingTime,
                uploadStatus: 'pending',
                chunksCount: chunkIndexRef.current
              });
              console.log(`✅ [InventoryVideoRecorder] Metadata aggiornato`);
            } catch (metadataErr) {
              console.warn('⚠️ [InventoryVideoRecorder] Errore aggiornamento metadata (non bloccante):', metadataErr);
              // Continue anyway - the blob is valid
            }

            console.log(`🎬 [InventoryVideoRecorder] Registrazione fermata, ${chunkIndexRef.current} chunks, ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB`);
            resolve(combinedBlob);
          } catch (err) {
            console.error('❌ [InventoryVideoRecorder] Errore combinazione chunks:', err);
            resolve(null);
          }
        } else {
          console.error('❌ [InventoryVideoRecorder] currentLocationId è null!');
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
