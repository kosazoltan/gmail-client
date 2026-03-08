import { useState } from 'react';
import {
  useActionItems,
  useExtractActionItems,
  useToggleActionItem,
  useSentiment,
  useSuggestReply,
  useRelatedEmails,
} from '../../hooks/useIntelligence';
import {
  Brain,
  CheckSquare,
  Square,
  Loader2,
  Smile,
  Frown,
  AlertTriangle,
  Minus,
  MessageSquare,
  Link2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import type { SentimentResult, ReplySuggestion, RelatedEmail, ActionItem } from '../../types';

interface BulkAnalyzeResult {
  emailId: string;
  actionItems: ActionItem[];
  sentiment: SentimentResult;
}

interface EmailIntelligenceProps {
  emailId: string;
  emailIds?: string[];
  onSelectReply?: (subject: string, body: string) => void;
  onSelectRelated?: (emailId: string) => void;
}

function SentimentBadge({ sentiment }: { sentiment: SentimentResult['sentiment'] }) {
  const config = {
    urgent: { icon: AlertTriangle, label: 'Sürgős', color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
    positive: { icon: Smile, label: 'Pozitív', color: 'text-green-500 bg-green-50 dark:bg-green-500/10' },
    negative: { icon: Frown, label: 'Negatív', color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
    neutral: { icon: Minus, label: 'Semleges', color: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10' },
  };
  const c = config[sentiment];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', c.color)}>
      <c.icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}

export function EmailIntelligence({ emailId, emailIds, onSelectReply, onSelectRelated }: EmailIntelligenceProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentResult | null>(null);
  const [replySuggestions, setReplySuggestions] = useState<ReplySuggestion[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkAnalyzeResult[] | null>(null);

  // Hooks
  const { data: actionItemsData } = useActionItems(emailId);
  const extractMutation = useExtractActionItems();
  const toggleMutation = useToggleActionItem();
  const sentimentMutation = useSentiment(emailId);
  const replyMutation = useSuggestReply(emailId);
  const { data: relatedData } = useRelatedEmails(emailId);

  const actionItems = actionItemsData?.actionItems || [];
  const relatedEmails = relatedData?.relatedEmails || [];

  const toggle = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleExtractActions = () => {
    extractMutation.mutate(emailId);
  };

  const handleDetectSentiment = () => {
    sentimentMutation.mutate(undefined, {
      onSuccess: (data) => setSentimentData(data),
    });
  };

  const handleSuggestReply = () => {
    replyMutation.mutate(undefined, {
      onSuccess: (data) => setReplySuggestions(data.suggestions),
    });
  };

  const handleBulkAnalyze = async () => {
    const ids = emailIds || [];
    if (ids.length === 0) return;

    setBulkLoading(true);
    setBulkResults(null);
    try {
      const data = await api.intelligence.bulkAnalyze(ids.slice(0, 20));
      setBulkResults(data.results);
    } catch {
      // Silent fail
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="dark:border-dark-border rounded-xl border border-gray-200 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <Brain className="h-5 w-5 text-purple-500" />
        <span className="text-sm font-semibold dark:text-gray-200">Email Intelligence</span>
        <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
      </div>

      {/* Bulk Analyze */}
      {emailIds && emailIds.length > 1 && (
        <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
          {!bulkResults ? (
            <button
              onClick={handleBulkAnalyze}
              disabled={bulkLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
            >
              {bulkLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {bulkLoading ? 'Elemzés folyamatban...' : `Összes elemzése (${emailIds.length})`}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium dark:text-gray-200">
                <Zap className="h-4 w-4 text-purple-500" />
                Összefoglaló — {bulkResults.length} email elemezve
              </div>
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 p-2.5">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {bulkResults.reduce((sum, r) => sum + r.actionItems.length, 0)}
                  </div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Teendő</div>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2.5">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">
                    {bulkResults.filter((r) => r.sentiment.sentiment === 'urgent').length}
                  </div>
                  <div className="text-xs text-red-600/70 dark:text-red-400/70">Sürgős</div>
                </div>
              </div>
              {/* Sentiment distribution */}
              <div className="flex flex-wrap gap-1.5">
                {(['urgent', 'positive', 'negative', 'neutral'] as const).map((s) => {
                  const count = bulkResults.filter((r) => r.sentiment.sentiment === s).length;
                  if (count === 0) return null;
                  return (
                    <span key={s} className="flex items-center gap-1">
                      <SentimentBadge sentiment={s} />
                      <span className="text-xs text-gray-500">({count})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {/* Action Items */}
        <div>
          <button
            onClick={() => toggle('actions')}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-500" />
              <span className="font-medium dark:text-gray-200">Teendők</span>
              {actionItems.length > 0 && (
                <span className="rounded-full bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {actionItems.filter(i => !i.isDone).length}
                </span>
              )}
            </div>
            {openSection === 'actions' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {openSection === 'actions' && (
            <div className="px-4 pb-3 space-y-2">
              {actionItems.length === 0 && (
                <button
                  onClick={handleExtractActions}
                  disabled={extractMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 disabled:opacity-50"
                >
                  {extractMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Teendők kinyerése AI-val
                </button>
              )}
              {actionItems.map((item) => (
                <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                  <button
                    onClick={() => toggleMutation.mutate({ id: item.id, isDone: !item.isDone })}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {item.isDone ? (
                      <CheckSquare className="h-4 w-4 text-green-500" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                    )}
                  </button>
                  <span className={cn('text-sm dark:text-gray-300', item.isDone && 'text-gray-400 line-through')}>
                    {item.text}
                    {item.dueDate && (
                      <span className="ml-2 text-xs text-orange-500">
                        ({new Date(item.dueDate).toLocaleDateString('hu-HU')})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Sentiment */}
        <div>
          <button
            onClick={() => toggle('sentiment')}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-green-500" />
              <span className="font-medium dark:text-gray-200">Hangulat</span>
              {sentimentData && <SentimentBadge sentiment={sentimentData.sentiment} />}
            </div>
            {openSection === 'sentiment' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {openSection === 'sentiment' && (
            <div className="px-4 pb-3">
              {!sentimentData ? (
                <button
                  onClick={handleDetectSentiment}
                  disabled={sentimentMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 disabled:opacity-50"
                >
                  {sentimentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Hangulat elemzése
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SentimentBadge sentiment={sentimentData.sentiment} />
                    <span className="text-xs text-gray-500">
                      ({Math.round(sentimentData.confidence * 100)}% biztos)
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{sentimentData.reason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reply Suggestions */}
        <div>
          <button
            onClick={() => toggle('reply')}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span className="font-medium dark:text-gray-200">Válaszjavaslatok</span>
            </div>
            {openSection === 'reply' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {openSection === 'reply' && (
            <div className="px-4 pb-3 space-y-2">
              {!replySuggestions ? (
                <button
                  onClick={handleSuggestReply}
                  disabled={replyMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 disabled:opacity-50"
                >
                  {replyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Válaszjavaslatok generálása
                </button>
              ) : (
                replySuggestions.map((suggestion, i) => {
                  const toneLabels = { short: 'Rövid', medium: 'Közepes', detailed: 'Részletes' };
                  return (
                    <button
                      key={i}
                      onClick={() => onSelectReply?.(suggestion.subject, suggestion.body)}
                      className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                          {toneLabels[suggestion.tone]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                        {suggestion.body}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Related Emails */}
        <div>
          <button
            onClick={() => toggle('related')}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-indigo-500" />
              <span className="font-medium dark:text-gray-200">Kapcsolódó levelek</span>
              {relatedEmails.length > 0 && (
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {relatedEmails.length}
                </span>
              )}
            </div>
            {openSection === 'related' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {openSection === 'related' && (
            <div className="px-4 pb-3 space-y-1">
              {relatedEmails.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nincs kapcsolódó levél</p>
              ) : (
                relatedEmails.slice(0, 10).map((rel) => {
                  const relevanceColors = {
                    thread: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                    sender: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
                    topic: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
                  };
                  const relevanceLabels = { thread: 'Szál', sender: 'Küldő', topic: 'Téma' };
                  return (
                    <button
                      key={rel.id}
                      onClick={() => onSelectRelated?.(rel.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', relevanceColors[rel.relevance])}>
                        {relevanceLabels[rel.relevance]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm dark:text-gray-300">{rel.subject || '(nincs tárgy)'}</p>
                        <p className="truncate text-xs text-gray-500">{rel.fromName || rel.fromEmail}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(rel.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
