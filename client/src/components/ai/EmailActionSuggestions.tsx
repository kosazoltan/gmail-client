import { useState, useEffect } from 'react';
import {
  Reply,
  Forward,
  CheckSquare,
  Mail,
  Workflow,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ActionSuggestion {
  id: string;
  type: 'reply' | 'forward' | 'task' | 'similar' | 'workflow';
  label: string;
  description?: string;
  urgent?: boolean;
  count?: number;
  workflowName?: string;
}

interface EmailActionSuggestionsProps {
  emailId: string;
  emailSubject?: string;
  emailFrom?: string;
  className?: string;
  onReply?: () => void;
  onForward?: (to?: string) => void;
  onCreateTask?: () => void;
  onShowSimilar?: () => void;
  onRunWorkflow?: (workflowName: string) => void;
}

export function EmailActionSuggestions({
  emailId,
  emailSubject,
  emailFrom,
  className,
  onReply,
  onForward,
  onCreateTask,
  onShowSimilar,
  onRunWorkflow,
}: EmailActionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!emailId) return;

    setIsLoading(true);
    setError(false);

    // Use default suggestions only
    setSuggestions(getDefaultSuggestions());
    setIsLoading(false);
  }, [emailId, emailSubject, emailFrom]);

  function getDefaultSuggestions(): ActionSuggestion[] {
    return [
      { id: 'reply', type: 'reply', label: 'Válaszolj erre', description: 'Gyors válasz', urgent: false },
      { id: 'task', type: 'task', label: 'Készíts feladatot', description: 'Feladat ebből az emailből' },
      { id: 'similar', type: 'similar', label: 'Hasonló emailek', count: 0 },
    ];
  }

  const getIcon = (type: ActionSuggestion['type']) => {
    switch (type) {
      case 'reply': return Reply;
      case 'forward': return Forward;
      case 'task': return CheckSquare;
      case 'similar': return Mail;
      case 'workflow': return Workflow;
    }
  };

  const handleAction = (suggestion: ActionSuggestion) => {
    switch (suggestion.type) {
      case 'reply':
        onReply?.();
        break;
      case 'forward':
        onForward?.();
        break;
      case 'task':
        onCreateTask?.();
        break;
      case 'similar':
        onShowSimilar?.();
        break;
      case 'workflow':
        if (suggestion.workflowName) onRunWorkflow?.(suggestion.workflowName);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className={cn('dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4', className)}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#4f6ef7]" />
          <span className="dark:text-dark-text-secondary text-sm text-gray-500">AI javaslatok betöltése...</span>
        </div>
      </div>
    );
  }

  if (error || suggestions.length === 0) return null;

  return (
    <div className={cn('dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#4f6ef7]" />
        <h3 className="dark:text-dark-text text-sm font-medium text-gray-800">AI Javaslatok</h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const Icon = getIcon(suggestion.type);
          return (
            <button
              key={suggestion.id}
              onClick={() => handleAction(suggestion)}
              className={cn(
                'dark:border-dark-border dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-50',
                suggestion.urgent && 'border-orange-200 bg-orange-50/50 dark:border-orange-500/20 dark:bg-orange-500/5',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  suggestion.urgent ? 'text-orange-500' : 'text-[#4f6ef7]',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="dark:text-dark-text text-sm font-medium text-gray-800">
                    {suggestion.label}
                  </span>
                  {suggestion.urgent && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                      <AlertCircle className="h-2.5 w-2.5" />
                      sürgős
                    </span>
                  )}
                </div>
                {suggestion.description && (
                  <p className="dark:text-dark-text-muted mt-0.5 text-xs text-gray-500">
                    {suggestion.description}
                  </p>
                )}
                {suggestion.type === 'similar' && suggestion.count !== undefined && suggestion.count > 0 && (
                  <p className="mt-0.5 text-xs text-[#4f6ef7] dark:text-[#6d8cff]">
                    {suggestion.count} hasonló email
                  </p>
                )}
                {suggestion.type === 'workflow' && suggestion.workflowName && (
                  <p className="mt-0.5 text-xs text-[#4f6ef7] dark:text-[#6d8cff]">
                    Workflow: {suggestion.workflowName}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
