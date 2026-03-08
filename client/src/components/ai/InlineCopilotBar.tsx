import { useState } from 'react';
import {
  FileText,
  Reply,
  ListChecks,
  Languages,
  Loader2,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

interface InlineCopilotBarProps {
  emailId: string;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailSnippet?: string | null;
  emailFrom?: string | null;
}

type CopilotAction = 'summary' | 'reply' | 'tasks' | 'translate';

interface ActionResult {
  type: CopilotAction;
  content: string;
  label: string;
}

export function InlineCopilotBar({
  emailId,
  emailSubject,
  emailBody,
  emailSnippet,
  emailFrom,
}: InlineCopilotBarProps) {
  const [loading, setLoading] = useState<CopilotAction | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleAction = async (action: CopilotAction) => {
    if (loading) return;
    setLoading(action);
    setResult(null);

    try {
      switch (action) {
        case 'summary': {
          const emailContent = emailBody || emailSnippet || '';
          const prompt = `Foglald össze tömören ezt az emailt (max 3 mondat). Tárgy: "${emailSubject || 'N/A'}". Küldő: ${emailFrom || 'N/A'}. Tartalom: ${emailContent.slice(0, 2000)}`;
          const response = await api.ai.chat(prompt);
          setResult({ type: 'summary', content: response.reply, label: 'Összefoglalás' });
          break;
        }
        case 'reply': {
          const emailContent = emailBody || emailSnippet || '';
          const prompt = `Generálj egy rövid, professzionális magyar nyelvű válasz-vázlatot erre az emailre. Tárgy: "${emailSubject || ''}". Küldő: ${emailFrom || 'N/A'}. Tartalom: ${emailContent.slice(0, 2000)}. Csak a válasz szövegét add, fejléc nélkül.`;
          const response = await api.ai.chat(prompt);
          setResult({ type: 'reply', content: response.reply, label: 'Válasz vázlat' });
          break;
        }
        case 'tasks': {
          const emailContent = emailBody || emailSnippet || '';
          const prompt = `Listázd ki az ebben az emailben található feladatokat, teendőket, kéréseket, határidőket. Tárgy: "${emailSubject || ''}". Küldő: ${emailFrom || 'N/A'}. Tartalom: ${emailContent.slice(0, 2000)}. Ha nincs feladat, írd ki hogy "Nincs feladat az emailben."`;
          const response = await api.ai.chat(prompt);
          setResult({ type: 'tasks', content: response.reply, label: 'Feladatok' });
          break;
        }
        case 'translate': {
          const textToTranslate = emailBody || emailSnippet || '';
          if (!textToTranslate.trim()) {
            toast.error('Nincs fordítható tartalom');
            break;
          }
          const translateResult = await api.translate.translate(textToTranslate.slice(0, 5000), 'hu');
          setResult({
            type: 'translate',
            content: translateResult.translatedText,
            label: `Fordítás (${translateResult.detectedLanguage} → hu)`,
          });
          break;
        }
      }
    } catch (err) {
      toast.error('AI művelet sikertelen. Próbáld újra.');
    } finally {
      setLoading(null);
    }
  };

  const actions: Array<{ type: CopilotAction; icon: typeof FileText; label: string }> = [
    { type: 'summary', icon: FileText, label: 'Összefoglalás' },
    { type: 'reply', icon: Reply, label: 'Válasz generálás' },
    { type: 'tasks', icon: ListChecks, label: 'Feladatok kinyerése' },
    { type: 'translate', icon: Languages, label: 'Fordítás' },
  ];

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          <Sparkles className="h-3.5 w-3.5 text-[#4f6ef7]" />
          <span className="hidden sm:inline">AI Copilot</span>
        </div>

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

        {actions.map((action) => (
          <button
            key={action.type}
            onClick={() => handleAction(action.type)}
            disabled={loading !== null}
            aria-label={action.label}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
              loading === action.type
                ? 'bg-[#4f6ef7]/10 text-[#4f6ef7] dark:bg-[#4f6ef7]/20 dark:text-[#6d8cff]'
                : result?.type === action.type
                  ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              loading !== null && loading !== action.type && 'opacity-50',
            )}
          >
            {loading === action.type ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <action.icon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Result panel */}
      {result && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#4f6ef7]" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {result.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => setResult(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="max-h-60 overflow-auto px-3 pb-3">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                {result.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
