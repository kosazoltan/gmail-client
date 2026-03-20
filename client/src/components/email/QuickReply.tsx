import { useState } from 'react';
import { Send } from 'lucide-react';

interface QuickReplyProps {
  onSend: (text: string) => Promise<void>;
  isSending?: boolean;
}

export function QuickReply({ onSend, isSending = false }: QuickReplyProps) {
  const [text, setText] = useState('');

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    await onSend(trimmed);
    setText('');
  };

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
      <div className="p-3 sm:p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Gyors válasz..."
          rows={2}
          className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-text-muted w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors outline-none placeholder:text-gray-400 focus:border-[#4f6ef7]/50 focus:ring-2 focus:ring-[#4f6ef7]/20"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="dark:text-dark-text-muted text-xs text-gray-400">
            Enter: küldés • Shift+Enter: új sor
          </span>
          <button
            onClick={() => void handleSend()}
            disabled={!text.trim() || isSending}
            className="flex items-center gap-1.5 rounded-lg bg-[#4f6ef7] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? 'Küldés...' : 'Küldés'}
          </button>
        </div>
      </div>
    </div>
  );
}
