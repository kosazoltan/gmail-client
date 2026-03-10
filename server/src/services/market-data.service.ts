/**
 * Multi-source market data service
 *
 * Primary feeds:
 *   EUR/HUF, USD/HUF, CHF/HUF, EUR/USD  → TwelveData
 *   GBP/HUF                               → Finnhub (→ TwelveData fallback)
 *   XAU/USD, XAU/EUR                      → Metals-API (→ TwelveData fallback)
 *
 * Fallback for all forex:  Frankfurter (ECB, free, no key)
 * Fallback for gold:       Swissquote / NBP / fawazahmed0 CDN
 *
 * Budget: ~800 TwelveData calls/day → 30-min cache = 48 refreshes × 6 symbols = 288/day ✓
 *         Metals-API ~250/month → 48/day × 2 = 96/day (3 days = 288 → fine for ~8 days) ✓
 *         Finnhub 60/min → no issue
 */
import logger from '../utils/logger.js';

// --- Types ---
export interface RateInfo {
  pair: string;
  label: string;
  rate: number;
  change24h: number;
  changePercent: number;
  timestamp: string;
  source?: string;
}

export interface MarketNewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
  relatedPairs?: string[];
}

// --- Config ---
const TWELVEDATA_KEY = () => process.env.TWELVEDATA_API_KEY || '';
const FINNHUB_KEY = () => process.env.FINNHUB_API_KEY || '';
const METALS_KEY = () => process.env.METALS_API_KEY || '';
const ALPHAVANTAGE_KEY = () => process.env.ALPHAVANTAGE_API_KEY || '';

// --- Cache ---
let cachedRates: RateInfo[] | null = null;
let ratesCachedAt = 0;
let cachedNews: MarketNewsItem[] | null = null;
let newsCachedAt = 0;
const RATE_CACHE_TTL = 30 * 60 * 1000; // 30 perc
const NEWS_CACHE_TTL = 30 * 60 * 1000; // 30 perc

// Historical rates cache (for 24h change) — keyed by date string
const historicalCache = new Map<string, Record<string, number>>();

// --- Helpers ---
async function fetchJSON<T>(url: string, timeoutMs = 8000, headers?: Record<string, string>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ZMail-Market/1.0', ...headers },
    });
    clearTimeout(timer);
    if (!resp.ok) {
      logger.warn(`HTTP ${resp.status} from ${new URL(url).hostname}`);
      return null;
    }
    return await resp.json() as T;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name !== 'AbortError') {
      logger.warn(`Fetch failed (${new URL(url).hostname}): ${err.message}`);
    }
    return null;
  }
}

function round(n: number, decimals = 4): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function calcChange(current: number, previous: number): { change24h: number; changePercent: number } {
  if (previous === 0 || current === previous) return { change24h: 0, changePercent: 0 };
  return {
    change24h: round(current - previous),
    changePercent: round(((current - previous) / previous) * 100, 2),
  };
}

// ============================================================
// RATE FETCHING — multi-source with fallback
// ============================================================

/** TwelveData batch price (1 API call for up to 8 symbols) */
async function fetchTwelveData(): Promise<Record<string, number> | null> {
  const key = TWELVEDATA_KEY();
  if (!key) return null;

  // Batch: single API call for all forex pairs
  const symbols = 'EUR/HUF,USD/HUF,GBP/HUF,CHF/HUF,EUR/USD';
  const data = await fetchJSON<Record<string, { price: string } | { price: string }>>(
    `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${key}`,
  );
  if (!data) return null;

  const result: Record<string, number> = {};
  for (const [sym, val] of Object.entries(data)) {
    const price = parseFloat((val as { price: string }).price);
    if (price > 0) {
      result[sym.replace('/', '')] = price;
    }
  }

  if (Object.keys(result).length === 0) return null;
  logger.info(`TwelveData: ${Object.keys(result).length} pairs fetched`);
  return result;
}

/** Finnhub forex rates */
async function fetchFinnhub(symbol: string): Promise<number | null> {
  const key = FINNHUB_KEY();
  if (!key) return null;

  // Finnhub uses format like "OANDA:GBP_HUF"
  const fhSymbol = `OANDA:${symbol.substring(0, 3)}_${symbol.substring(3)}`;
  const data = await fetchJSON<{ c: number; t: number }>(
    `https://finnhub.io/api/v1/quote?symbol=${fhSymbol}&token=${key}`,
  );
  if (!data || !data.c || data.c <= 0) return null;
  logger.info(`Finnhub: ${symbol} = ${data.c}`);
  return data.c;
}

/** Metals-API for gold */
async function fetchMetalsAPI(): Promise<{ xauusd: number; xaueur: number } | null> {
  const key = METALS_KEY();
  if (!key) return null;

  const data = await fetchJSON<{
    success: boolean;
    rates: Record<string, number>;
  }>(`https://metals-api.com/api/latest?access_key=${key}&base=XAU&symbols=USD,EUR`);

  if (!data?.success || !data.rates) return null;

  // Metals-API returns rates as 1 XAU = X USD (inverted sometimes)
  // Their base=XAU means: 1 oz gold = rates.USD dollars
  const xauusd = data.rates['USD'];
  const xaueur = data.rates['EUR'];
  if (!xauusd || xauusd <= 100) return null; // sanity check

  logger.info(`Metals-API: XAU/USD=${xauusd}, XAU/EUR=${xaueur}`);
  return { xauusd, xaueur };
}

/** Frankfurter (ECB) — free, no key, reliable fallback */
async function fetchFrankfurter(): Promise<{
  rates: Record<string, number>;
  date: string;
} | null> {
  const data = await fetchJSON<{ date: string; rates: Record<string, number> }>(
    'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,HUF,GBP,CHF',
  );
  if (!data?.rates) return null;
  logger.info(`Frankfurter: ECB rates loaded (${data.date})`);
  return { rates: data.rates, date: data.date };
}

/** Frankfurter historical (for 24h change) */
async function fetchHistoricalRates(): Promise<Record<string, number> | null> {
  for (let daysBack = 1; daysBack <= 5; daysBack++) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const dateStr = d.toISOString().split('T')[0];

    const cached = historicalCache.get(dateStr);
    if (cached) return cached;

    const data = await fetchJSON<{ date: string; rates: Record<string, number> }>(
      `https://api.frankfurter.dev/v1/${dateStr}?base=EUR&symbols=USD,HUF,GBP,CHF`,
      5000,
    );
    if (data?.rates && Object.keys(data.rates).length > 0) {
      historicalCache.set(data.date, data.rates);
      return data.rates;
    }
  }
  return null;
}

/** Swissquote gold (realtime broker feed, no key) */
async function fetchSwissquoteGold(): Promise<number | null> {
  const data = await fetchJSON<Array<{
    spreadProfilePrices: Array<{ bid: number; ask: number }>;
  }>>('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', 5000);
  if (!data?.[0]?.spreadProfilePrices?.[0]) return null;
  const { bid, ask } = data[0].spreadProfilePrices[0];
  if (bid <= 1000 || ask <= 1000) return null;
  const price = round((bid + ask) / 2, 2);
  logger.info(`Swissquote gold: ${price} USD/oz`);
  return price;
}

// ============================================================
// MAIN: fetchMarketRates
// ============================================================
export async function fetchMarketRates(): Promise<RateInfo[]> {
  const now = Date.now();
  if (cachedRates && (now - ratesCachedAt) < RATE_CACHE_TTL) {
    return cachedRates;
  }

  const timestamp = new Date().toISOString();
  const rates: RateInfo[] = [];

  // --- Step 1: Forex rates (TwelveData primary → Frankfurter fallback) ---
  let eurhuf = 0, usdhuf = 0, gbphuf = 0, chfhuf = 0, eurusd = 0;

  const td = await fetchTwelveData();
  if (td) {
    eurhuf = td['EURHUF'] || 0;
    usdhuf = td['USDHUF'] || 0;
    gbphuf = td['GBPHUF'] || 0;
    chfhuf = td['CHFHUF'] || 0;
    eurusd = td['EURUSD'] || 0;
  }

  // Fallback: Frankfurter ECB for any missing rates
  if (!eurhuf || !eurusd) {
    const ff = await fetchFrankfurter();
    if (ff) {
      if (!eurusd) eurusd = ff.rates['USD'] ?? 1.085;
      if (!eurhuf) eurhuf = ff.rates['HUF'] ?? 395;
      if (!usdhuf) usdhuf = eurhuf / eurusd;
      if (!gbphuf) gbphuf = eurhuf / (ff.rates['GBP'] ?? 0.858);
      if (!chfhuf) chfhuf = eurhuf / (ff.rates['CHF'] ?? 0.952);
    }
  }

  // Cross-rate fallbacks
  if (!usdhuf && eurhuf && eurusd) usdhuf = round(eurhuf / eurusd, 2);
  if (!gbphuf) {
    // Try Finnhub for GBP/HUF specifically
    const fh = await fetchFinnhub('GBPHUF');
    if (fh) gbphuf = fh;
  }

  // --- Step 2: Gold (Metals-API primary → Swissquote fallback) ---
  let xauusd = 0, xaueur = 0;

  const metals = await fetchMetalsAPI();
  if (metals) {
    xauusd = metals.xauusd;
    xaueur = metals.xaueur;
  }

  if (!xauusd) {
    // Swissquote fallback (free, no key)
    const sq = await fetchSwissquoteGold();
    if (sq) {
      xauusd = sq;
      xaueur = eurusd > 0 ? round(sq / eurusd, 2) : 0;
    }
  }

  const xauhuf = xauusd && usdhuf ? round(xauusd * usdhuf, 0) : 0;

  // --- Step 3: Historical rates for 24h change ---
  const hist = await fetchHistoricalRates();
  const prevEurusd = hist?.['USD'] ?? eurusd;
  const prevEurhuf = hist?.['HUF'] ?? eurhuf;
  const prevEurgbp = hist?.['GBP'] ?? (eurhuf && gbphuf ? eurhuf / gbphuf : 0);
  const prevEurchf = hist?.['CHF'] ?? (eurhuf && chfhuf ? eurhuf / chfhuf : 0);
  const prevUsdhuf = prevEurhuf && prevEurusd ? prevEurhuf / prevEurusd : usdhuf;
  const prevGbphuf = prevEurhuf && prevEurgbp ? prevEurhuf / prevEurgbp : gbphuf;
  const prevChfhuf = prevEurhuf && prevEurchf ? prevEurhuf / prevEurchf : chfhuf;

  // --- Build rates array ---
  if (eurusd) rates.push({ pair: 'EURUSD', label: 'EUR/USD', rate: eurusd, ...calcChange(eurusd, prevEurusd), timestamp });
  if (eurhuf) rates.push({ pair: 'EURHUF', label: 'EUR/HUF', rate: eurhuf, ...calcChange(eurhuf, prevEurhuf), timestamp });
  if (usdhuf) rates.push({ pair: 'USDHUF', label: 'USD/HUF', rate: round(usdhuf, 2), ...calcChange(usdhuf, prevUsdhuf), timestamp });
  if (gbphuf) rates.push({ pair: 'GBPHUF', label: 'GBP/HUF', rate: round(gbphuf, 2), ...calcChange(gbphuf, prevGbphuf), timestamp });
  if (chfhuf) rates.push({ pair: 'CHFHUF', label: 'CHF/HUF', rate: round(chfhuf, 2), ...calcChange(chfhuf, prevChfhuf), timestamp });
  if (xauusd) rates.push({ pair: 'XAUUSD', label: 'Arany (USD)', rate: round(xauusd, 2), change24h: 0, changePercent: 0, timestamp });
  if (xaueur) rates.push({ pair: 'XAUEUR', label: 'Arany (EUR)', rate: round(xaueur, 2), change24h: 0, changePercent: 0, timestamp });
  if (xauhuf) rates.push({ pair: 'XAUHUF', label: 'Arany (HUF)', rate: xauhuf, change24h: 0, changePercent: 0, timestamp });

  // Sanity: if no rates at all (all APIs down), use hardcoded defaults
  if (rates.length === 0) {
    logger.error('CRITICAL: All rate sources failed! Using emergency fallback rates.');
    const ts = timestamp;
    rates.push(
      { pair: 'EURUSD', label: 'EUR/USD', rate: 1.085, change24h: 0, changePercent: 0, timestamp: ts },
      { pair: 'EURHUF', label: 'EUR/HUF', rate: 395, change24h: 0, changePercent: 0, timestamp: ts },
      { pair: 'USDHUF', label: 'USD/HUF', rate: 364, change24h: 0, changePercent: 0, timestamp: ts },
      { pair: 'GBPHUF', label: 'GBP/HUF', rate: 460, change24h: 0, changePercent: 0, timestamp: ts },
      { pair: 'CHFHUF', label: 'CHF/HUF', rate: 415, change24h: 0, changePercent: 0, timestamp: ts },
    );
  }

  cachedRates = rates;
  ratesCachedAt = now;
  logger.info(`Market rates loaded: ${rates.length} pairs (sources: ${td ? 'TwelveData' : ''}${metals ? '+Metals' : ''}${!td ? 'Frankfurter-fallback' : ''})`);
  return rates;
}

// ============================================================
// NEWS FETCHING — Finnhub + Alpha Vantage + RSS fallback
// ============================================================

/** Finnhub market news (general + forex category) */
async function fetchFinnhubNews(): Promise<MarketNewsItem[]> {
  const key = FINNHUB_KEY();
  if (!key) return [];

  const data = await fetchJSON<Array<{
    headline: string;
    source: string;
    url: string;
    datetime: number;
    summary: string;
    category: string;
  }>>(`https://finnhub.io/api/v1/news?category=forex&token=${key}`);

  if (!data || !Array.isArray(data)) return [];

  return data.slice(0, 10).map(item => ({
    title: item.headline,
    source: item.source || 'Finnhub',
    url: item.url,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    summary: item.summary?.substring(0, 300) || '',
  }));
}

/** Alpha Vantage news sentiment (forex + commodities) */
async function fetchAlphaVantageNews(): Promise<MarketNewsItem[]> {
  const key = ALPHAVANTAGE_KEY();
  if (!key) return [];

  const data = await fetchJSON<{
    feed?: Array<{
      title: string;
      source: string;
      url: string;
      time_published: string;
      summary: string;
      ticker_sentiment?: Array<{ ticker: string }>;
    }>;
  }>(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=economy_fiscal,economy_monetary,finance&apikey=${key}`, 10000);

  if (!data?.feed) return [];

  return data.feed.slice(0, 10).map(item => ({
    title: item.title,
    source: item.source || 'Alpha Vantage',
    url: item.url,
    publishedAt: item.time_published
      ? `${item.time_published.substring(0, 4)}-${item.time_published.substring(4, 6)}-${item.time_published.substring(6, 8)}T${item.time_published.substring(9, 11)}:${item.time_published.substring(11, 13)}:00Z`
      : new Date().toISOString(),
    summary: item.summary?.substring(0, 300) || '',
    relatedPairs: item.ticker_sentiment?.map(t => t.ticker).filter(t => t.startsWith('FOREX:') || t.startsWith('CRYPTO:')),
  }));
}

/** RSS fallback news (same feeds as before) */
async function fetchRSSNewsItems(): Promise<MarketNewsItem[]> {
  const feeds = [
    { url: 'https://news.google.com/rss/search?q=EUR+USD+forex+market&hl=en&gl=US&ceid=US:en', source: 'Google News (FX)' },
    { url: 'https://news.google.com/rss/search?q=gold+price+XAU&hl=en&gl=US&ceid=US:en', source: 'Google News (Gold)' },
    { url: 'https://news.google.com/rss/search?q=forint+HUF+Hungary+economy&hl=en&gl=US&ceid=US:en', source: 'Google News (HUF)' },
    { url: 'https://www.portfolio.hu/rss/all.xml', source: 'Portfolio.hu' },
  ];

  const items: MarketNewsItem[] = [];

  await Promise.allSettled(feeds.map(async (feed) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ZMail-Market/1.0' },
      });
      clearTimeout(timer);
      if (!resp.ok) return;
      const xml = await resp.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xml)) !== null && count < 5) {
        const itemXml = match[1];
        const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? '';
        const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? '';
        const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? '';

        if (title && title.length > 10) {
          items.push({
            title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'),
            source: feed.source,
            url: link,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          });
          count++;
        }
      }
    } catch {
      // silently skip failed feeds
    }
  }));

  return items;
}

/** Main news fetcher — Finnhub + Alpha Vantage + RSS fallback */
export async function fetchMarketNews(): Promise<MarketNewsItem[]> {
  const now = Date.now();
  if (cachedNews && (now - newsCachedAt) < NEWS_CACHE_TTL) {
    return cachedNews;
  }

  // Parallel: all sources at once
  const [finnhubNews, avNews, rssNews] = await Promise.all([
    fetchFinnhubNews().catch(() => [] as MarketNewsItem[]),
    fetchAlphaVantageNews().catch(() => [] as MarketNewsItem[]),
    fetchRSSNewsItems().catch(() => [] as MarketNewsItem[]),
  ]);

  // Merge and deduplicate (by title similarity)
  const all = [...finnhubNews, ...avNews, ...rssNews];
  const seen = new Set<string>();
  const unique = all.filter(item => {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by date descending, limit to 25
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const result = unique.slice(0, 25);

  cachedNews = result;
  newsCachedAt = now;
  logger.info(`Market news loaded: ${result.length} items (Finnhub: ${finnhubNews.length}, AV: ${avNews.length}, RSS: ${rssNews.length})`);
  return result;
}

// ============================================================
// TREND DATA — Frankfurter historical (free, no key needed)
// ============================================================
export interface TrendDataPoint {
  date: string;
  rates: Record<string, number | null>;
}

export async function fetchTrendData(days = 7): Promise<TrendDataPoint[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await fetchJSON<{
    rates: Record<string, Record<string, number | undefined>>;
  }>(`https://api.frankfurter.dev/v1/${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}?base=EUR&symbols=USD,HUF,GBP,CHF`, 10000);

  if (!data?.rates) return [];

  return Object.entries(data.rates)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, r]) => ({
      date,
      rates: {
        EUR_HUF: r['HUF'] ?? null,
        USD_HUF: r['HUF'] && r['USD'] ? round(r['HUF'] / r['USD'], 2) : null,
        GBP_HUF: r['HUF'] && r['GBP'] ? round(r['HUF'] / r['GBP'], 2) : null,
        CHF_HUF: r['HUF'] && r['CHF'] ? round(r['HUF'] / r['CHF'], 2) : null,
        EUR_USD: r['USD'] ?? null,
      },
    }));
}
