import { useState, useRef } from 'react';
import { toast } from '../lib/toast';

interface UseVoiceInputOptions {
  onTranscribed?: (text: string) => void;
  language?: string;
}

interface UseVoiceInputReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string | null;
}

/**
 * Hook for voice input and transcription using local STT server or Whisper API
 */
export function useVoiceInput({
  onTranscribed,
  language = 'hu',
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        setError(`Mikrofonhiba: ${e.error}`);
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      toast.info('🎤 Beszél...');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mikrofon hiba';
      setError(message);
      toast.error(`Mikrofon nem érhető el: ${message}`);
    }
  };

  const stopRecording = async (): Promise<void> => {
    if (!mediaRecorderRef.current || !isRecording) return;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      const audioChunks = audioChunksRef.current;
      const audioStream = mediaRecorder.stream;

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);

        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

          // Stop microphone stream
          audioStream.getTracks().forEach((track) => track.stop());

          // Convert blob to base64
          const arrayBuffer = await audioBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          // Try local STT server first
          let transcription: string | null = null;

          try {
            const localFormData = new FormData();
            localFormData.append('audio', audioBlob, 'audio.webm');
            localFormData.append('language', language);

            const localResponse = await fetch('http://127.0.0.1:18790/transcribe', {
              method: 'POST',
              body: localFormData,
              signal: AbortSignal.timeout(30000),
            });

            if (localResponse.ok) {
              const data = (await localResponse.json()) as { text: string };
              transcription = data.text;
            }
          } catch (err) {
            console.warn('Local STT server failed, fallback to Whisper API:', err);
          }

          // Fallback to Whisper API if local failed
          if (!transcription) {
            const response = await fetch('/api/emails/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, language }),
            });

            if (!response.ok) {
              throw new Error(`Transzkripció hiba: ${response.statusText}`);
            }

            const data = (await response.json()) as { text: string };
            transcription = data.text;
          }

          if (!transcription || transcription.trim().length === 0) {
            toast.info('Nem hallottam beszédet. Próbálj újra.');
          } else {
            toast.success('✅ Szöveg felismerve');
            onTranscribed?.(transcription);
          }

          setIsTranscribing(false);
          resolve();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
          setError(message);
          toast.error(`Transzkripció hiba: ${message}`);
          setIsTranscribing(false);
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  };

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    error,
  };
}
