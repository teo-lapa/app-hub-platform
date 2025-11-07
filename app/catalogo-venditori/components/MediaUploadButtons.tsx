'use client';

import { useState, useRef } from 'react';

interface MediaUploadButtonsProps {
  onFileSelected: (file: File, type: 'image' | 'audio' | 'document') => void;
  onRecordingStart: () => void;
  onRecordingStop: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export default function MediaUploadButtons({
  onFileSelected,
  onRecordingStart,
  onRecordingStop,
  disabled = false
}: MediaUploadButtonsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Handle image upload
  const handleImageClick = () => {
    if (!disabled) {
      imageInputRef.current?.click();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelected(file, 'image');
    }
  };

  // Handle audio file upload
  const handleAudioClick = () => {
    if (!disabled) {
      audioInputRef.current?.click();
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onFileSelected(file, 'audio');
    }
  };

  // Handle document upload
  const handleDocumentClick = () => {
    if (!disabled) {
      documentInputRef.current?.click();
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file, 'document');
    }
  };

  // Handle voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        onRecordingStop(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      onRecordingStart();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Impossibile accedere al microfono. Verifica i permessi del browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioChange}
        className="hidden"
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={handleDocumentChange}
        className="hidden"
      />

      {/* Image Upload Button */}
      <button
        type="button"
        onClick={handleImageClick}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        title="Carica Foto"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium">Foto</span>
      </button>

      {/* Audio File Upload Button */}
      <button
        type="button"
        onClick={handleAudioClick}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        title="Carica Audio"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <span className="text-sm font-medium">Audio</span>
      </button>

      {/* Voice Recording Button */}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white border-red-600 animate-pulse'
            : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
        }`}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        title={isRecording ? 'Ferma Registrazione' : 'Registra Audio'}
      >
        {isRecording ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-sm font-medium">Stop</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-sm font-medium">Registra</span>
          </>
        )}
      </button>

      {/* Document Upload Button */}
      <button
        type="button"
        onClick={handleDocumentClick}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        title="Carica Documento"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium">File</span>
      </button>
    </div>
  );
}
