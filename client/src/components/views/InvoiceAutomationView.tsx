import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { LoginScreen } from '../auth/LoginScreen';
import { useSession } from '../../hooks/useAccounts';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';

function markerValueSummary(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value ?? '');
  const record = value as Record<string, unknown>;
  return [record.status, record.company, record.count ? `${record.count} db` : null]
    .filter(Boolean)
    .join(' · ');
}

export function InvoiceAutomationView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [monthKey, setMonthKey] = useState('');

  const statusQuery = useQuery({
    queryKey: ['invoice-automation-status'],
    queryFn: () => api.invoiceAutomation.status(),
    enabled: !!session?.authenticated,
    refetchInterval: 60000,
  });

  const runMutation = useMutation({
    mutationFn: api.invoiceAutomation.run,
    onSuccess: (result) => {
      toast.success(
        result.monthKey
          ? `Számla újrafuttatás elindult/befejeződött: ${result.monthKey}`
          : 'Számla újrafuttatás elindult/befejeződött',
      );
      void queryClient.invalidateQueries({ queryKey: ['invoice-automation-status'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Újrafuttatás sikertelen'),
  });

  const aiLiveMutation = useMutation({
    mutationFn: api.invoiceAutomation.aiStatusLive,
    onSuccess: (result) => {
      const live = result.live;
      toast.success(live ? `AI live OK: ${live.provider} / ${live.model}` : 'AI live OK');
      void queryClient.invalidateQueries({ queryKey: ['invoice-automation-status'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'AI ellenőrzés sikertelen'),
  });

  if (!session?.authenticated) return <LoginScreen />;

  const status = statusQuery.data;
  const isBusy = runMutation.isPending || aiLiveMutation.isPending;

  return (
    <div className="dark:bg-dark-bg min-h-full overflow-auto bg-gray-50 p-3 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-500/20">
            <CalendarClock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="dark:text-dark-text text-xl font-semibold text-gray-800">
              Számla automatizálás
            </h1>
            <p className="dark:text-dark-text-muted text-sm text-gray-500">
              Havi gyűjtés, jóváhagyás és újrafuttatás
            </p>
          </div>
        </div>
        <button
          onClick={() => void statusQuery.refetch()}
          className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Frissítés
        </button>
      </div>

      {statusQuery.isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Betöltés...
        </div>
      ) : status ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <h2 className="dark:text-dark-text font-medium text-gray-800">Ütemezés és kapuk</h2>
            </div>
            <div className="space-y-3 text-sm">
              <p className="dark:text-dark-text-secondary text-gray-700">{status.schedule.daily}</p>
              <p className="dark:text-dark-text-secondary text-gray-700">
                {status.schedule.monthly}
              </p>
              <p className="dark:text-dark-text-secondary text-gray-700">{status.schedule.retry}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  disabled={isBusy}
                  onClick={() => runMutation.mutate({ mode: 'daily' })}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Play className="h-4 w-4" /> Napi gyűjtés újrafuttatása
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => runMutation.mutate({ mode: 'previous_month' })}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <Play className="h-4 w-4" /> Előző hónap teljes újrasöprése
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                  placeholder={status.schedule.previousMonthKey}
                  className="dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  disabled={isBusy || !/^\d{4}-\d{2}$/.test(monthKey)}
                  onClick={() => runMutation.mutate({ mode: 'month', monthKey })}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-white hover:bg-gray-900 disabled:opacity-60 dark:bg-gray-200 dark:text-gray-900"
                >
                  <Play className="h-4 w-4" /> Adott hónap újrasöprése
                </button>
              </div>
            </div>
          </section>

          <section className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              <h2 className="dark:text-dark-text font-medium text-gray-800">
                AI modell ellenőrzés
              </h2>
            </div>
            <div className="space-y-2 text-sm">
              <p className="dark:text-dark-text-secondary text-gray-700">
                Elsődleges: {status.ai.primaryInvoiceModel || 'nincs aktív modell'}
              </p>
              {status.ai.availableProviders.map((provider) => (
                <div key={provider.provider} className="flex items-center justify-between gap-2">
                  <span className="dark:text-dark-text-secondary text-gray-700">
                    {provider.provider}: {provider.model}
                  </span>
                  {provider.hasApiKey ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              ))}
              <button
                disabled={isBusy}
                onClick={() => aiLiveMutation.mutate()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-purple-200 px-3 py-2 text-purple-700 hover:bg-purple-50 disabled:opacity-60 dark:border-purple-500/30 dark:text-purple-300 dark:hover:bg-purple-500/10"
              >
                <Bot className="h-4 w-4" /> Live AI ellenőrzés
              </button>
            </div>
          </section>

          <section className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border border-gray-200 bg-white p-4 xl:col-span-2">
            <h2 className="dark:text-dark-text mb-3 font-medium text-gray-800">
              Legutóbbi futási markerek
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="dark:text-dark-text-muted text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="py-2 pr-3">Kulcs</th>
                    <th className="py-2 pr-3">Állapot</th>
                    <th className="py-2 pr-3">Frissítve</th>
                  </tr>
                </thead>
                <tbody>
                  {status.recentMarkers.length === 0 ? (
                    <tr>
                      <td className="dark:text-dark-text-muted py-3 text-gray-500" colSpan={3}>
                        Nincs még futási marker.
                      </td>
                    </tr>
                  ) : (
                    status.recentMarkers.map((marker) => (
                      <tr
                        key={marker.key}
                        className="dark:border-dark-border border-t border-gray-100"
                      >
                        <td className="dark:text-dark-text-secondary py-2 pr-3 font-mono text-xs text-gray-700">
                          {marker.key}
                        </td>
                        <td className="dark:text-dark-text-secondary py-2 pr-3 text-gray-700">
                          {markerValueSummary(marker.value)}
                        </td>
                        <td className="dark:text-dark-text-muted py-2 pr-3 text-gray-500">
                          {new Date(marker.updatedAt).toLocaleString('hu-HU')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="p-6 text-sm text-gray-500">Nincs státuszadat.</div>
      )}
    </div>
  );
}
