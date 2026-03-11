import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Loader2,
  RefreshCw,
  ArrowUp,
  Star,
  Bell,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/useAccounts';
import type { DailyStats, PriorityEmail, FollowUp, ContactActivity } from '../../types';

// --- Component ---

export function DailyBriefView() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [priorities, setPriorities] = useState<PriorityEmail[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [contacts, setContacts] = useState<ContactActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [briefRes, priorityRes, followUpRes] = await Promise.allSettled([
        api.smart.getDailyBrief(),
        api.smart.getPriorities(),
        api.smart.getFollowUps(),
      ]);

      if (briefRes.status === 'fulfilled') {
        setStats(briefRes.value.stats);
        setContacts(briefRes.value.contacts || []);
      }
      if (priorityRes.status === 'fulfilled') {
        setPriorities(priorityRes.value.priorities || []);
      }
      if (followUpRes.status === 'fulfilled') {
        setFollowUps(followUpRes.value.followups || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a napi összefoglaló betöltésekor');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date().toLocaleDateString('hu-HU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Jó reggelt! ☀️';
    if (hour < 18) return 'Jó napot! 🌤️';
    return 'Jó estét! 🌙';
  })();

  const openEmail = useCallback(
    (emailId: string) => {
      const params = new URLSearchParams({ emailId });
      if (session?.activeAccountId) {
        params.set('accountId', session.activeAccountId);
      }
      navigate(`/?${params.toString()}`);
    },
    [navigate, session?.activeAccountId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="dark:text-dark-text flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Sun className="h-7 w-7 text-amber-500" />
            Napi Összefoglaló
          </h1>
          <p className="dark:text-dark-text-secondary mt-1 text-sm text-gray-500">
            {greeting} — {today}
          </p>
        </div>
        <button
          onClick={loadData}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          title="Frissítés"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-500/15">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="dark:text-dark-text text-2xl font-bold text-gray-900">{stats?.received ?? 0}</p>
              <p className="dark:text-dark-text-secondary text-xs text-gray-500">Beérkezett ma</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-500/15">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="dark:text-dark-text text-2xl font-bold text-gray-900">{stats?.replied ?? 0}</p>
              <p className="dark:text-dark-text-secondary text-xs text-gray-500">Megválaszolva</p>
            </div>
          </div>
        </div>

        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2.5 dark:bg-orange-500/15">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="dark:text-dark-text text-2xl font-bold text-gray-900">{stats?.pending ?? 0}</p>
              <p className="dark:text-dark-text-secondary text-xs text-gray-500">Válaszra vár</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Priority emails */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="dark:text-dark-text mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Star className="h-4 w-4 text-amber-500" />
            Top Prioritás
          </h2>
          {priorities.length === 0 ? (
            <p className="dark:text-dark-text-muted py-6 text-center text-xs text-gray-400">
              Nincs kiemelt prioritású email
            </p>
          ) : (
            <div className="space-y-3">
              {priorities.slice(0, 5).map((email) => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email.id)}
                  className="dark:border-dark-border block w-full rounded-lg border border-gray-100 p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-start gap-2">
                    <ArrowUp
                      className={cn(
                        'mt-0.5 h-4 w-4 flex-shrink-0',
                        email.priority === 'urgent' ? 'text-red-600' : email.priority === 'high' ? 'text-red-500' : email.priority === 'normal' ? 'text-gray-500' : 'text-blue-500',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="dark:text-dark-text truncate text-sm font-medium text-gray-800">
                        {email.subject || '(nincs tárgy)'}
                      </p>
                      <p className="dark:text-dark-text-secondary mt-0.5 text-xs text-gray-500">
                        {email.fromName || email.from}
                      </p>
                      {email.reason && (
                        <p className="mt-1 text-[10px] text-[#4f6ef7] dark:text-[#6d8cff]">
                          {email.reason}
                        </p>
                      )}
                    </div>
                    <span className="dark:text-dark-text-muted text-[10px] text-gray-400">
                      {new Date(email.receivedAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Follow-up reminders */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="dark:text-dark-text mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Bell className="h-4 w-4 text-purple-500" />
            Follow-up Emlékeztetők
          </h2>
          {followUps.length === 0 ? (
            <p className="dark:text-dark-text-muted py-6 text-center text-xs text-gray-400">
              Nincs aktív follow-up
            </p>
          ) : (
            <div className="space-y-3">
              {followUps.slice(0, 5).map((fu) => (
                <button
                  key={fu.emailId}
                  onClick={() => openEmail(fu.emailId)}
                  className="dark:border-dark-border block w-full rounded-lg border border-gray-100 p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4 flex-shrink-0',
                        fu.urgency === 'critical' || fu.urgency === 'high' ? 'text-red-500' : fu.urgency === 'medium' ? 'text-amber-500' : 'text-blue-500',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="dark:text-dark-text truncate text-sm font-medium text-gray-800">
                        {fu.subject || '(nincs tárgy)'}
                      </p>
                      <p className="dark:text-dark-text-secondary mt-0.5 text-xs text-gray-500">
                        {fu.from_name || fu.from_email} • {fu.daysSince} napja
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        fu.urgency === 'critical' || fu.urgency === 'high'
                          ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                          : fu.urgency === 'medium'
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                      )}
                    >
                      {fu.urgency === 'critical' ? 'Kritikus' : fu.urgency === 'high' ? 'Sürgős' : fu.urgency === 'medium' ? 'Közepes' : 'Alacsony'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contact heatmap */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="dark:text-dark-text mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users className="h-4 w-4 text-indigo-500" />
            Ki írt legtöbbet ma?
          </h2>
          {contacts.length === 0 ? (
            <p className="dark:text-dark-text-muted py-6 text-center text-xs text-gray-400">
              Még nincs adat
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {contacts.slice(0, 8).map((contact, idx) => {
                const maxCount = contacts[0]?.count || 1;
                const intensity = Math.round((contact.count / maxCount) * 100);
                return (
                  <div
                    key={contact.email}
                    className="dark:border-dark-border rounded-lg border border-gray-100 p-3"
                    style={{
                      background: `linear-gradient(135deg, rgba(79, 110, 247, ${intensity / 500}) 0%, transparent 100%)`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white',
                          idx === 0 ? 'bg-[#4f6ef7]' : idx === 1 ? 'bg-indigo-400' : 'bg-gray-400',
                        )}
                      >
                        {(contact.name || contact.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="dark:text-dark-text truncate text-xs font-medium text-gray-800">
                          {contact.name || contact.email.split('@')[0]}
                        </p>
                        <p className="dark:text-dark-text-muted truncate text-[10px] text-gray-400">
                          {contact.count} email
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
