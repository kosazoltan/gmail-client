import { useState } from 'react';
import { Mic, Square, AlertCircle } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';

interface VoiceInputButtonProps {
  onTranscribed: (text: string) => void;
  className?: string;
}

export function VoiceInputButton({ onTranscribed, className = '' }: VoiceInputButtonProps) {
  const { isRecording, isTranscribing, startRecording, stopRecording, error } = useVoiceInput({
    onTranscribed,
    language: 'hu',
  });

  const [showErrorTooltip, setShowErrorTooltip] = useState(false);

  const handleClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isTranscribing}
        className={`dark:hover:bg-dark-bg-tertiary dark:text-dark-text flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 ${isRecording ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-400' : ''} ${error ? 'text-red-600 dark:text-red-400' : ''} ${className} `}
        title={isRecording ? 'Felvétel leállítása' : 'Mikrofon indítása'}
        onMouseEnter={() => error && setShowErrorTooltip(true)}
        onMouseLeave={() => setShowErrorTooltip(false)}
      >
        {isRecording ? (
          <>
            <Square className="h-4 w-4 animate-pulse" />
            <span className="text-xs sm:inline">Felvétel...</span>
          </>
        ) : isTranscribing ? (
          <>
            <Mic className="h-4 w-4" />
            <span className="text-xs sm:inline">Feldolgozás...</span>
          </>
        ) : error ? (
          <>
            <AlertCircle className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Hiba</span>
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Beszélj</span>
          </>
        )}
      </button>

      {/* Error tooltip */}
      {error && showErrorTooltip && (
        <div className="absolute right-0 bottom-full mb-2 flex max-w-xs flex-col rounded-lg bg-red-600 px-3 py-2 text-xs text-white shadow-lg">
          <span className="font-medium">Mikrofon hiba</span>
          <span className="text-red-100">{error}</span>
          <div className="absolute right-2 -bottom-1 h-2 w-2 rotate-45 bg-red-600" />
        </div>
      )}
    </div>
  );
}
