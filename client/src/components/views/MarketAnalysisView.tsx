import { useState } from 'react';
import { useMarketAnalysis } from '../../hooks/useMarketAnalysis';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Newspaper,
  BarChart3,
  Scale,
  Building2,
  ShieldAlert,
  ExternalLink,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  MarketRateInfo,
  MarketAnalysisItem,
  MarketPositioningItem,
  MarketNewsItem,
  MarketWeightedConclusion,
} from '../../types';

const RECOMMENDATION_PAIRS = [
  { pair: 'EURHUF', buyLabel: 'EUR vétel (HUF ellenében)', sellLabel: 'EUR eladás (HUF ellenében)' },
  { pair: 'EURUSD', buyLabel: 'EUR vétel (USD ellenében)', sellLabel: 'EUR eladás (USD ellenében)' },
  { pair: 'GBPHUF', buyLabel: 'GBP vétel (HUF ellenében)', sellLabel: 'GBP eladás (HUF ellenében)' },
  { pair: 'CHFHUF', buyLabel: 'CHF vétel (HUF ellenében)', sellLabel: 'CHF eladás (HUF ellenében)' },
  { pair: 'XAUUSD', buyLabel: 'Arany vétel (USD-ben)', sellLabel: 'Arany eladás (USD-ben)' },
  { pair: 'XAUEUR', buyLabel: 'Arany vétel (EUR-ban)', sellLabel: 'Arany eladás (EUR-ban)' },
];

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === 'bullish') return <TrendingUp className={cn('h-5 w-5 text-green-400', className)} />;
  if (direction === 'bearish') return <TrendingDown className={cn('h-5 w-5 text-red-400', className)} />;
  return <Minus className={cn('h-5 w-5 text-gray-400', className)} />;
}

function DirectionBadge({ direction }: { direction: string }) {
  const label = direction === 'bullish' ? 'Bika' : direction === 'bearish' ? 'Medve' : 'Semleges';
  const color = direction === 'bullish'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : direction === 'bearish'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', color)}>
      <DirectionIcon direction={direction} className="h-3 w-3" />
      {label}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  const color = impact === 'Magas'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : impact === 'Közepes'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-green-500/20 text-green-400 border-green-500/30';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', color)}>
      {impact}
    </span>
  );
}

function RateCard({ rate }: { rate: MarketRateInfo }) {
  const isPositive = rate.changePercent >= 0;
  const isGold = rate.pair.startsWith('XAU');
  const isHuf = rate.pair.endsWith('HUF');
  const rateStr = (isGold || isHuf) ? rate.rate.toFixed(2) : rate.rate.toFixed(4);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 transition-colors hover:bg-white/8">
      <div className="mb-0.5 text-[10px] text-gray-400">{rate.label}</div>
      <div className="text-base font-bold text-white tabular-nums">{rateStr}</div>
      <div className={cn('mt-0.5 flex items-center gap-1 text-xs font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>{isPositive ? '+' : ''}{rate.changePercent.toFixed(2)}%</span>
      </div>
    </div>
  );
}

function translateUrl(url: string, lang: string): string {
  if (lang === 'hu') return url;
  // BUG7 FIX: sl=auto is more robust than sl=${lang} (Google auto-detect is reliable)
  return `https://translate.google.com/translate?sl=auto&tl=hu&u=${encodeURIComponent(url)}`;
}

function NewsCard({ item }: { item: MarketNewsItem }) {
  const timeAgo = getTimeAgo(item.publishedAt);

  const handleClick = () => {
    if (item.url) {
      const url = translateUrl(item.url, item.originalLanguage ?? 'en');
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 p-2.5 transition-all',
        item.url && 'cursor-pointer hover:border-accent/50 hover:bg-white/8'
      )}
      onClick={handleClick}
      role={item.url ? 'link' : undefined}
      tabIndex={item.url ? 0 : undefined}
      onKeyDown={(e) => { if (item.url && (e.key === 'Enter' || e.key === ' ')) handleClick(); }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h4 className="text-xs font-medium text-white">
          {item.title}
          {item.url && <ExternalLink className="ml-1 inline h-2.5 w-2.5 text-gray-500" />}
        </h4>
        <ImpactBadge impact={item.impact} />
      </div>
      <p className="mb-2 text-[10px] leading-relaxed text-gray-400">{item.summary}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {item.pairs.map(p => (
          <span key={p} className="rounded bg-accent/20 px-1 py-0.5 text-[10px] text-[#6d8cff]">{p}</span>
        ))}
        <span className="ml-auto text-[10px] text-gray-500">{item.source} &middot; {timeAgo}</span>
      </div>
    </div>
  );
}

function PositioningCard({ item }: { item: MarketPositioningItem }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white">{item.pair}</span>
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
          item.bias === 'Long' ? 'bg-green-500/20 text-green-400' :
          item.bias === 'Short' ? 'bg-red-500/20 text-red-400' :
          'bg-gray-500/20 text-gray-400'
        )}>
          {item.bias}
        </span>
      </div>

      {/* Long/Short bar */}
      <div className="mb-2">
        <div className="mb-0.5 flex justify-between text-[10px] text-gray-400">
          <span>Long {item.longPct}%</span>
          <span>Short {item.shortPct}%</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="bg-green-500 transition-all" style={{ width: item.longPct + '%' }} />
          <div className="bg-red-500 transition-all" style={{ width: item.shortPct + '%' }} />
        </div>
      </div>

      <div className="space-y-1 text-[10px] text-gray-400">
        <div className="flex justify-between">
          <span>Célsáv:</span>
          <span className="text-white">{formatRate(item.pair, item.targetLow)} - {formatRate(item.pair, item.targetHigh)}</span>
        </div>
        <div className="flex justify-between">
          <span>Támasz / Ellenállás:</span>
          <span className="text-white">{formatRate(item.pair, item.support)} / {formatRate(item.pair, item.resistance)}</span>
        </div>
        <div>
          <span className="text-yellow-400">48h katalizátor:</span>
          <span className="ml-1 text-gray-300">{item.catalyst48h}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-green-500/10 p-1.5">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-green-400">
              <TrendingUp className="h-2.5 w-2.5" /> Bika
            </div>
            <p className="text-[10px] leading-relaxed text-gray-300">{item.scenarioBull}</p>
          </div>
          <div className="rounded-lg bg-red-500/10 p-1.5">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-red-400">
              <TrendingDown className="h-2.5 w-2.5" /> Medve
            </div>
            <p className="text-[10px] leading-relaxed text-gray-300">{item.scenarioBear}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConclusionCard({ pair, data }: { pair: string; data: MarketWeightedConclusion }) {
  const barColor = data.direction === 'bullish'
    ? 'bg-green-500'
    : data.direction === 'bearish'
      ? 'bg-red-500'
      : 'bg-gray-500';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-white">{pair}</span>
        <DirectionBadge direction={data.direction} />
      </div>
      <div className="mb-1.5">
        <div className="mb-0.5 flex justify-between text-[10px] text-gray-400">
          <span>Medve</span>
          <span className="font-medium text-white">{data.score}%</span>
          <span>Bika</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className={cn('h-full transition-all', barColor)} style={{ width: data.score + '%' }} />
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-gray-400">{data.summary}</p>
    </div>
  );
}

function AnalystCard({ item }: { item: MarketAnalysisItem }) {
  const handleClick = () => {
    if (item.url) {
      const url = translateUrl(item.url, item.originalLanguage ?? 'en');
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 p-2.5 transition-all',
        item.url && 'cursor-pointer hover:border-accent/50 hover:bg-white/8'
      )}
      onClick={handleClick}
      role={item.url ? 'link' : undefined}
      tabIndex={item.url ? 0 : undefined}
      onKeyDown={(e) => { if (item.url && (e.key === 'Enter' || e.key === ' ')) handleClick(); }}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">
            {item.source}
            {item.url && <ExternalLink className="ml-1 inline h-2.5 w-2.5 text-gray-500" />}
          </h4>
          <p className="text-[10px] text-gray-500">{item.speciality}</p>
        </div>
        <DirectionBadge direction={item.direction} />
      </div>
      <div className="mb-2 flex items-center gap-2 text-[10px] text-gray-400">
        <span>Súly: <span className="text-white">{item.weight}x</span></span>
        <span>Bizalom: <span className="text-white">{item.confidence}%</span></span>
      </div>
      <p className="mb-1.5 text-[10px] leading-relaxed text-gray-300">{item.summary}</p>
      <div className="space-y-0.5 text-[10px] text-gray-400">
        <div><span className="text-gray-500">Kulcsszint:</span> {item.keyLevel}</div>
        <div><span className="text-gray-500">Kilátás:</span> {item.outlook}</div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {item.pairs.map(p => (
          <span key={p} className="rounded bg-accent/20 px-1 py-0.5 text-[10px] text-[#6d8cff]">{p}</span>
        ))}
      </div>
    </div>
  );
}

function getTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'most';
  if (hours < 24) return hours + ' órája';
  return Math.floor(hours / 24) + ' napja';
}

function formatRate(pair: string, value: number): string {
  if (pair.startsWith('XAU')) return value.toFixed(2);
  if (pair.endsWith('HUF')) return value.toFixed(2);
  return value.toFixed(4);
}

export function MarketAnalysisView() {
  const { data, isLoading, error, isFetching, forceRefresh } = useMarketAnalysis();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await forceRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-[#4f6ef7]" />
          <p className="text-gray-400">Piaci elemzés betöltése...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <p className="text-gray-400">Nem sikerült betölteni a piaci elemzést.</p>
          <button onClick={handleRefresh} className="mt-3 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm text-white hover:bg-[#3d5ce5]">
            Újrapróba
          </button>
        </div>
      </div>
    );
  }

  const generatedAt = new Date(data.generatedAt).toLocaleString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* Fejléc */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-white md:text-2xl">
              <BarChart3 className="h-6 w-6 text-[#4f6ef7]" />
              Piaci Elemzés — Reggeli Briefing
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {generatedAt} {data.cached && <span className="text-yellow-400">(gyorsítótárazott)</span>}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isFetching || isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', (isFetching || isRefreshing) && 'animate-spin')} />
            Frissítés
          </button>
        </div>

        {/* Élő árfolyamok */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Élő árfolyamok
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.rates.map(r => <RateCard key={r.pair} rate={r} />)}
          </div>
        </section>

        {/* Javaslatok */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <ArrowRightLeft className="h-5 w-5 text-[#4f6ef7]" />
            Javaslatok az elemzések alapján
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RECOMMENDATION_PAIRS.map(({ pair, buyLabel, sellLabel }) => {
              const wc = data.weightedConclusion[pair];
              if (!wc) return null;
              const isBuy = wc.direction === 'bullish';
              const isSell = wc.direction === 'bearish';
              const isNeutral = !isBuy && !isSell;
              return (
                <div key={pair} className={cn(
                  'flex items-center gap-2 rounded-xl border p-2',
                  isBuy ? 'border-green-500/30 bg-green-500/10' :
                  isSell ? 'border-red-500/30 bg-red-500/10' :
                  'border-white/10 bg-white/5'
                )}>
                  <div className="flex-1">
                    <div className="mb-0.5 text-[10px] text-gray-400">{pair.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')}</div>
                    <div className={cn(
                      'text-xs font-bold',
                      isBuy ? 'text-green-400' : isSell ? 'text-red-400' : 'text-gray-400'
                    )}>
                      {isBuy ? buyLabel : isSell ? sellLabel : 'Kivárás javasolt'}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">Megbízhatóság: {wc.score}%</div>
                  </div>
                  {isBuy ? <TrendingUp className="h-4 w-4 text-green-400" /> :
                   isSell ? <TrendingDown className="h-4 w-4 text-red-400" /> :
                   <Minus className="h-4 w-4 text-gray-500" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Általános piaci hangulat */}
        <section className="rounded-xl border border-[#4f6ef7]/30 bg-[#4f6ef7]/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
            <Scale className="h-5 w-5 text-[#4f6ef7]" />
            Általános piaci hangulat
          </h2>
          <p className="leading-relaxed text-gray-300">{data.overallSentiment}</p>
        </section>

        {/* Friss hírek */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Newspaper className="h-5 w-5 text-yellow-400" />
            Friss hírek
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.newsItems.map((item, i) => <NewsCard key={i} item={item} />)}
          </div>
        </section>

        {/* Piaci pozícionálás */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Piaci pozícionálás
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.positioning.map(item => <PositioningCard key={item.pair} item={item} />)}
          </div>
        </section>

        {/* Súlyozott összesítő */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Scale className="h-5 w-5 text-blue-400" />
            Súlyozott összesítő
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.weightedConclusion).map(([pair, wc]) => (
              <ConclusionCard key={pair} pair={pair} data={wc} />
            ))}
          </div>
        </section>

        {/* Intézményi elemzők */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Building2 className="h-5 w-5 text-amber-400" />
            Intézményi elemzők (8)
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.analyses.map(item => <AnalystCard key={item.sourceId} item={item} />)}
          </div>
        </section>

        {/* Jogi nyilatkozat */}
        <footer className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Ez az elemzés kizárólag tájékoztatási célokat szolgál, és NEM minősül befektetési tanácsnak.
              A deviza- és aranykereskedelem jelentős kockázattal jár. Az EBC (Exclusive Best Change) nem
              vállal felelősséget az itt közölt információk alapján hozott döntésekért. A tényleges
              tranzakciós árfolyamok eltérhetnek a fent megjelenített piaci árfolyamoktól. Mindig
              kérjen szakértői véleményt pénzügyi döntései előtt.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

