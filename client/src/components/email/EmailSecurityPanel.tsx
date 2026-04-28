import { AlertTriangle, Info, Link2, Paperclip, ShieldCheck } from 'lucide-react';
import { getEmailSecurityInsights, type EmailSecurityInsight } from '../../lib/emailSecurity';
import { cn } from '../../lib/utils';
import type { Email } from '../../types';

function insightIcon(insight: EmailSecurityInsight) {
  if (insight.id.includes('link')) return Link2;
  if (insight.id.includes('attachment')) return Paperclip;
  if (insight.level === 'warning') return AlertTriangle;
  if (insight.level === 'good') return ShieldCheck;
  return Info;
}

export function EmailSecurityPanel({ email }: { email: Email }) {
  const insights = getEmailSecurityInsights(email);

  return (
    <div className="dark:border-dark-border dark:bg-dark-bg-tertiary/40 mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="dark:text-dark-text text-xs font-semibold text-gray-700">
          Eredet és biztonság
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => {
          const Icon = insightIcon(insight);
          return (
            <div
              key={insight.id}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-lg border px-2.5 py-2 text-xs',
                insight.level === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                  : insight.level === 'good'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">{insight.label}</div>
                <div className="mt-0.5 truncate opacity-80" title={insight.detail}>
                  {insight.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
