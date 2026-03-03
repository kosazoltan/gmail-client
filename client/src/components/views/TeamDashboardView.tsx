import { useTeamDashboard } from '../../hooks/useTeamDashboard';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  Bot,
  Loader2,
  WifiOff,
  Activity,
  BookOpen,
  Footprints,
  Target,
  Lightbulb,
  Dna,
  Package,
  Moon,
  Puzzle,
  Cog,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TeamAgent, TeamDashboardData } from '../../types';

const PHASE_CONFIG: Record<string, { label: string; emoji: string; colors: string; dot: string }> = {
  TIDAL_HIGH: {
    label: 'DAGÁLY',
    emoji: '\u{1F30A}',
    colors: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    dot: 'bg-blue-400',
  },
  TIDAL_LOW: {
    label: 'APÁLY',
    emoji: '\u{1F305}',
    colors: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    dot: 'bg-amber-400',
  },
  DREAM: {
    label: 'ÁLOM',
    emoji: '\u{1F319}',
    colors: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    dot: 'bg-purple-400',
  },
};

const AVATAR_GRADIENTS: Record<string, string> = {
  junior: 'from-indigo-500 to-purple-500',
  coder: 'from-blue-500 to-purple-600',
  analyst: 'from-emerald-500 to-teal-500',
  nora: 'from-pink-500 to-rose-500',
  security: 'from-orange-500 to-amber-500',
};

const STAT_ICONS: Array<{ key: keyof TeamDashboardData['stats']; label: string; icon: typeof BookOpen }> = [
  { key: 'facts', label: 'Facts', icon: BookOpen },
  { key: 'trails', label: 'Trails', icon: Footprints },
  { key: 'delegations', label: 'Delegations', icon: Target },
  { key: 'discoveries', label: 'Discoveries', icon: Lightbulb },
  { key: 'pheromones', label: 'Pheromones', icon: Dna },
  { key: 'ledgerEntries', label: 'Ledger', icon: Package },
  { key: 'dreams', label: 'Dreams', icon: Moon },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'scaffolds', label: 'Scaffolds', icon: Puzzle },
  { key: 'modules', label: 'Modules', icon: Cog },
];

export function TeamDashboardView() {
  const { data, isLoading, error } = useTeamDashboard();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
          <p className="dark:text-dark-text-secondary text-sm text-gray-500">
            AI Csapat betöltése...
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
            AI Team Dashboard nem elérhető
          </h2>
          <p className="dark:text-dark-text-secondary mb-4 text-sm text-gray-500">
            Az API szerver (localhost:3460) nem fut, vagy a backend szerver nem tudja elérni.
          </p>
          <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-3 text-left">
            <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">Indítás:</p>
            <code className="text-xs text-gray-700 dark:text-gray-300">
              cd D:\openclaw\shared && node dashboard-api.mjs serve
            </code>
          </div>
        </div>
      </div>
    );
  }

  const phase = PHASE_CONFIG[data.phase] || {
    label: data.phase,
    emoji: '\u{2753}',
    colors: 'bg-gray-500/15 border-gray-500/30 text-gray-400',
    dot: 'bg-gray-400',
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Fejléc */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-7 w-7 text-[#4f6ef7]" />
          <div>
            <h1 className="dark:text-dark-text text-2xl font-bold text-gray-900">AI Csapat</h1>
            <p className="dark:text-dark-text-muted text-xs text-gray-400">
              Collaborative Intelligence System
            </p>
          </div>
        </div>
        <div className="dark:text-dark-text-muted flex items-center gap-2 text-xs text-gray-400">
          <Activity className="h-3.5 w-3.5" />
          Auto-refresh 10s
          {data.timestamp && (
            <span>
              — {format(new Date(data.timestamp), 'HH:mm:ss', { locale: hu })}
            </span>
          )}
        </div>
      </div>

      {/* Fázis sáv */}
      <div
        className={cn(
          'flex items-center justify-center gap-3 rounded-xl border px-5 py-3 text-lg font-bold',
          phase.colors,
        )}
      >
        <div className={cn('h-2.5 w-2.5 animate-pulse rounded-full', phase.dot)} />
        <span>
          {phase.emoji} {phase.label}
        </span>
        {data.phaseReason && (
          <span className="text-sm font-normal opacity-70"> — {data.phaseReason}</span>
        )}
      </div>

      {/* Statisztika grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STAT_ICONS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm"
          >
            <Icon className="mx-auto mb-1 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <div className="bg-gradient-to-r from-[#667eea] to-[#f093fb] bg-clip-text text-2xl font-extrabold text-transparent">
              {data.stats[key]}
            </div>
            <div className="dark:text-dark-text-muted mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Team Members */}
      <div>
        <h2 className="dark:text-dark-text mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          <span className="h-4 w-1 rounded-sm bg-gradient-to-b from-[#667eea] to-[#f093fb]" />
          Csapattagok
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Meta kártyák (Intentions, Dreams, Stigmergy, Quorum) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Intentions */}
        <MetaCard title="\u{1F3AF} Célok">
          <MetaRow label="Aktív" value={String(data.intentions.activeGoals)} className="text-amber-400" />
          <MetaRow
            label="Elért"
            value={`${data.intentions.achievedGoals} \u{1F3C6}`}
            className="text-emerald-400 font-semibold"
          />
          {data.intentions.topGoal && (
            <MetaRow
              label={data.intentions.topGoal.description.substring(0, 30)}
              value={`${data.intentions.topGoal.severity}/10`}
              className="text-orange-400"
            />
          )}
        </MetaCard>

        {/* Dreams */}
        <MetaCard title="\u{1F319} Álmok">
          <MetaRow label="Ciklusok" value={String(data.dreams.totalCycles)} />
          <MetaRow label="Asszociációk" value={String(data.dreams.totalAssociations)} />
        </MetaCard>

        {/* Stigmergy */}
        <MetaCard title="\u{1F41C} Stigmergia">
          <MetaRow label="Helyszínek" value={String(data.stigmergy.locations)} />
          <MetaRow label="Feromonok" value={String(data.stigmergy.totalPheromones)} />
        </MetaCard>

        {/* Quorum */}
        <MetaCard title="\u{1F4E1} Quorum">
          <MetaRow label="Mód" value={data.quorum.mode} />
          <MetaRow label="Jelzések" value={String(data.quorum.activeSignals)} />
        </MetaCard>
      </div>

      {/* System Components */}
      <div>
        <h2 className="dark:text-dark-text mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          <span className="h-4 w-1 rounded-sm bg-gradient-to-b from-[#667eea] to-[#f093fb]" />
          Rendszer komponensek ({data.modules.filter((m) => m.exists).length}/{data.modules.length})
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.modules.map((mod) => (
            <div
              key={mod.name}
              className="dark:bg-dark-bg-secondary dark:border-dark-border flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
            >
              <div>
                <div className="dark:text-dark-text text-xs font-semibold capitalize text-gray-800">
                  {mod.name}
                </div>
                <div className="dark:text-dark-text-muted text-[10px] text-gray-400">
                  {mod.sizeKB} KB
                </div>
              </div>
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  mod.exists
                    ? 'bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]'
                    : 'bg-red-500 shadow-[0_0_6px_theme(colors.red.500)]',
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div>
          <h2 className="dark:text-dark-text mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="h-4 w-1 rounded-sm bg-gradient-to-b from-[#667eea] to-[#f093fb]" />
            Legutóbbi aktivitás
          </h2>
          <div className="space-y-2">
            {data.recentActivity.slice(0, 10).map((act, i) => (
              <div
                key={`${act.time}-${i}`}
                className={cn(
                  'dark:bg-dark-bg-secondary dark:border-dark-border flex items-center gap-3 rounded-lg border-l-[3px] bg-white px-4 py-2.5 text-sm shadow-sm',
                  act.result === 'success' && 'border-l-emerald-500',
                  (act.result === 'failed' || act.result === 'failure') && 'border-l-red-500',
                  act.result === 'pending' && 'border-l-amber-500',
                  act.result === 'partial' && 'border-l-orange-500',
                )}
              >
                <span className="dark:text-dark-text-muted w-12 flex-shrink-0 text-xs text-gray-400">
                  {timeAgo(act.time)}
                </span>
                <span className="dark:text-dark-text flex-shrink-0 text-xs font-semibold text-gray-700">
                  {act.from} → {act.to}
                </span>
                <span className="dark:text-dark-text-secondary min-w-0 truncate text-xs text-gray-500">
                  {act.task}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// === Segéd-komponensek ===

function AgentCard({ agent }: { agent: TeamAgent }) {
  const gradient = AVATAR_GRADIENTS[agent.id] || 'from-gray-500 to-gray-600';
  const initial = agent.name.charAt(0);
  const successClass = getSuccessClass(agent.successRate, agent.role);
  const rate7d = agent.rate7d !== null && agent.rate7d !== undefined ? `${agent.rate7d}%` : '—';

  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-gray-600">
      {/* Fej */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-extrabold text-white shadow-lg',
            gradient,
          )}
        >
          {initial}
        </div>
        <div>
          <div className="dark:text-dark-text text-sm font-bold text-gray-900">
            {agent.name} {agent.emoji}
          </div>
          <div className="dark:text-dark-text-muted text-xs text-gray-400">
            {agent.role} · {agent.model}
          </div>
        </div>
      </div>

      {/* Metrikák */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-2 text-center">
          <div className="dark:text-dark-text-muted text-[10px] uppercase tracking-wider text-gray-400">
            Tasks
          </div>
          <div className="dark:text-dark-text text-lg font-bold text-gray-900">{agent.tasks}</div>
          <div className="dark:text-dark-text-muted text-[10px] text-gray-400">
            {agent.tasks7d || 0} e héten
          </div>
        </div>
        <div className="dark:bg-dark-bg-tertiary rounded-lg bg-gray-50 p-2 text-center">
          <div className="dark:text-dark-text-muted text-[10px] uppercase tracking-wider text-gray-400">
            Success
          </div>
          <div className={cn('text-lg font-bold', successClass)}>{agent.successRate}%</div>
          <div className="text-[10px]">{trendArrow(agent.trend)}</div>
        </div>
      </div>

      {/* 7D / ALL */}
      <div className="mb-2 flex justify-center gap-2">
        <span className="dark:bg-dark-bg-tertiary rounded bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
          7d: <b>{rate7d}</b>
        </span>
        <span className="dark:text-dark-text rounded bg-gray-200/60 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-gray-700 dark:bg-gray-600/30">
          all: <b>{agent.successRate}%</b>
        </span>
      </div>

      {/* Sparkline */}
      {agent.sparkline && agent.sparkline.length > 0 && (
        <Sparkline data={agent.sparkline} />
      )}
    </div>
  );
}

function Sparkline({ data }: { data: (number | null)[] }) {
  return (
    <div className="flex items-end gap-[2px] px-1" style={{ height: 20 }}>
      {data.map((v, i) => {
        if (v === null) {
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gray-200/20 dark:bg-gray-700/30"
              style={{ height: 3, minWidth: 4 }}
            />
          );
        }
        const h = Math.max(3, Math.round((v / 100) * 20));
        return (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-t-sm',
              v >= 50
                ? 'bg-gradient-to-t from-[#667eea88] to-[#667eea]'
                : 'bg-gradient-to-t from-[#ef444488] to-[#ef4444]',
            )}
            style={{ height: h, minWidth: 4 }}
            title={`${v}%`}
          />
        );
      })}
    </div>
  );
}

function MetaCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="dark:text-dark-text-secondary mb-2 text-sm font-semibold text-gray-600">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-100 py-1 text-xs last:border-0">
      <span className="dark:text-dark-text-muted text-gray-500">{label}</span>
      <span className={cn('dark:text-dark-text text-gray-700', className)}>{value}</span>
    </div>
  );
}

// === Segédfüggvények ===

function getSuccessClass(rate: number, role: string): string {
  const thresholds: Record<string, { g: number; y: number }> = {
    'Kóder': { g: 80, y: 60 },
    'QA': { g: 85, y: 70 },
    'Koordinátor': { g: 90, y: 75 },
    'Grafikus': { g: 75, y: 50 },
    'Kommunikáció': { g: 80, y: 60 },
  };
  const t = thresholds[role] || { g: 80, y: 60 };
  if (rate >= t.g) return 'text-emerald-500';
  if (rate >= t.y) return 'text-amber-500';
  return 'text-red-500';
}

function trendArrow(t: number | null): React.ReactNode {
  if (t === null || t === undefined) {
    return <span className="text-gray-400">—</span>;
  }
  if (t > 0) return <span className="text-emerald-500">↗ +{t}%</span>;
  if (t < 0) return <span className="text-red-500">↘ {t}%</span>;
  return <span className="text-amber-500">→ 0%</span>;
}

function timeAgo(t: string): string {
  if (!t) return '';
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 60000) return 'most';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p`;
  return `${Math.floor(diff / 3600000)}h`;
}
