import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Search,
  Workflow,
  Loader2,
  MessageSquare,
  ChevronDown,
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

const SUGGESTION_BUTTONS = [
  { label: 'Foglald össze', icon: Sparkles, prompt: 'Foglald össze a kijelölt emaileket röviden.' },
  { label: 'Keress mintákat', icon: Search, prompt: 'Keress mintákat és ismétlődéseket az emailjeimben.' },
  { label: 'Készíts workflow-t', icon: Workflow, prompt: 'Javasolj egy workflow-t a kijelölt emailek alapján.' },
];

export function AIAssistantView() {
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
    inputRef.current?.focus();
  }, []);

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
        }),
      });

      if (!res.ok) throw new Error('AI válasz hiba');

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || 'Nem sikerült választ generálni.',
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

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="dark:text-dark-text flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Bot className="h-7 w-7 text-[#4f6ef7]" />
          AI Asszisztens
        </h1>
        <p className="dark:text-dark-text-secondary mt-1 text-sm text-gray-500">
          Kérdezz az emailjeidről, kérj összefoglalókat, vagy automatizáld a munkafolyamataidat
        </p>
      </div>

      {/* Conversation selector */}
      <div className="relative mb-4">
        <button
          onClick={() => setShowConversationDropdown(!showConversationDropdown)}
          className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <MessageSquare className="h-4 w-4" />
          {conversations.find((c) => c.id === activeConversation)?.title || 'Új beszélgetés'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', showConversationDropdown && 'rotate-180')} />
        </button>
        {showConversationDropdown && (
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversation(conv.id);
                  setShowConversationDropdown(false);
                }}
                className={cn(
                  'dark:hover:bg-dark-bg-tertiary w-full px-4 py-2 text-left text-sm hover:bg-gray-50',
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

      {/* Messages */}
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="dark:text-dark-text-muted flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <Bot className="mb-3 h-16 w-16 opacity-40" />
            <p className="mb-1 text-base font-medium">Hogyan segíthetek?</p>
            <p className="text-sm">Kérdezz az emailjeidről, vagy használd a javaslatokat alább.</p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
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
        </div>

        {isLoading && (
          <div className="mt-4 flex justify-start">
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
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTION_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              onClick={() => handleSend(btn.prompt)}
              className="dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              <btn.icon className="h-4 w-4" />
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="mt-4">
        <div className="dark:border-dark-border dark:bg-dark-bg-tertiary flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kérdezz az emailjeidről..."
            rows={1}
            className="dark:text-dark-text max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none dark:placeholder-gray-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 rounded-lg bg-[#4f6ef7] p-2.5 text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
            aria-label="Üzenet küldése"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
