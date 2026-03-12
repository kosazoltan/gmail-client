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
  Plus,
  Trash2,
  Check,
  X,
  ExternalLink,
  FolderSearch,
  Mail,
  Play,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import type {
  ChatMessage,
  Conversation,
  AgentExecutionResult,
  PendingAgentAction,
  WorkflowData,
} from '../../types';
import { WorkflowBuilder } from './WorkflowBuilder';

const SUGGESTION_BUTTONS = [
  { label: 'Foglald össze', icon: Sparkles, prompt: 'Foglald össze a kijelölt emaileket röviden.' },
  { label: 'Keress mintákat', icon: Search, prompt: 'Keress mintákat és ismétlődéseket az emailjeimben.' },
  { label: 'Készíts workflow-t', icon: Workflow, prompt: 'Javasolj egy workflow-t a kijelölt emailek alapján.' },
];

export function AIAssistantView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'assistant' | 'workflows'>(
    searchParams.get('tab') === 'workflows' ? 'workflows' : 'assistant',
  );
  const [messages, setMessages] = useState<Array<ChatMessage & {
    result?: AgentExecutionResult | null;
    pendingAction?: PendingAgentAction | null;
  }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showConversationDropdown, setShowConversationDropdown] = useState(false);
  const [workflowDraft, setWorkflowDraft] = useState<WorkflowData | null>(null);
  const [workflowDraftKey, setWorkflowDraftKey] = useState<string | null>(null);
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

  useEffect(() => {
    const nextTab = searchParams.get('tab') === 'workflows' ? 'workflows' : 'assistant';
    setActiveTab(nextTab);
  }, [searchParams]);

  const setTab = useCallback((tab: 'assistant' | 'workflows') => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'workflows') {
      nextParams.set('tab', 'workflows');
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await api.ai.getConversations();
      setConversations(data.conversations || []);
    } catch {
      // Silent fail
    }
  };

  const loadConversationMessages = async (convId: string) => {
    try {
      const data = await api.ai.getConversationMessages(convId);
      const restoredMessages = (data.messages || []).map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp,
          result: m.result ?? null,
          pendingAction: m.pendingAction ?? null,
        }));
      setMessages(restoredMessages);

      const latestWorkflowDraft = [...restoredMessages]
        .reverse()
        .find((m) => m.result?.kind === 'workflow_draft' && m.result.workflowDraft)?.result?.workflowDraft;
      if (latestWorkflowDraft) {
        setWorkflowDraft(latestWorkflowDraft);
        setWorkflowDraftKey(crypto.randomUUID());
      }
    } catch {
      // Silent fail
    }
  };

  const handleSelectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setShowConversationDropdown(false);
    await loadConversationMessages(convId);
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setWorkflowDraft(null);
    setWorkflowDraftKey(null);
    setShowConversationDropdown(false);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.ai.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages([]);
        setWorkflowDraft(null);
        setWorkflowDraftKey(null);
      }
    } catch {
      // Silent fail
    }
  };

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
      const data = await api.ai.chat(
        messageText,
        activeConversationId || undefined,
      );

      // Update active conversation ID (backend may have created a new one)
      if (data.conversationId && data.conversationId !== activeConversationId) {
        setActiveConversationId(data.conversationId);
        // Reload conversations list to include the new one
        await loadConversations();
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'Nem sikerült választ generálni.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [
        ...prev,
        {
          ...assistantMessage,
          result: data.result ?? null,
          pendingAction: data.pendingAction ?? null,
        },
      ]);

      if (data.result?.kind === 'workflow_draft' && data.result.workflowDraft) {
        setWorkflowDraft(data.result.workflowDraft);
        setWorkflowDraftKey(crypto.randomUUID());
        setTab('workflows');
      }
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

  const handleDismissPendingAction = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, pendingAction: null } : msg)),
    );
  };

  const handleConfirmAction = async (messageId: string, pendingAction: PendingAgentAction) => {
    try {
      setIsLoading(true);
      const data = await api.ai.confirmAction(pendingAction, activeConversationId || undefined);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, pendingAction: null } : msg)),
      );

      const assistantMessage: ChatMessage & {
        result?: AgentExecutionResult | null;
        pendingAction?: PendingAgentAction | null;
      } = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'A művelet végrehajtása megtörtént.',
        timestamp: Date.now(),
        result: data.result ?? null,
        pendingAction: null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.result?.kind === 'workflow_saved' || data.result?.kind === 'workflow_run') {
        setTab('workflows');
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Nem sikerült végrehajtani a jóváhagyott műveletet.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderResult = (result?: AgentExecutionResult | null) => {
    if (!result) return null;
    if (result.kind === 'workflow_draft' && (!result.workflowDraft || !result.workflowDraft.steps)) return null;

    if (result.kind === 'search') {
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-[#4f6ef7]/20 bg-[#4f6ef7]/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{result.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {result.resultCount ?? 0} találat
                {result.query ? ` • ${result.query}` : ''}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {(result.emails || []).slice(0, 6).map((email) => (
              <button
                key={email.id}
                onClick={() => navigate(email.appLink)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-[#4f6ef7]/30 hover:bg-[#4f6ef7]/5 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {email.subject || '(nincs tárgy)'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {email.fromName || email.fromEmail || 'Ismeretlen feladó'}
                </p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (result.kind === 'workflow_draft' && result.workflowDraft) {
      return (
        <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-50/80 p-3 dark:bg-violet-500/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{result.workflowDraft.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {result.workflowDraft.triggerType} • {result.workflowDraft.steps.length} lépés
              </p>
            </div>
            <button
              onClick={() => {
                setWorkflowDraft(result.workflowDraft!);
                setWorkflowDraftKey(crypto.randomUUID());
                setTab('workflows');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Builder
            </button>
          </div>
          {result.workflowDraft.description && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{result.workflowDraft.description}</p>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{result.warnings.join(' ')}</p>
          )}
        </div>
      );
    }

    if (result.kind === 'workflows') {
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          {(result.workflows || []).slice(0, 6).map((workflow) => (
            <div key={workflow.id} className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900/60">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{workflow.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {workflow.triggerType} • {workflow.stepCount} lépés • {workflow.isActive ? 'aktív' : 'inaktív'}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (result.kind === 'smart_folders') {
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          {(result.smartFolders || []).slice(0, 6).map((folder) => (
            <div key={folder.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-gray-900/60">
              <div className="flex items-center gap-2">
                <FolderSearch className="h-4 w-4 text-[#4f6ef7]" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{folder.name}</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{folder.count}</span>
            </div>
          ))}
        </div>
      );
    }

    if (result.kind === 'navigation' && result.navigation) {
      return (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <button
            onClick={() => navigate(result.navigation!.path)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#4f6ef7]/30 px-3 py-2 text-sm font-medium text-[#4f6ef7] hover:bg-[#4f6ef7]/10"
          >
            <ExternalLink className="h-4 w-4" />
            {result.navigation.label}
          </button>
        </div>
      );
    }

    if (result.kind === 'workflow_saved' && result.workflow) {
      return (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-50 p-3 dark:bg-emerald-500/10">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">{result.workflow.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Elmentve • {result.workflow.stepCount ?? 0} lépés
          </p>
        </div>
      );
    }

    if (result.kind === 'workflow_run' && result.workflowRun) {
      return (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-50 p-3 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Workflow futtatás elindítva</p>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Státusz: {result.workflowRun.status} • Run ID: {result.workflowRun.id}
          </p>
        </div>
      );
    }

    if (result.kind === 'email' && result.emails?.[0]) {
      return (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <button
            onClick={() => navigate(result.emails![0].appLink)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#4f6ef7]/30 px-3 py-2 text-sm font-medium text-[#4f6ef7] hover:bg-[#4f6ef7]/10"
          >
            <Mail className="h-4 w-4" />
            Email megnyitása
          </button>
        </div>
      );
    }

    return null;
  };

  const activeConvTitle = conversations.find((c) => c.id === activeConversationId)?.title || 'Új beszélgetés';

  return (
    <div className="flex h-full flex-col">
      {/* Tab header */}
      <div className={cn('mx-auto w-full px-6 pt-6', activeTab === 'workflows' ? 'max-w-6xl' : 'max-w-4xl')}>
        <div className="dark:border-dark-border mb-4 flex border-b border-gray-200">
          <button
            onClick={() => setTab('assistant')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'assistant'
                ? 'border-b-2 border-[#4f6ef7] text-[#4f6ef7]'
                : 'dark:text-dark-text-secondary text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            🤖 AI Asszisztens
          </button>
          <button
            onClick={() => setTab('workflows')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'workflows'
                ? 'border-b-2 border-[#4f6ef7] text-[#4f6ef7]'
                : 'dark:text-dark-text-secondary text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            ⚡ Workflow-k
          </button>
        </div>
      </div>

      <div className={cn('flex-1 overflow-y-auto', activeTab !== 'workflows' && 'hidden')}>
        <WorkflowBuilder
          externalDraft={workflowDraft}
          externalDraftKey={workflowDraftKey}
        />
      </div>

      <div className={cn('mx-auto flex h-full max-w-4xl flex-col p-6', activeTab !== 'assistant' && 'hidden')}>
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
        <div className="relative mb-4 flex items-center gap-2">
          <button
            onClick={() => setShowConversationDropdown(!showConversationDropdown)}
            className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <MessageSquare className="h-4 w-4" />
            {activeConvTitle}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showConversationDropdown && 'rotate-180')} />
          </button>
          <button
            onClick={handleNewConversation}
            className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            title="Új beszélgetés"
          >
            <Plus className="h-4 w-4" />
          </button>
          {showConversationDropdown && (
            <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full left-0 z-10 mt-1 max-h-64 min-w-[240px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                onClick={handleNewConversation}
                className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Új beszélgetés
              </button>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'dark:hover:bg-dark-bg-tertiary group flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50',
                    conv.id === activeConversationId
                      ? 'font-medium text-[#4f6ef7]'
                      : 'dark:text-dark-text-secondary text-gray-600',
                  )}
                >
                  <span className="truncate">{conv.title}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="ml-2 hidden shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:block dark:hover:bg-red-900/20"
                    title="Beszélgetés törlése"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
                {msg.role === 'assistant' && renderResult(msg.result)}
                {msg.role === 'assistant' && msg.pendingAction && (
                  <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-50/90 p-3 dark:bg-amber-500/10">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{msg.pendingAction.title}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {msg.pendingAction.confirmationMessage}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleConfirmAction(msg.id, msg.pendingAction!)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Jóváhagyás
                      </button>
                      <button
                        onClick={() => handleDismissPendingAction(msg.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <X className="h-3.5 w-3.5" />
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
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
    </div>
  );
}
