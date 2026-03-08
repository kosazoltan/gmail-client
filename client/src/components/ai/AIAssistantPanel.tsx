import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  Search,
  Workflow,
  ChevronDown,
  Loader2,
  MessageSquare,
  Inbox,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { API_BASE } from '../../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextLabel?: string;
  selectedEmailCount?: number;
}

const SUGGESTION_BUTTONS = [
  { label: 'Foglald össze', icon: Sparkles, prompt: 'Foglald össze a kijelölt emaileket röviden.' },
  { label: 'Keress mintákat', icon: Search, prompt: 'Keress mintákat és ismétlődéseket az emailjeimben.' },
  { label: 'Készíts workflow-t', icon: Workflow, prompt: 'Javasolj egy workflow-t a kijelölt emailek alapján.' },
];

export function AIAssistantPanel({
  isOpen,
  onClose,
  contextLabel = 'Beérkezett mappa',
  selectedEmailCount = 0,
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: 'Új beszélgetés', createdAt: Date.now() },
  ]);
  const [activeConversation, setActiveConversation] = useState('1');
  const [showConversationDropdown, setShowConversationDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: messageText,
          conversationId: activeConversation,
          context: contextLabel,
          selectedEmailCount,
        }),
      });

      if (!res.ok) throw new Error('AI válasz hiba');

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'Nem sikerült választ generálni.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Hiba történt a válasz generálása közben. Kérlek próbáld újra.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextDisplay =
    selectedEmailCount > 0
      ? `${selectedEmailCount} email kijelölve`
      : contextLabel;

  if (!isOpen) return null;

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-xl sm:w-96">
      {/* Header */}
      <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#4f6ef7]" />
          <h2 className="dark:text-dark-text font-semibold text-gray-900">AI Asszisztens</h2>
        </div>
        <button
          onClick={onClose}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Panel bezárása"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Conversation selector */}
      <div className="dark:border-dark-border relative border-b border-gray-100 px-4 py-2">
        <button
          onClick={() => setShowConversationDropdown(!showConversationDropdown)}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {conversations.find((c) => c.id === activeConversation)?.title || 'Új beszélgetés'}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', showConversationDropdown && 'rotate-180')} />
        </button>

        {showConversationDropdown && (
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute right-4 left-4 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversation(conv.id);
                  setShowConversationDropdown(false);
                }}
                className={cn(
                  'dark:hover:bg-dark-bg-tertiary w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                  conv.id === activeConversation
                    ? 'font-medium text-[#4f6ef7]'
                    : 'dark:text-dark-text-secondary text-gray-600',
                )}
              >
                {conv.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context indicator */}
      <div className="dark:border-dark-border border-b border-gray-100 px-4 py-2">
        <div className="dark:bg-dark-bg-tertiary dark:text-dark-text-secondary flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <Inbox className="h-3.5 w-3.5" />
          <span>Kontextus: {contextDisplay}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="dark:text-dark-text-muted flex flex-col items-center justify-center py-12 text-center text-gray-400">
            <Bot className="mb-3 h-12 w-12 opacity-50" />
            <p className="mb-1 text-sm font-medium">Hogyan segíthetek?</p>
            <p className="text-xs">Kérdezz az emailjeidről, vagy használd a javaslatokat alább.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-[#4f6ef7] text-white'
                  : 'dark:bg-dark-bg-tertiary dark:text-dark-text bg-gray-100 text-gray-800',
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p
                className={cn(
                  'mt-1 text-[10px]',
                  msg.role === 'user' ? 'text-white/60' : 'dark:text-dark-text-muted text-gray-400',
                )}
              >
                {new Date(msg.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="dark:bg-dark-bg-tertiary flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#4f6ef7]" />
              <span className="dark:text-dark-text-secondary text-sm text-gray-500">Gondolkodom...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion buttons */}
      {messages.length === 0 && (
        <div className="dark:border-dark-border border-t border-gray-100 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleSend(btn.prompt)}
                className="dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
              >
                <btn.icon className="h-3.5 w-3.5" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="dark:border-dark-border border-t border-gray-200 p-4">
        <div className="dark:border-dark-border dark:bg-dark-bg-tertiary flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kérdezz az emailjeidről..."
            rows={1}
            className="dark:text-dark-text max-h-24 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-gray-800 placeholder-gray-400 outline-none dark:placeholder-gray-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 rounded-lg bg-[#4f6ef7] p-2 text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
            aria-label="Üzenet küldése"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
