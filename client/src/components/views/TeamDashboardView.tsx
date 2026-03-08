import { useTeamDashboard } from '../../hooks/useTeamDashboard';
import { format, formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  Users,
  Loader2,
  WifiOff,
  Mail,
  Send,
  Inbox,
  Clock,
  Tag,
  User,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TeamMember } from '../../types';

export function TeamDashboardView() {
  const { data, isLoading, error } = useTeamDashboard();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            Csapat betöltése...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <WifiOff className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h2 className="dark:text-dark-text mb-2 text-lg font-semibold text-gray-900">
            Csapat dashboard nem elérhető
          </h2>
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            Nem sikerült betölteni a csapat adatait. Próbáld újra később.
          </p>
        </div>
      </div>
    );
  }

  const { members, stats, timestamp } = data;
  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Fejléc */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-[#4f6ef7]" />
          <div>
            <h1 className="dark:text-dark-text text-2xl font-bold text-gray-900">Csapat</h1>
            <p className="dark:text-dark-text-muted text-xs text-gray-400">
              Email kommunikáció alapján — utolsó 30 nap
            </p>
          </div>
        </div>
        <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs text-gray-400">
          <Activity className="h-3.5 w-3.5" />
          {timestamp && format(new Date(timestamp), 'HH:mm:ss', { locale: hu })}
        </div>
      </div>

      {/* Statisztika sáv */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Send}
          label="Küldött"
          value={stats.sentCount}
          sub="30 nap"
          color="text-blue-500"
        />
        <StatCard
          icon={Inbox}
          label="Fogadott"
          value={stats.receivedCount}
          sub="30 nap"
          color="text-emerald-500"
        />
        <StatCard
          icon={Clock}
          label="Átl. válaszidő"
          value={stats.avgResponseTimeHours !== null ? `${stats.avgResponseTimeHours}h` : '—'}
          sub="becsült"
          color="text-amber-500"
        />
        <StatCard
          icon={Users}
          label="Aktív kontaktok"
          value={activeCount}
          sub={`/ ${members.length} összesen`}
          color="text-purple-500"
        />
      </div>

      {/* Top kategóriák */}
      {stats.topCategories.length > 0 && (
        <div>
          <h2 className="dark:text-dark-text mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="h-4 w-1 rounded-sm bg-gradient-to-b from-[#667eea] to-[#f093fb]" />
            Top kategóriák
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.topCategories.map((cat) => (
              <div
                key={cat.name}
                className="dark:bg-dark-bg-secondary dark:border-dark-border flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
              >
                <Tag className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <span className="dark:text-dark-text text-sm font-medium text-gray-700">
                  {cat.name}
                </span>
                <span className="dark:text-dark-text-muted text-xs text-gray-400">
                  ({cat.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Csapattagok */}
      <div>
        <h2 className="dark:text-dark-text mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          <span className="h-4 w-1 rounded-sm bg-gradient-to-b from-[#667eea] to-[#f093fb]" />
          Csapattagok ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <Mail className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="dark:text-dark-text-secondary text-sm text-gray-500">
              Még nincsenek email kontaktok az utolsó 30 napból.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <MemberCard key={member.email} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// === Segéd-komponensek ===

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Send;
  label: string;
  value: number | string;
  sub: string;
  color: string;
}) {
  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="dark:text-dark-text-muted text-xs font-medium uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <div className="dark:text-dark-text text-2xl font-bold text-gray-900">{value}</div>
      <div className="dark:text-dark-text-muted mt-0.5 text-xs text-gray-400">{sub}</div>
    </div>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const initial = member.name.charAt(0).toUpperCase();
  const isActive = member.status === 'active';

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-gray-600">
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-lg font-extrabold text-white shadow-lg">
            {initial}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-800',
              isActive
                ? 'bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]'
                : 'bg-gray-400',
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="dark:text-dark-text truncate text-sm font-bold text-gray-900">
            {member.name}
          </div>
          <div className="dark:text-dark-text-muted truncate text-xs text-gray-400">
            {member.email}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="dark:text-dark-text-muted flex items-center gap-1.5 text-xs text-gray-500">
            <Mail className="h-3 w-3" /> Emailek
          </span>
          <span className="dark:text-dark-text text-sm font-semibold text-gray-700">
            {member.emailCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="dark:text-dark-text-muted flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3 w-3" /> Utolsó kontakt
          </span>
          <span className="dark:text-dark-text-secondary text-xs text-gray-600">
            {formatDistanceToNow(new Date(member.lastContact), { locale: hu, addSuffix: true })}
          </span>
        </div>
        {member.topCategory && (
          <div className="flex items-center justify-between">
            <span className="dark:text-dark-text-muted flex items-center gap-1.5 text-xs text-gray-500">
              <Tag className="h-3 w-3" /> Kategória
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
              {member.topCategory}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="dark:text-dark-text-muted flex items-center gap-1.5 text-xs text-gray-500">
            <User className="h-3 w-3" /> Státusz
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              isActive
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-gray-500/10 text-gray-500',
            )}
          >
            {isActive ? 'Aktív' : 'Inaktív'}
          </span>
        </div>
      </div>
    </div>
  );
}
