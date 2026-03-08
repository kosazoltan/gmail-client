import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Loader2,
  RefreshCw,
  Clock,
  TrendingUp,
  Users,
  PieChart,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { API_BASE } from '../../lib/api';

// --- Types ---

interface ResponseTimePoint {
  date: string;
  avgMinutes: number;
}

interface CategoryBreakdown {
  name: string;
  count: number;
  color: string;
}

interface PeriodComparison {
  label: string;
  current: number;
  previous: number;
}

interface SenderRanking {
  email: string;
  name?: string;
  count: number;
}

interface AnalyticsData {
  responseTimes: ResponseTimePoint[];
  categories: CategoryBreakdown[];
  comparison: PeriodComparison[];
  topSenders: SenderRanking[];
}

// --- Helper ---

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- SVG Charts ---

function ResponseTimeChart({ data }: { data: ResponseTimePoint[] }) {
  if (data.length === 0) return <EmptyChart label="Nincs válaszidő adat" />;

  const maxVal = Math.max(...data.map((d) => d.avgMinutes), 1);
  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (d.avgMinutes / maxVal) * chartH,
    label: d.date,
    value: d.avgMinutes,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-label="Válaszidő grafikon">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartH * (1 - ratio);
        return (
          <g key={ratio}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-400 text-[9px]">
              {Math.round(maxVal * ratio)}m
            </text>
          </g>
        );
      })}
      {/* Area */}
      <path d={areaPath} fill="url(#areaGradient)" />
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f6ef7" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#4f6ef7" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Line */}
      <path d={linePath} fill="none" stroke="#4f6ef7" strokeWidth={2} strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#4f6ef7" />
          {data.length <= 14 && (
            <text x={p.x} y={padding.top + chartH + 16} textAnchor="middle" className="fill-gray-400 text-[8px]">
              {p.label.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function CategoryPieChart({ data }: { data: CategoryBreakdown[] }) {
  if (data.length === 0) return <EmptyChart label="Nincs kategória adat" />;

  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;

  let startAngle = -Math.PI / 2;

  const slices = data.map((d) => {
    const fraction = d.count / total;
    const angle = fraction * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;

    return { ...d, path, fraction };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40 flex-shrink-0" aria-label="Kategória eloszlás">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={2} />
        ))}
        {/* Center hole for donut effect */}
        <circle cx={cx} cy={cy} r={40} fill="white" className="dark:fill-[#1a1a2e]" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-800 text-xs font-bold dark:fill-gray-200">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-400 text-[8px]">
          összesen
        </text>
      </svg>
      <div className="flex flex-wrap gap-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="dark:text-dark-text-secondary text-xs text-gray-600">
              {s.name} ({s.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonBarChart({ data }: { data: PeriodComparison[] }) {
  if (data.length === 0) return <EmptyChart label="Nincs összehasonlító adat" />;

  const maxVal = Math.max(...data.flatMap((d) => [d.current, d.previous]), 1);
  const barWidth = 20;
  const gap = 8;
  const groupWidth = barWidth * 2 + gap;
  const width = Math.max(data.length * (groupWidth + 30) + 60, 300);
  const height = 180;
  const padding = { top: 10, bottom: 30, left: 40, right: 10 };
  const chartH = height - padding.top - padding.bottom;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-label="Heti/havi összehasonlítás">
      {data.map((d, i) => {
        const x = padding.left + i * (groupWidth + 30) + 15;
        const currentH = (d.current / maxVal) * chartH;
        const previousH = (d.previous / maxVal) * chartH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={padding.top + chartH - previousH}
              width={barWidth}
              height={previousH}
              rx={3}
              fill="#94a3b8"
              fillOpacity={0.4}
            />
            <rect
              x={x + barWidth + gap}
              y={padding.top + chartH - currentH}
              width={barWidth}
              height={currentH}
              rx={3}
              fill="#4f6ef7"
            />
            <text
              x={x + groupWidth / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-gray-500 text-[9px]"
            >
              {d.label}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={width - 100} y={4} width={8} height={8} rx={2} fill="#94a3b8" fillOpacity={0.4} />
      <text x={width - 88} y={12} className="fill-gray-400 text-[8px]">Előző</text>
      <rect x={width - 55} y={4} width={8} height={8} rx={2} fill="#4f6ef7" />
      <text x={width - 43} y={12} className="fill-gray-400 text-[8px]">Jelenlegi</text>
    </svg>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="dark:text-dark-text-muted flex h-40 items-center justify-center text-xs text-gray-400">
      {label}
    </div>
  );
}

// --- Main Component ---

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<AnalyticsData>(`/smart/analytics?period=${period}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba az analytics betöltésekor');
      // Fallback empty data
      setData({
        responseTimes: [],
        categories: [],
        comparison: [],
        topSenders: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const avgResponseTime = useMemo(() => {
    if (!data?.responseTimes.length) return null;
    const avg = data.responseTimes.reduce((sum, d) => sum + d.avgMinutes, 0) / data.responseTimes.length;
    if (avg < 60) return `${Math.round(avg)} perc`;
    return `${(avg / 60).toFixed(1)} óra`;
  }, [data?.responseTimes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="dark:text-dark-text flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-7 w-7 text-[#4f6ef7]" />
            Email Analytics
          </h1>
          <p className="dark:text-dark-text-secondary mt-1 text-sm text-gray-500">
            Email használati statisztikák és trendek
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="dark:border-dark-border flex rounded-lg border border-gray-200">
            <button
              onClick={() => setPeriod('week')}
              className={cn(
                'rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors',
                period === 'week'
                  ? 'bg-[#4f6ef7] text-white'
                  : 'dark:text-dark-text-secondary text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700',
              )}
            >
              Heti
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={cn(
                'rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors',
                period === 'month'
                  ? 'bg-[#4f6ef7] text-white'
                  : 'dark:text-dark-text-secondary text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700',
              )}
            >
              Havi
            </button>
          </div>
          <button
            onClick={loadData}
            className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title="Frissítés"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Response time trend */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="dark:text-dark-text flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Clock className="h-4 w-4 text-[#4f6ef7]" />
              Válaszidő trend
            </h2>
            {avgResponseTime && (
              <span className="rounded-full bg-[#4f6ef7]/10 px-2.5 py-1 text-xs font-medium text-[#4f6ef7] dark:bg-[#4f6ef7]/20 dark:text-[#6d8cff]">
                Átlag: {avgResponseTime}
              </span>
            )}
          </div>
          <ResponseTimeChart data={data?.responseTimes || []} />
        </div>

        {/* Category breakdown */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="dark:text-dark-text mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <PieChart className="h-4 w-4 text-purple-500" />
            Kategória eloszlás
          </h2>
          <CategoryPieChart data={data?.categories || []} />
        </div>

        {/* Period comparison */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="dark:text-dark-text mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <TrendingUp className="h-4 w-4 text-green-500" />
            {period === 'week' ? 'Heti' : 'Havi'} összehasonlítás
          </h2>
          <ComparisonBarChart data={data?.comparison || []} />
        </div>

        {/* Top senders */}
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="dark:text-dark-text mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users className="h-4 w-4 text-orange-500" />
            Feladó toplist
          </h2>
          {!data?.topSenders?.length ? (
            <EmptyChart label="Nincs feladó adat" />
          ) : (
            <div className="space-y-2.5">
              {data.topSenders.slice(0, 8).map((sender, idx) => {
                const maxCount = data.topSenders[0]?.count || 1;
                const widthPct = Math.max((sender.count / maxCount) * 100, 8);
                return (
                  <div key={sender.email} className="flex items-center gap-3">
                    <span className="dark:text-dark-text-muted w-5 text-right text-xs font-bold text-gray-400">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="dark:text-dark-text truncate text-xs font-medium text-gray-700">
                          {sender.name || sender.email}
                        </span>
                        <span className="dark:text-dark-text-secondary ml-2 text-xs text-gray-500">
                          {sender.count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-1.5 rounded-full bg-[#4f6ef7]"
                          style={{ width: `${widthPct}%` }}
                        />
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
