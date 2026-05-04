import { useState } from 'react';
import {
  useMarketAnalysis,
  useDeepAnalysis,
  useTrendData,
  useNewsData,
  useCryptoData,
} from '../../hooks/useMarketAnalysis';
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
  Zap,
  Target,
  Shield,
  Star,
  Bitcoin,
  Rss,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  MarketRateInfo,
  MarketAnalysisItem,
  MarketPositioningItem,
  MarketNewsItem,
  MarketWeightedConclusion,
  DeepAnalysisCurrencyDetail,
  NewsArticle,
  CryptoPrices,
} from '../../types';

const RECOMMENDATION_PAIRS = [
  {
    pair: 'EURHUF',
    buyLabel: 'EUR vétel (HUF ellenében)',
    sellLabel: 'EUR eladás (HUF ellenében)',
  },
  {
    pair: 'EURUSD',
    buyLabel: 'EUR vétel (USD ellenében)',
    sellLabel: 'EUR eladás (USD ellenében)',
  },
  {
    pair: 'GBPHUF',
    buyLabel: 'GBP vétel (HUF ellenében)',
    sellLabel: 'GBP eladás (HUF ellenében)',
  },
  {
    pair: 'CHFHUF',
    buyLabel: 'CHF vétel (HUF ellenében)',
    sellLabel: 'CHF eladás (HUF ellenében)',
  },
  { pair: 'XAUUSD', buyLabel: 'Arany vétel (USD-ben)', sellLabel: 'Arany eladás (USD-ben)' },
  { pair: 'XAUEUR', buyLabel: 'Arany vétel (EUR-ban)', sellLabel: 'Arany eladás (EUR-ban)' },
];

const DEEP_CURRENCY_LABELS: Record<string, string> = {
  EUR_HUF: 'EUR/HUF',
  USD_HUF: 'USD/HUF',
  GBP_HUF: 'GBP/HUF',
  CHF_HUF: 'CHF/HUF',
};

const LEGACY_BRIEFING_FALLBACK_TEXT =
  'Ez sablon-alapú becslés, nem valódi AI elemzés. Az ANTHROPIC_API_KEY beállításával valós AI elemzés érhető el.';
const LEGACY_DEEP_ANALYSIS_FALLBACK_TEXT =
  'Sablon alapu elemzes - Az AI mely elemzes atmenetileg nem elerheto. Az alabbi adatok az elo arfolyamok alapjan keszultek.';

function getFallbackBannerText(
  reason?: 'missing_api_key' | 'timeout' | 'generation_failed' | 'provider_unavailable',
  message?: string,
): string {
  if (message) return message;
  switch (reason) {
    case 'missing_api_key':
      return 'Sablon-alapú becslés fut, mert a market AI API kulcs nincs beállítva a szerveren.';
    case 'timeout':
      return 'Sablon-alapú becslés fut, mert a market AI elemzés időtúllépés miatt fallbackre váltott.';
    default:
      return 'Sablon-alapú becslés fut, mert a market AI elemzés átmenetileg nem adott használható választ.';
  }
}

function replaceLegacyFallbackText(text: string, replacement: string): string {
  return text
    .replace(LEGACY_BRIEFING_FALLBACK_TEXT, replacement)
    .replace(LEGACY_DEEP_ANALYSIS_FALLBACK_TEXT, `Sablon-alapú elemzés - ${replacement}`)
    .replace(/\n?\n?⚠️\s*Sablon-alapú becslés fut,[^\n]*/g, '')
    .replace(/Sablon alapu elemzes/gi, 'Sablon-alapú elemzés')
    .replace(/Mely elemzes/gi, 'Mély elemzés')
    .replace(/atmenetileg/gi, 'átmenetileg')
    .replace(/elerheto/gi, 'elérhető')
    .replace(/elo arfolyamok/gi, 'élő árfolyamok')
    .replace(/Osszessegeben/gi, 'Összességében')
    .trim();
}

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === 'bullish')
    return <TrendingUp className={cn('h-5 w-5 text-green-400', className)} />;
  if (direction === 'bearish')
    return <TrendingDown className={cn('h-5 w-5 text-red-400', className)} />;
  return <Minus className={cn('h-5 w-5 text-gray-400', className)} />;
}

function DirectionBadge({ direction }: { direction: string }) {
  const label = direction === 'bullish' ? 'Bika' : direction === 'bearish' ? 'Medve' : 'Semleges';
  const color =
    direction === 'bullish'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : direction === 'bearish'
        ? 'bg-red-500/20 text-red-400 border-red-500/30'
        : 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        color,
      )}
    >
      <DirectionIcon direction={direction} className="h-3 w-3" />
      {label}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  const color =
    impact === 'Magas'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : impact === 'Közepes'
        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        : 'bg-green-500/20 text-green-400 border-green-500/30';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        color,
      )}
    >
      {impact}
    </span>
  );
}

function TrendArrow({ changePercent }: { changePercent: number }) {
  if (changePercent > 0.05)
    return <span className="font-bold text-green-400">▲ +{changePercent.toFixed(2)}%</span>;
  if (changePercent < -0.05)
    return <span className="font-bold text-red-400">▼ {changePercent.toFixed(2)}%</span>;
  return <span className="font-bold text-gray-400">→ {changePercent.toFixed(2)}%</span>;
}

function ConfidenceBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}

function RecommendationBadge({ rec }: { rec: 'buy' | 'sell' | 'hold' | string }) {
  const label = rec === 'buy' ? 'VÉTEL' : rec === 'sell' ? 'ELADÁS' : 'TARTÁS';
  const color =
    rec === 'buy'
      ? 'bg-green-500/20 text-green-400 border-green-500/40'
      : rec === 'sell'
        ? 'bg-red-500/20 text-red-400 border-red-500/40'
        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-sm font-bold',
        color,
      )}
    >
      {rec === 'buy' ? (
        <TrendingUp className="h-4 w-4" />
      ) : rec === 'sell' ? (
        <TrendingDown className="h-4 w-4" />
      ) : (
        <Minus className="h-4 w-4" />
      )}
      {label}
    </span>
  );
}

function RateCard({ rate }: { rate: MarketRateInfo }) {
  const isGold = rate.pair.startsWith('XAU');
  const isHuf = rate.pair.endsWith('HUF');
  const rateStr = isGold || isHuf ? rate.rate.toFixed(2) : rate.rate.toFixed(4);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 transition-colors hover:bg-white/8">
      <div className="mb-0.5 text-[10px] text-gray-400">{rate.label}</div>
      <div className="text-base font-bold text-white tabular-nums">{rateStr}</div>
      <div className="mt-0.5 text-xs font-medium">
        <TrendArrow changePercent={rate.changePercent} />
      </div>
    </div>
  );
}

function translateUrl(url: string, lang: string): string {
  if (lang === 'hu') return url;
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
        item.url && 'hover:border-accent/50 cursor-pointer hover:bg-white/8',
      )}
      onClick={handleClick}
      role={item.url ? 'link' : undefined}
      tabIndex={item.url ? 0 : undefined}
      onKeyDown={(e) => {
        if (item.url && (e.key === 'Enter' || e.key === ' ')) handleClick();
      }}
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
        {item.pairs.map((p) => (
          <span key={p} className="bg-accent/20 rounded px-1 py-0.5 text-[10px] text-[#6d8cff]">
            {p}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-gray-500">
          {item.source} &middot; {timeAgo}
        </span>
      </div>
    </div>
  );
}

function PositioningCard({ item }: { item: MarketPositioningItem }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white">{item.pair}</span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            item.bias === 'Long'
              ? 'bg-green-500/20 text-green-400'
              : item.bias === 'Short'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-gray-500/20 text-gray-400',
          )}
        >
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
          <span className="text-white">
            {formatRate(item.pair, item.targetLow)} - {formatRate(item.pair, item.targetHigh)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Támasz / Ellenállás:</span>
          <span className="text-white">
            {formatRate(item.pair, item.support)} / {formatRate(item.pair, item.resistance)}
          </span>
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
  const barColor =
    data.direction === 'bullish'
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
          <div
            className={cn('h-full transition-all', barColor)}
            style={{ width: data.score + '%' }}
          />
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
        item.url && 'hover:border-accent/50 cursor-pointer hover:bg-white/8',
      )}
      onClick={handleClick}
      role={item.url ? 'link' : undefined}
      tabIndex={item.url ? 0 : undefined}
      onKeyDown={(e) => {
        if (item.url && (e.key === 'Enter' || e.key === ' ')) handleClick();
      }}
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
        <span>
          Súly: <span className="text-white">{item.weight}x</span>
        </span>
        <span>
          Bizalom: <span className="text-white">{item.confidence}%</span>
        </span>
      </div>
      <p className="mb-1.5 text-[10px] leading-relaxed text-gray-300">{item.summary}</p>
      <div className="space-y-0.5 text-[10px] text-gray-400">
        <div>
          <span className="text-gray-500">Kulcsszint:</span> {item.keyLevel}
        </div>
        <div>
          <span className="text-gray-500">Kilátás:</span> {item.outlook}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {item.pairs.map((p) => (
          <span key={p} className="bg-accent/20 rounded px-1 py-0.5 text-[10px] text-[#6d8cff]">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Deep Analysis Cards ---
function DeepCurrencyCard({ pair, detail }: { pair: string; detail: DeepAnalysisCurrencyDetail }) {
  const label = DEEP_CURRENCY_LABELS[pair] ?? pair.replace('_', '/');
  const trendLabel =
    detail.trend === 'up' ? 'Emelkedő' : detail.trend === 'down' ? 'Csökkenő' : 'Oldalazó';
  const trendColor =
    detail.trend === 'up'
      ? 'text-green-400'
      : detail.trend === 'down'
        ? 'text-red-400'
        : 'text-yellow-400';
  const trendIcon = detail.trend === 'up' ? '▲' : detail.trend === 'down' ? '▼' : '→';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">{label}</h4>
        <span className={cn('text-sm font-bold', trendColor)}>
          {trendIcon} {trendLabel}
        </span>
      </div>

      {/* Support / Resistance */}
      <div className="mb-2 flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3 text-green-400" />
          <span className="text-gray-400">Támasz:</span>
          <span className="font-mono text-green-400">{detail.support.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3 text-red-400" />
          <span className="text-gray-400">Ellenállás:</span>
          <span className="font-mono text-red-400">{detail.resistance.toFixed(2)}</span>
        </div>
      </div>

      {/* Forecast */}
      <p className="mb-2 text-xs leading-relaxed text-gray-300">{detail.forecast}</p>

      {/* Recommendation + Confidence */}
      <div className="flex items-center justify-between gap-2">
        <RecommendationBadge rec={detail.recommendation} />
        <div className="flex-1">
          <div className="mb-0.5 text-[10px] text-gray-500">Konfidencia</div>
          <ConfidenceBar value={detail.confidence} max={10} />
        </div>
      </div>
    </div>
  );
}

// --- RSS News Card ---
function RssNewsCard({ article }: { article: NewsArticle }) {
  const timeAgo = getTimeAgo(article.pubDate);

  const handleClick = () => {
    if (article.link) {
      window.open(article.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/5 p-2.5 transition-all',
        article.link && 'hover:border-accent/50 cursor-pointer hover:bg-white/8',
      )}
      onClick={handleClick}
      role={article.link ? 'link' : undefined}
      tabIndex={article.link ? 0 : undefined}
      onKeyDown={(e) => {
        if (article.link && (e.key === 'Enter' || e.key === ' ')) handleClick();
      }}
    >
      <h4 className="mb-1 text-xs font-medium text-white">
        {article.title}
        {article.link && <ExternalLink className="ml-1 inline h-2.5 w-2.5 text-gray-500" />}
      </h4>
      {article.snippet && (
        <p className="mb-1.5 text-[10px] leading-relaxed text-gray-400">{article.snippet}</p>
      )}
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
        <span className="bg-accent/20 rounded px-1 py-0.5 text-[#6d8cff]">{article.source}</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}

// --- Crypto Price Card ---
function CryptoPriceCard({ prices }: { prices: CryptoPrices }) {
  const coins = [
    { key: 'bitcoin' as const, label: 'Bitcoin', symbol: 'BTC' },
    { key: 'ethereum' as const, label: 'Ethereum', symbol: 'ETH' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {coins.map(({ key, label, symbol }) => {
        const p = prices[key];
        return (
          <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Bitcoin className="h-5 w-5 text-orange-400" />
              <span className="text-sm font-bold text-white">{label}</span>
              <span className="text-xs text-gray-500">{symbol}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-gray-400">USD</div>
                <div className="text-sm font-bold text-white tabular-nums">
                  ${p.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">EUR</div>
                <div className="text-sm font-bold text-white tabular-nums">
                  €{p.eur.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">HUF</div>
                <div className="text-sm font-bold text-white tabular-nums">
                  {p.huf.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} Ft
                </div>
              </div>
            </div>
          </div>
        );
      })}
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
  const deepAnalysis = useDeepAnalysis();
  const trendQuery = useTrendData(7);
  const newsQuery = useNewsData();
  const cryptoQuery = useCryptoData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDeepAnalysis = async () => {
    setIsRefreshing(true);
    try {
      deepAnalysis.reset();
      await Promise.all([deepAnalysis.triggerAsync(true), forceRefresh()]);
    } catch {
      // Errors are surfaced by the query and mutation states.
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetryBriefing = async () => {
    setIsRefreshing(true);
    try {
      await forceRefresh();
    } catch {
      // The existing query error UI already reflects the failure.
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
          <button
            onClick={handleRetryBriefing}
            disabled={isFetching || isRefreshing}
            className="mt-3 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm text-white hover:bg-[#3d5ce5] disabled:opacity-50"
          >
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

  const deepData = deepAnalysis.data;
  const hasCurrencies = deepData && Object.keys(deepData.currencies).length > 0;
  const fallbackBannerText = getFallbackBannerText(data.fallbackReason, data.fallbackMessage);
  const deepFallbackText = getFallbackBannerText(
    deepData?.fallbackReason,
    deepData?.fallbackMessage,
  );
  const overallSentimentText = data.isAIPowered
    ? data.overallSentiment
    : replaceLegacyFallbackText(data.overallSentiment, fallbackBannerText);
  const deepSummaryText = deepData?.summary
    ? replaceLegacyFallbackText(deepData.summary, deepFallbackText)
    : '';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* AI figyelmeztetés ha nem valódi AI elemzés */}
        {!data.isAIPowered && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            ⚠️ {fallbackBannerText}
          </div>
        )}

        {/* Fejléc */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-white md:text-2xl">
              <BarChart3 className="h-6 w-6 text-[#4f6ef7]" />
              Piaci Elemzés — Reggeli Briefing
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {generatedAt}{' '}
              {data.cached && <span className="text-yellow-400">(gyorsítótárazott)</span>}
            </p>
          </div>
          <button
            onClick={handleDeepAnalysis}
            disabled={isFetching || isRefreshing || deepAnalysis.isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
          >
            {deepAnalysis.isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Mély elemzés...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Frissítés + Mély Elemzés
              </>
            )}
          </button>
        </div>

        {/* Deep analysis hiba */}
        {deepAnalysis.error && !deepAnalysis.isLoading && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertTriangle className="mr-1.5 inline h-4 w-4" />
            Mély elemzés sikertelen — próbáld újra később.
          </div>
        )}

        {/* AI Összefoglaló (deep analysis) */}
        {deepData?.summary && (
          <section className="rounded-xl border border-[#4f6ef7]/40 bg-[#4f6ef7]/15 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
              <Zap className="h-5 w-5 text-[#4f6ef7]" />
              AI Összefoglaló
              {deepData.cached && (
                <span className="text-xs text-yellow-400">(gyorsítótárazott)</span>
              )}
            </h2>
            <p className="leading-relaxed text-gray-200">{deepSummaryText}</p>
            {deepData.generatedAt && (
              <p className="mt-2 text-[10px] text-gray-500">
                Generálva: {new Date(deepData.generatedAt).toLocaleString('hu-HU')}
              </p>
            )}
          </section>
        )}

        {/* Élő árfolyamok */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Élő árfolyamok
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.rates.map((r) => (
              <RateCard key={r.pair} rate={r} />
            ))}
          </div>
        </section>

        {/* Crypto árfolyamok */}
        {cryptoQuery.data && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <Bitcoin className="h-5 w-5 text-orange-400" />
              Crypto árfolyamok
            </h2>
            <CryptoPriceCard prices={cryptoQuery.data} />
          </section>
        )}

        {/* Hírek (RSS) */}
        {newsQuery.data && newsQuery.data.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <Rss className="h-5 w-5 text-orange-500" />
              Hírek
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {newsQuery.data.slice(0, 5).map((article, i) => (
                <RssNewsCard key={`${article.source}-${i}`} article={article} />
              ))}
            </div>
          </section>
        )}

        {/* Deep Analysis — Deviza részletes elemzés + Support/Resistance + Ajánlás */}
        {hasCurrencies && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <Target className="h-5 w-5 text-amber-400" />
              Részletes Deviza Elemzés
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(deepData.currencies).map(([pair, detail]) => (
                <DeepCurrencyCard key={pair} pair={pair} detail={detail} />
              ))}
            </div>
          </section>
        )}

        {/* Deep Analysis — Arany */}
        {deepData?.gold && deepData.gold.trend !== 'N/A' && (
          <section className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
              <Star className="h-5 w-5 text-yellow-400" />
              Arany (XAU) Elemzés
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] text-gray-400">Trend</div>
                <div className="text-sm font-bold text-yellow-400">{deepData.gold.trend}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Előrejelzés</div>
                <div className="text-xs text-gray-300">{deepData.gold.forecast}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Ajánlás</div>
                <div className="text-sm font-bold text-yellow-300">
                  {deepData.gold.recommendation}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Deep Analysis — Átfogó Ajánlás */}
        {deepData?.overallRecommendation && (
          <section className="rounded-xl border border-[#4f6ef7]/40 bg-gradient-to-r from-[#4f6ef7]/10 to-purple-500/10 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
              <Scale className="h-5 w-5 text-[#4f6ef7]" />
              Átfogó Ajánlás
            </h2>
            <p className="text-sm leading-relaxed text-gray-200">
              {deepData.overallRecommendation}
            </p>
          </section>
        )}

        {/* Deep Analysis — Kockázatok */}
        {deepData?.risks &&
          deepData.risks.length > 0 &&
          deepData.risks[0] !== 'AI elemzés nem konfigurált vagy átmenetileg nem elérhető' && (
            <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-white">
                <Shield className="h-5 w-5 text-red-400" />
                Kockázatok
              </h2>
              <ul className="space-y-1.5">
                {deepData.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                    {risk}
                  </li>
                ))}
              </ul>
            </section>
          )}

        {/* 7 napos trend mini chart (text-based) */}
        {trendQuery.data && trendQuery.data.length > 1 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <BarChart3 className="h-5 w-5 text-cyan-400" />7 napos trend
            </h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(DEEP_CURRENCY_LABELS).map(([key, label]) => {
                const values = trendQuery.data
                  .map((d) => d.rates[key])
                  .filter((v): v is number => v != null);
                if (values.length < 2) return null;
                const first = values[0];
                const last = values[values.length - 1];
                const changePct = ((last - first) / first) * 100;
                const min = Math.min(...values);
                const max = Math.max(...values);
                return (
                  <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{label}</span>
                      <TrendArrow changePercent={changePct} />
                    </div>
                    <div className="mb-1 text-xs text-gray-400">
                      {first.toFixed(2)} → {last.toFixed(2)}
                    </div>
                    {/* Mini sparkline-like bar */}
                    <div className="flex h-8 items-end gap-px">
                      {values.map((v, i) => {
                        const range = max - min || 1;
                        const heightPct = Math.max(10, ((v - min) / range) * 100);
                        const barColor = v >= first ? 'bg-green-500/60' : 'bg-red-500/60';
                        return (
                          <div
                            key={i}
                            className={cn('flex-1 rounded-t', barColor)}
                            style={{ height: `${heightPct}%` }}
                            title={`${trendQuery.data[i]?.date}: ${v.toFixed(2)}`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-gray-500">
                      <span>Min: {min.toFixed(2)}</span>
                      <span>Max: {max.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Javaslatok (meglévő briefing alapú) */}
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
              return (
                <div
                  key={pair}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-2',
                    isBuy
                      ? 'border-green-500/30 bg-green-500/10'
                      : isSell
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-white/10 bg-white/5',
                  )}
                >
                  <div className="flex-1">
                    <div className="mb-0.5 text-[10px] text-gray-400">
                      {pair.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')}
                    </div>
                    <div
                      className={cn(
                        'text-xs font-bold',
                        isBuy ? 'text-green-400' : isSell ? 'text-red-400' : 'text-gray-400',
                      )}
                    >
                      {isBuy ? buyLabel : isSell ? sellLabel : 'Kivárás javasolt'}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      Megbízhatóság: {wc.score}%
                    </div>
                  </div>
                  {isBuy ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : isSell ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <Minus className="h-4 w-4 text-gray-500" />
                  )}
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
          <p className="leading-relaxed text-gray-300">{overallSentimentText}</p>
        </section>

        {/* Friss hírek */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Newspaper className="h-5 w-5 text-yellow-400" />
            Friss hírek
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.newsItems.map((item, i) => (
              <NewsCard key={i} item={item} />
            ))}
          </div>
        </section>

        {/* Piaci pozícionálás */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Piaci pozícionálás
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.positioning.map((item) => (
              <PositioningCard key={item.pair} item={item} />
            ))}
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
            Intézményi elemzők ({data.analyses.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.analyses.map((item) => (
              <AnalystCard key={item.sourceId} item={item} />
            ))}
          </div>
        </section>

        {/* Jogi nyilatkozat */}
        <footer className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Ez az elemzés kizárólag tájékoztatási célokat szolgál, és NEM minősül befektetési
              tanácsnak. A deviza- és aranykereskedelem jelentős kockázattal jár. Az EBC (Exclusive
              Best Change) nem vállal felelősséget az itt közölt információk alapján hozott
              döntésekért. A tényleges tranzakciós árfolyamok eltérhetnek a fent megjelenített piaci
              árfolyamoktól. Mindig kérjen szakértői véleményt pénzügyi döntései előtt.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
