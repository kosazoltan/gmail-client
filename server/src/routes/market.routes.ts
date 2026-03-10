import { Router } from 'express';
import logger from '../utils/logger.js';
import { generateAIAnalysis, generateDeepAnalysis } from '../services/ai-market.service.js';
import type { DeepAnalysisResult, TrendDataPoint } from '../services/ai-market.service.js';
import { fetchNews } from '../services/news.service.js';
import { fetchCryptoPrices } from '../services/crypto.service.js';

const router = Router();

// --- Cache ---
let cachedBriefing: MarketBriefingData | null = null;
let cachedAt = 0;
let isGenerating = false; // BUG3 FIX: prevent duplicate AI calls on concurrent requests
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 perc (árfolyam cache)

// Deep analysis cache (15 perc - drága AI hívás)
let cachedDeepAnalysis: DeepAnalysisResult | null = null;
let deepAnalysisCachedAt = 0;
let isDeepAnalysisGenerating = false;
const DEEP_ANALYSIS_CACHE_TTL_MS = 15 * 60 * 1000;

// Trend cache (1 óra - lassan változik)
let cachedTrend: { data: TrendDataPoint[]; days: number } | null = null;
let trendCachedAt = 0;
const TREND_CACHE_TTL_MS = 60 * 60 * 1000;

// --- Historical rate cache for real 24h change calculation ---
const historicalEurRatesCache = new Map<string, Record<string, number>>();

async function fetchHistoricalEurRates(excludeDate?: string): Promise<Record<string, number> | null> {
  // Try dates going back from yesterday (handles weekends/holidays when no data)
  // If excludeDate is provided (the date of "latest"), skip it to ensure we get a genuinely different business day
  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const dateStr = d.toISOString().split('T')[0];

    // Check in-memory cache (yesterday's rate doesn't change)
    const cached = historicalEurRatesCache.get(dateStr);
    if (cached) {
      // Skip if this cached entry's date matches the current "latest" date
      if (excludeDate && dateStr >= excludeDate) continue;
      return cached;
    }

    try {
      const controller = new AbortController();
      // Use remainingMs() if available (called from within fetchLiveRates context), else 5s
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?base=EUR&symbols=USD,HUF,GBP,CHF`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json() as { date: string; rates: Record<string, number> };
        if (data.rates && Object.keys(data.rates).length > 0) {
          historicalEurRatesCache.set(data.date, data.rates);
          // Skip if the API resolved this to the same business day as "latest"
          if (excludeDate && data.date >= excludeDate) {
            logger.info(`Historikus dátum ${data.date} megegyezik a latest-tel (${excludeDate}), továbblépés...`);
            continue;
          }
          logger.info(`Historikus árfolyamok betöltve (${data.date}, latest: ${excludeDate ?? 'N/A'})`);
          return data.rates;
        }
      }
    } catch (err) {
      logger.warn(`Frankfurter historikus lekérés sikertelen (${dateStr}):`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

// --- Típusok ---
interface RateInfo {
  pair: string;
  label: string;
  rate: number;
  change24h: number;
  changePercent: number;
  timestamp: string;
}

interface AnalysisItem {
  sourceId: string;
  source: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  pairs: string[];
  summary: string;
  keyLevel: string;
  outlook: string;
  confidence: number;
  weight: number;
  speciality: string;
  url: string;
  originalLanguage: string;
}

interface PositioningItem {
  pair: string;
  longPct: number;
  shortPct: number;
  bias: string;
  targetLow: number;
  targetHigh: number;
  support: number;
  resistance: number;
  catalyst48h: string;
  scenarioBull: string;
  scenarioBear: string;
}

interface NewsItem {
  title: string;
  source: string;
  originalLanguage: string;
  impact: 'Magas' | 'Közepes' | 'Alacsony';
  pairs: string[];
  summary: string;
  publishedAt: string;
  url?: string;
}

interface WeightedConclusion {
  direction: string;
  score: number;
  summary: string;
}

interface MarketBriefingData {
  generatedAt: string;
  cached: boolean;
  isAIPowered: boolean;
  rates: RateInfo[];
  analyses: AnalysisItem[];
  positioning: PositioningItem[];
  newsItems: NewsItem[];
  weightedConclusion: Record<string, WeightedConclusion>;
  overallSentiment: string;
}

// --- Institutional Sources ---
const SOURCES: Array<{
  sourceId: string;
  source: string;
  weight: number;
  speciality: string;
  pairs: string[];
  url: string;
  lang: string;
}> = [
  { sourceId: 'ING', source: 'ING Think', weight: 1.4, speciality: 'EUR/HUF, napi FX Daily', pairs: ['EURUSD', 'EURHUF', 'GBPHUF'], url: 'https://think.ing.com/articles/fx-daily/', lang: 'en' },
  { sourceId: 'JPM', source: 'J.P. Morgan', weight: 1.4, speciality: 'FX + arany forecast', pairs: ['EURUSD', 'XAUUSD', 'XAUEUR'], url: 'https://www.jpmorgan.com/insights/global-research/currencies', lang: 'en' },
  { sourceId: 'MUFG', source: 'MUFG Research', weight: 1.3, speciality: 'FX forecasts', pairs: ['EURUSD', 'GBPHUF', 'CHFHUF'], url: 'https://www.mufgamericas.com/insight/fx-weekly', lang: 'en' },
  { sourceId: 'Monex', source: 'Monex Global', weight: 1.3, speciality: 'Bloomberg FX Accuracy #1', pairs: ['EURUSD', 'GBPHUF', 'EURHUF'], url: 'https://www.monexeurope.com/news-analysis/', lang: 'en' },
  { sourceId: 'Erste', source: 'Erste Group', weight: 1.3, speciality: 'EUR/HUF, közép-európai FX', pairs: ['EURHUF', 'CHFHUF', 'EURUSD'], url: 'https://www.erstegroup.com/en/research/report', lang: 'en' },
  { sourceId: 'Ebury', source: 'Ebury Insights', weight: 1.2, speciality: 'GBP/HUF elemzés', pairs: ['GBPHUF', 'EURUSD', 'EURHUF'], url: 'https://www.ebury.com/insights/', lang: 'en' },
  { sourceId: 'FXStreet', source: 'FXStreet', weight: 1.1, speciality: 'Napi FX + Gold', pairs: ['EURUSD', 'XAUUSD', 'GBPHUF'], url: 'https://www.fxstreet.com/analysis', lang: 'en' },
  { sourceId: 'ForexCom', source: 'FOREX.com', weight: 1.0, speciality: 'Napi FX elemzés', pairs: ['EURUSD', 'GBPHUF', 'CHFHUF'], url: 'https://www.forex.com/en/market-analysis/', lang: 'en' },
];

// --- Helpers ---
function generateDirection(change: number): 'bullish' | 'bearish' | 'neutral' {
  if (change > 0.3) return 'bullish';
  if (change < -0.3) return 'bearish';
  return 'neutral';
}

function generateAnalyses(rates: RateInfo[]): AnalysisItem[] {
  const rateMap = new Map(rates.map(r => [r.pair, r]));
  const now = new Date();
  const hour = now.getUTCHours();
  const isEuropeanSession = hour >= 7 && hour < 16;
  const isUSSession = hour >= 13 && hour < 22;
  const isAsianSession = !isEuropeanSession && !isUSSession;

  const sessionContext = isUSSession
    ? 'az amerikai kereskedési session'
    : isEuropeanSession
      ? 'az európai kereskedési session'
      : 'az ázsiai kereskedési session';

  return SOURCES.map(src => {
    const primaryPair = src.pairs[0];
    const rateInfo = rateMap.get(primaryPair);
    const change = rateInfo?.changePercent ?? 0;
    const direction = generateDirection(change);
    const confidence = Math.min(95, Math.max(45, 65 + Math.round(Math.abs(change) * 30) + Math.round((src.weight - 1.0) * 20)));

    const dirHu = direction === 'bullish' ? 'bika' : direction === 'bearish' ? 'medve' : 'semleges';
    const rateStr = rateInfo ? rateInfo.rate.toFixed(4) : 'N/A';

    const summaryTemplates: Record<string, string[]> = {
      ING: [
        `Az ING elemzői ${dirHu} kilátást látnak az EUR-ra. A ${primaryPair} ${rateStr} környékén mozog, ${sessionContext} során fokozott volumen mellett.`,
        `Az ING FX Daily szerint a forint ${change > 0 ? 'gyengülése' : 'erősödése'} folytatódhat. A ${primaryPair} pár technikai szintjei meghatározóak.`,
      ],
      JPM: [
        `A J.P. Morgan ${dirHu} pozíciót javasol. Az arany ${rateMap.get('XAUUSD')?.rate?.toFixed(2) ?? 'N/A'} USD/oz szinten kereskedik, ${change > 0 ? 'erősödő' : 'gyengülő'} momentum mellett.`,
        `A JPM FX és arany előrejelzése ${dirHu} irányú. A dollár ${change > 0 ? 'gyengülése' : 'erősödése'} hatással van a fő devizapárokra.`,
      ],
      MUFG: [
        `A MUFG Research ${dirHu} irányt jelez a ${primaryPair} párra. A ${rateStr} szint fontos technikai referenciapontként szolgál.`,
        `Az MUFG elemzői szerint ${sessionContext} dominálja a piaci hangulatot. A ${primaryPair} ${dirHu} irányba mozdulhat.`,
      ],
      Monex: [
        `A Monex Global - Bloomberg FX pontossági rangsor első helyezettje - ${dirHu} vélemény mellett érvel. A ${primaryPair} ${rateStr} környékén stabilizálódott.`,
        `A Monex szerint a ${primaryPair} ${change > 0 ? 'további emelkedés' : 'korrekció'} előtt áll. A technikai szintek támogatják a ${dirHu} forgatókönyvet.`,
      ],
      Erste: [
        `Az Erste Group közép-európai elemzése ${dirHu} a forint számára. A regionális kötvénypiaci mozgások hatással vannak az EUR/HUF-ra.`,
        `Az Erste szerint a magyar jegybanki kommunikáció ${dirHu} irányú nyomást gyakorol a forintra. Az EUR/HUF ${rateStr} környékén mozog.`,
      ],
      Ebury: [
        `Az Ebury Insights - GBP elemzés piacvezető - ${dirHu} irányt lát a fő devizapárokban. A ${primaryPair} ${rateStr}-nél kereskedik.`,
        `Az Ebury szerint a Bank of England kommunikációja ${dirHu} irányú. A ${primaryPair} következő célár-szintje ${change > 0 ? 'magasabb' : 'alacsonyabb'} lehet.`,
      ],
      FXStreet: [
        `Az FXStreet technikai elemzése ${dirHu} jelzést ad. A ${primaryPair} ${rateStr} szinten áll, az RSI és MACD indikátorok ${direction === 'bullish' ? 'pozitív' : direction === 'bearish' ? 'negatív' : 'semleges'} divergenciát mutatnak.`,
        `Az FXStreet szerint az arany és devizapiacok ${dirHu} trendet követnek. A napi pivot szintek fontosak a ${primaryPair} számára.`,
      ],
      ForexCom: [
        `A FOREX.com napi elemzése ${dirHu} hangulatú. A ${primaryPair} ${rateStr} szinten kereskedik, a volumen ${change > 0 ? 'növekszik' : 'csökken'}.`,
        `A FOREX.com szerint a ${primaryPair} pár ${dirHu} irányú mozgásra számíthat ${sessionContext} maradékában.`,
      ],
    };

    const templates = summaryTemplates[src.sourceId] ?? [`${src.source} ${dirHu} iranyt lat a ${primaryPair} szamara.`];
    const summary = templates[hour % templates.length];

    const keyLevelMap: Record<string, string> = {
      EURUSD: `${(rateInfo?.rate ?? 1.08).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 1.08) - 0.005).toFixed(4)} (támasz)`,
      EURHUF: `${(rateInfo?.rate ?? 395).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 395) + 2).toFixed(2)} (ellenállás)`,
      GBPHUF: `${(rateInfo?.rate ?? 460).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 460) + 2).toFixed(2)} (ellenállás)`,
      CHFHUF: `${(rateInfo?.rate ?? 415).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 415) + 2).toFixed(2)} (ellenállás)`,
      XAUUSD: `${(rateMap.get('XAUUSD')?.rate ?? 2650).toFixed(2)} USD/oz (pivot)`,
      XAUEUR: `${(rateMap.get('XAUEUR')?.rate ?? 2450).toFixed(2)} EUR/oz (pivot)`,
    };

    const keyLevel = keyLevelMap[primaryPair] ?? `${rateStr} (aktuális szint)`;

    const outlookTemplates = [
      `Rövid távon ${dirHu}, a következő 48 órában ${direction === 'bullish' ? 'emelkedés' : direction === 'bearish' ? 'esés' : 'oldalazás'} várható.`,
      `A heti kilátások ${dirHu} irányt sugallnak, különösen ${sessionContext} aktivitását figyelembe véve.`,
      `A következő jegybanki kommunikáció fordulópontot hozhat. Jelenleg ${dirHu} a hangulat.`,
    ];

    return {
      sourceId: src.sourceId,
      source: src.source,
      direction,
      pairs: src.pairs,
      summary,
      keyLevel,
      outlook: outlookTemplates[(hour + SOURCES.indexOf(src)) % outlookTemplates.length],
      confidence,
      weight: src.weight,
      speciality: src.speciality,
      url: src.url,
      originalLanguage: src.lang,
    };
  });
}

function generatePositioning(rates: RateInfo[]): PositioningItem[] {
  return rates.map(r => {
    // Derive positioning from actual changePercent (no randomness)
    const clampedChange = Math.max(-2, Math.min(2, r.changePercent));
    const longPct = Math.round(50 + clampedChange * 8); // ±2% → 34-66 range
    const shortPct = 100 - longPct;
    const bias = longPct > 55 ? 'Long' : shortPct > 55 ? 'Short' : 'Vegyes';
    const isGold = r.pair.startsWith('XAU');
    const spread = isGold ? r.rate * 0.03 : r.rate * 0.015;

    return {
      pair: r.pair,
      longPct,
      shortPct,
      bias,
      targetLow: Math.round((r.rate - spread) * (isGold ? 100 : 10000)) / (isGold ? 100 : 10000),
      targetHigh: Math.round((r.rate + spread) * (isGold ? 100 : 10000)) / (isGold ? 100 : 10000),
      support: Math.round((r.rate - spread * 0.7) * (isGold ? 100 : 10000)) / (isGold ? 100 : 10000),
      resistance: Math.round((r.rate + spread * 0.7) * (isGold ? 100 : 10000)) / (isGold ? 100 : 10000),
      catalyst48h: generateCatalyst(r.pair),
      scenarioBull: generateBullScenario(r.pair, r.rate),
      scenarioBear: generateBearScenario(r.pair, r.rate),
    };
  });
}

function generateCatalyst(pair: string): string {
  const catalysts: Record<string, string[]> = {
    EURUSD: ['Fed beszéd / FOMC jegyzőkönyv', 'Eurózónás PMI adatok', 'US foglalkoztatási adat (NFP)'],
    EURHUF: ['MNB kamatdöntés / kommunikáció', 'Regionális kötvénypiaci mozgás', 'EU források kiutalása'],
    GBPHUF: ['BoE kamatdöntés', 'UK CPI infláció adat', 'MNB monetáris politika'],
    CHFHUF: ['SNB monetáris politika', 'MNB kamatdöntés', 'Svájci infláció adat'],
    XAUUSD: ['Fed kamatváltozási várakozások', 'Geopolitikai feszültség', 'US reálhozamok változása'],
    XAUEUR: ['ECB kamatpálya', 'Európai infláció', 'Safe-haven keresleti sokk'],
  };
  const list = catalysts[pair] ?? ['Makrogazdasági adat megjelenés'];
  // Deterministic selection based on current day of week
  const dayOfWeek = new Date().getDay();
  return list[dayOfWeek % list.length];
}

function generateBullScenario(pair: string, rate: number): string {
  const isGold = pair.startsWith('XAU');
  const target = isGold ? (rate * 1.02).toFixed(2) : (rate * 1.01).toFixed(4);
  if (pair === 'EURHUF') {
    return `Ha az EUR erősödik, az EUR/HUF ${(rate + 3).toFixed(2)} felé mozdulhat. Forint gyengülés a regionális kockázati étvágy romlása esetén.`;
  }
  return `Bika forgatókönyvben a ${pair} elérheti a ${target} szintet, ha a piaci momentum fenntartódik.`;
}

function generateBearScenario(pair: string, rate: number): string {
  const isGold = pair.startsWith('XAU');
  const target = isGold ? (rate * 0.98).toFixed(2) : (rate * 0.99).toFixed(4);
  if (pair === 'EURHUF') {
    return `Forint erősödési forgatókönyvben az EUR/HUF ${(rate - 3).toFixed(2)} alá eshet. Pozitív regionális hangulat és EU források támogatják.`;
  }
  return `Medve forgatókönyvben a ${pair} a ${target} szintig korrigálhat, ha a nyomás fokozódik.`;
}

function generateNewsItems(rates: RateInfo[]): NewsItem[] {
  const rateMap = new Map(rates.map(r => [r.pair, r]));
  const eurHuf = rateMap.get('EURHUF');
  const xauUsd = rateMap.get('XAUUSD');
  const xauHuf = rateMap.get('XAUHUF');
  const eurUsd = rateMap.get('EURUSD');
  const usdHuf = rateMap.get('USDHUF');

  const now = new Date();
  const newsPool: NewsItem[] = [
    {
      title: 'Fed tisztségviselők óvatosan a kamatvágásokról',
      source: 'Reuters',
      originalLanguage: 'en',
      impact: 'Magas' as const,
      pairs: ['EURUSD', 'XAUUSD', 'USDHUF'],
      summary: `A Fed tisztségviselői óvatosabb hangot ütöttek meg a kamatvágásokkal kapcsolatban. A dollár ${eurUsd && eurUsd.changePercent < 0 ? 'erősödött' : 'gyengült'} a nyilatkozatok hatására. Az USD/HUF ${usdHuf?.rate?.toFixed(2) ?? '365'} környékén kereskedik.`,
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      url: 'https://www.reuters.com/markets/currencies/',
    },
    {
      title: `Aranyár ${xauUsd && xauUsd.changePercent > 0 ? 'új csúcson' : 'korrekcióban'} - geopolitikai feszültség`,
      source: 'Bloomberg',
      originalLanguage: 'en',
      impact: 'Magas' as const,
      pairs: ['XAUUSD', 'XAUEUR', 'XAUHUF'],
      summary: `Az arany ${xauUsd?.rate?.toFixed(2) ?? 'N/A'} USD/oz (${xauHuf?.rate?.toLocaleString('hu-HU') ?? 'N/A'} Ft/oz) szinten kereskedik. A geopolitikai feszültségek és a jegybanki aranyvásárlások támogatják az árat.`,
      publishedAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
      url: 'https://www.bloomberg.com/markets/commodities',
    },
    {
      title: `MNB: A forint stabil, az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'} környékén`,
      source: 'Portfolio.hu',
      originalLanguage: 'hu',
      impact: 'Közepes' as const,
      pairs: ['EURHUF', 'USDHUF'],
      summary: `A Magyar Nemzeti Bank kommunikációja szerint a monetáris politika támogatja a forint stabilitását. Az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'}, az USD/HUF ${usdHuf?.rate?.toFixed(2) ?? '365'} környékén kereskedik.`,
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      url: 'https://www.portfolio.hu/deviza',
    },
    {
      title: 'ECB: Infláció továbbra is a célszint felett',
      source: 'ECB',
      originalLanguage: 'en',
      impact: 'Közepes' as const,
      pairs: ['EURUSD', 'EURHUF', 'CHFHUF'],
      summary: 'Az Európai Központi Bank legfrissebb közleménye szerint az eurózónás infláció továbbra is a 2%-os célszint felett marad. A kamatpálya bizonytalan.',
      publishedAt: new Date(now.getTime() - 7 * 3600000).toISOString(),
      url: 'https://www.ecb.europa.eu/press/pr/html/index.en.html',
    },
    {
      title: 'GBP/EUR mozgás a BoE kamatdöntés előtt',
      source: 'Financial Times',
      originalLanguage: 'en',
      impact: 'Alacsony' as const,
      pairs: ['GBPHUF'],
      summary: 'A piac a Bank of England következő kamatdöntését várja. A font/forint árfolyam mozgásban.',
      publishedAt: new Date(now.getTime() - 10 * 3600000).toISOString(),
      url: 'https://www.ft.com/currencies',
    },
    {
      title: 'Svájci frank: menedékdeviza szerepe erősödik',
      source: 'NZZ',
      originalLanguage: 'de',
      impact: 'Alacsony' as const,
      pairs: ['CHFHUF'],
      summary: 'A geopolitikai bizonytalanság közepette a svájci frank menedékdeviza szerepe ismét felértékelődött. A CHF/HUF árfolyam emelkedhet.',
      publishedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
      url: 'https://www.nzz.ch/finanzen/devisen',
    },
    {
      title: `Arany forintban: ${xauHuf?.rate?.toLocaleString('hu-HU') ?? 'N/A'} Ft/oz`,
      source: 'Privátbankár',
      originalLanguage: 'hu',
      impact: 'Közepes' as const,
      pairs: ['XAUHUF', 'XAUUSD'],
      summary: `A magyar befektetők számára fontos arany/forint árfolyam ${xauHuf?.rate?.toLocaleString('hu-HU') ?? 'N/A'} Ft/oz szinten áll. A forintgyengülés és az aranyár emelkedése együttesen hajtja a HUF-ban denominált aranyárat.`,
      publishedAt: new Date(now.getTime() - 6 * 3600000).toISOString(),
      url: 'https://privatbankar.hu/befektetes/arany/',
    },
    {
      title: 'ING: Közép-európai devizák kilátásai',
      source: 'ING Think',
      originalLanguage: 'en',
      impact: 'Közepes' as const,
      pairs: ['EURHUF', 'USDHUF', 'CHFHUF'],
      summary: `Az ING elemzői szerint a közép-európai devizák (forint, zloty, korona) kilátásai vegyesek. Az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'} körüli sávban stabilizálódhat.`,
      publishedAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      url: 'https://think.ing.com/articles/fx-daily/',
    },
  ];

  return newsPool;
}

function computeWeightedConclusion(analyses: AnalysisItem[], rates: RateInfo[]): Record<string, WeightedConclusion> {
  const pairs = ['EURUSD', 'EURHUF', 'USDHUF', 'GBPHUF', 'CHFHUF', 'XAUUSD', 'XAUEUR', 'XAUHUF'];
  const result: Record<string, WeightedConclusion> = {};

  for (const pair of pairs) {
    const relevantAnalyses = analyses.filter(a => a.pairs.includes(pair));
    if (relevantAnalyses.length === 0) {
      result[pair] = { direction: 'neutral', score: 50, summary: 'Nincs elég adat az értékeléshez.' };
      continue;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    for (const a of relevantAnalyses) {
      const dirScore = a.direction === 'bullish' ? a.confidence : a.direction === 'bearish' ? 100 - a.confidence : 50;
      weightedSum += dirScore * a.weight;
      totalWeight += a.weight;
    }

    const score = Math.round(weightedSum / totalWeight);
    const direction = score > 60 ? 'bullish' : score < 45 ? 'bearish' : 'neutral';
    const dirHu = direction === 'bullish' ? 'Bika' : direction === 'bearish' ? 'Medve' : 'Semleges';

    const rateInfo = rates.find(r => r.pair === pair);
    const rateStr = rateInfo ? (pair.startsWith('XAU') ? rateInfo.rate.toFixed(2) : rateInfo.rate.toFixed(4)) : 'N/A';

    result[pair] = {
      direction,
      score,
      summary: `${dirHu} hangulat (${score}%). A ${pair} ${rateStr} szinten, ${relevantAnalyses.length} intézmény egyező elemzése alapján.`,
    };
  }

  return result;
}

function generateOverallSentiment(conclusion: Record<string, WeightedConclusion>): string {
  const scores = Object.values(conclusion).map(c => c.score);
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const bullCount = Object.values(conclusion).filter(c => c.direction === 'bullish').length;
  const bearCount = Object.values(conclusion).filter(c => c.direction === 'bearish').length;

  if (bullCount >= 4) {
    return `Összességében BIKA hangulat dominál a deviza- és aranypiacokon (átlag: ${avg}%). ${bullCount} devizapárból ${bullCount} mutat pozitív irányt. A kockázati étvágy javult, az EUR erősödése jellemző.`;
  }
  if (bearCount >= 4) {
    return `Összességében MEDVE hangulat uralja a piacot (átlag: ${avg}%). ${bearCount} devizapár mutat negatív irányt. A kockázatkerülés erősödött, a menedékdevizák és az arany iránti kereslet növekedhet.`;
  }
  return `VEGYES piaci hangulat (átlag: ${avg}%). A devizapárok ${bullCount} bika és ${bearCount} medve irányt mutatnak. A piac várakozik a következő makroadatokra és jegybanki kommunikációra.`;
}

// --- Élő árfolyam lekérés ---
async function fetchLiveRates(): Promise<RateInfo[]> {
  // Global timeout: abort everything if fetchLiveRates exceeds 12s total
  const globalTimeout = 12000;
  const startTime = Date.now();
  // Shared AbortController for the entire fetchLiveRates lifecycle
  const globalAbort = new AbortController();
  const globalTimer = setTimeout(() => globalAbort.abort(), globalTimeout);

  function remainingMs(): number {
    const elapsed = Date.now() - startTime;
    return Math.max(0, globalTimeout - elapsed);
  }

  const now = new Date().toISOString();

  // ECB-alapú árfolyamok (frankfurter.app - ingyenes, megbízható)
  let eurRates: Record<string, number> = {};
  let latestDate: string | undefined; // The actual business date of the "latest" rates
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(5000, remainingMs()));
    const resp = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,HUF,GBP,CHF', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json() as { date: string; rates: Record<string, number> };
      eurRates = data.rates;
      latestDate = data.date; // e.g. "2026-03-06" (Friday) even if today is Sunday
      logger.info(`Frankfurter árfolyamok betöltve (dátum: ${latestDate})`);
    }
  } catch (err) {
    logger.warn('Frankfurter API hiba, fallback árfolyamok használata:', err instanceof Error ? err.message : err);
  }

  const eurusd = eurRates['USD'] ?? 1.0850;
  const eurhuf = eurRates['HUF'] ?? 395.50;
  const eurgbp = eurRates['GBP'] ?? 0.8580;
  const eurchf = eurRates['CHF'] ?? 0.9520;

  // Keresztárfolyamok kiszámítása
  const usdhuf = eurhuf / eurusd;
  const gbphuf = eurhuf / eurgbp;
  const chfhuf = eurhuf / eurchf;

  // Arany árfolyam - PÁRHUZAMOS lekérdezés (Promise.any) a gyorsabb válaszért
  let xauusd = 0;
  let goldFetched = false;

  const goldTimeoutMs = Math.min(5000, remainingMs());
  // Shared AbortController for gold parallel requests — first success cancels the rest
  const goldAbort = new AbortController();

  // Helper for fetching with timeout + global abort signal
  async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
    const controller = new AbortController();
    // Abort on either local timeout OR global budget expiry
    const onGlobalAbort = () => controller.abort();
    globalAbort.signal.addEventListener('abort', onGlobalAbort, { once: true });
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(t);
      globalAbort.signal.removeEventListener('abort', onGlobalAbort);
    }
  }

  // Promise.any polyfill for ES2020 target — first success cancels the rest
  function promiseAny<T>(promises: Promise<T>[], abortOnSuccess?: AbortController): Promise<T> {
    if (promises.length === 0) return Promise.reject(new Error('No promises provided'));
    return new Promise((resolve, reject) => {
      let rejections = 0;
      for (const p of promises) {
        p.then((val) => {
          abortOnSuccess?.abort(); // cancel losing requests
          resolve(val);
        }).catch(() => {
          rejections++;
          if (rejections === promises.length) reject(new Error('All gold API sources failed'));
        });
      }
    });
  }

  try {
    const goldResult = await promiseAny([
      // 1. Swissquote (élő bróker feed, real-time)
      (async (): Promise<{ source: string; price: number }> => {
        const goldResp = await fetchWithTimeout(
          'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD',
          goldTimeoutMs,
        );
        if (!goldResp.ok) throw new Error('Swissquote not ok');
        const goldData = await goldResp.json() as Array<{
          spreadProfilePrices: Array<{ bid: number; ask: number }>;
        }>;
        if (Array.isArray(goldData) && goldData[0]?.spreadProfilePrices?.[0]) {
          const { bid, ask } = goldData[0].spreadProfilePrices[0];
          if (bid > 1000 && ask > 1000) {
            return { source: 'Swissquote', price: Math.round(((bid + ask) / 2) * 100) / 100 };
          }
        }
        throw new Error('Swissquote invalid data');
      })(),

      // 2. NBP (Lengyel Nemzeti Bank, napi frissítés)
      (async (): Promise<{ source: string; price: number }> => {
        const nbpResp = await fetchWithTimeout('https://api.nbp.pl/api/cenyzlota?format=json', goldTimeoutMs);
        if (!nbpResp.ok) throw new Error('NBP not ok');
        const nbpData = await nbpResp.json() as Array<{ cena: number }>;
        if (!Array.isArray(nbpData) || !nbpData[0]?.cena) throw new Error('NBP invalid data');
        const plnPerGram = nbpData[0].cena;
        const plnPerOz = plnPerGram * 31.1035;
        // Get EUR/PLN for conversion
        const plnResp = await fetchWithTimeout(
          'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=PLN',
          Math.min(3000, remainingMs()),
        );
        if (!plnResp.ok) throw new Error('Frankfurter PLN not ok');
        const plnRates = await plnResp.json() as { rates: { PLN?: number } };
        const eurpln = plnRates.rates.PLN ?? 4.30;
        const usdpln = eurpln / eurusd;
        const nbpXau = Math.round((plnPerOz / usdpln) * 100) / 100;
        if (nbpXau <= 1000) throw new Error('NBP gold price too low');
        return { source: `NBP (${plnPerGram} PLN/g)`, price: nbpXau };
      })(),

      // 3. fawazahmed0 Currency API (CDN, napi frissítés)
      (async (): Promise<{ source: string; price: number }> => {
        const resp = await fetchWithTimeout(
          'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json',
          goldTimeoutMs,
        );
        if (!resp.ok) throw new Error('Currency-API CDN not ok');
        const data = await resp.json() as { xau?: Record<string, number> };
        if (!data.xau?.usd || data.xau.usd <= 1000) throw new Error('Currency-API CDN invalid data');
        return { source: 'Currency-API CDN', price: Math.round(data.xau.usd * 100) / 100 };
      })(),
    ], goldAbort);  // pass goldAbort so first success cancels losing requests

    xauusd = goldResult.price;
    goldFetched = true;
    logger.info(`Arany árfolyam betöltve (${goldResult.source}): ${xauusd} USD/oz`);
  } catch (err) {
    logger.error('FIGYELEM: Minden arany API forrás sikertelen! Az arany árfolyam nem elérhető.', err);
  }

  const xaueur = xauusd / eurusd;
  const xauhuf = xauusd * usdhuf;

  // --- Valós 24h változás historikus adatból ---
  // Pass latestDate so we skip the same business day on weekends
  // Check remaining budget before historical fetch (skip if budget nearly exhausted)
  let histRates: Record<string, number> | null = null;
  if (remainingMs() > 2000) {
    histRates = await fetchHistoricalEurRates(latestDate);
  } else {
    logger.warn('fetchLiveRates: skipping historical fetch, global budget nearly exhausted', { remainingMs: remainingMs() });
  }

  // Yesterday's EUR-based rates (fallback to today if historical unavailable)
  const prevEurusd = histRates?.['USD'] ?? eurusd;
  const prevEurhuf = histRates?.['HUF'] ?? eurhuf;
  const prevEurgbp = histRates?.['GBP'] ?? eurgbp;
  const prevEurchf = histRates?.['CHF'] ?? eurchf;

  // Yesterday's cross rates
  const prevUsdhuf = prevEurhuf / prevEurusd;
  const prevGbphuf = prevEurhuf / prevEurgbp;
  const prevChfhuf = prevEurhuf / prevEurchf;

  // Calculate real change (current vs historical)
  const calcChange = (current: number, previous: number): { change24h: number; changePercent: number } => {
    if (previous === 0 || current === previous) return { change24h: 0, changePercent: 0 };
    const change24h = Math.round((current - previous) * 10000) / 10000;
    const changePercent = Math.round(((current - previous) / previous) * 10000) / 100;
    return { change24h, changePercent };
  };

  const rates: RateInfo[] = [
    { pair: 'EURUSD', label: 'EUR/USD', rate: eurusd, ...calcChange(eurusd, prevEurusd), timestamp: now },
    { pair: 'EURHUF', label: 'EUR/HUF', rate: eurhuf, ...calcChange(eurhuf, prevEurhuf), timestamp: now },
    { pair: 'USDHUF', label: 'USD/HUF', rate: Math.round(usdhuf * 100) / 100, ...calcChange(usdhuf, prevUsdhuf), timestamp: now },
    { pair: 'GBPHUF', label: 'GBP/HUF', rate: Math.round(gbphuf * 100) / 100, ...calcChange(gbphuf, prevGbphuf), timestamp: now },
    { pair: 'CHFHUF', label: 'CHF/HUF', rate: Math.round(chfhuf * 100) / 100, ...calcChange(chfhuf, prevChfhuf), timestamp: now },
  ];

  // Arany ráták - historikus arany ár lekérése NBP-ből a 24h változáshoz
  let prevXauusd = 0;
  if (goldFetched) {
    try {
      const nbpHistResp = await fetchWithTimeout(
        'https://api.nbp.pl/api/cenyzlota/last/2/?format=json',
        Math.min(4000, remainingMs()),
      );
      if (nbpHistResp.ok) {
        const nbpHistData = await nbpHistResp.json() as Array<{ data: string; cena: number }>;
        if (Array.isArray(nbpHistData) && nbpHistData.length >= 2) {
          const prevPlnPerGram = nbpHistData[0].cena;
          const prevPlnPerOz = prevPlnPerGram * 31.1035;
          try {
            const plnResp2 = await fetchWithTimeout(
              'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=PLN',
              Math.min(3000, remainingMs()),
            );
            if (plnResp2.ok) {
              const plnRates2 = await plnResp2.json() as { rates: { PLN?: number } };
              const eurpln2 = plnRates2.rates.PLN ?? 4.30;
              const usdpln2 = eurpln2 / eurusd;
              prevXauusd = Math.round((prevPlnPerOz / usdpln2) * 100) / 100;
              logger.info(`Historikus arany ár betöltve (NBP): ${prevXauusd} USD/oz (${nbpHistData[0].data})`);
            }
          } catch (err) {
            logger.warn('NBP historikus PLN konverzió sikertelen:', err instanceof Error ? err.message : err);
          }
        }
      }
    } catch (err) {
      logger.warn('NBP historikus arany lekérés sikertelen:', err instanceof Error ? err.message : err);
    }

    const prevXaueur = prevXauusd > 0 ? prevXauusd / prevEurusd : 0;
    const prevXauhuf = prevXauusd > 0 ? prevXauusd * prevUsdhuf : 0;

    rates.push(
      { pair: 'XAUUSD', label: 'Arany (USD)', rate: Math.round(xauusd * 100) / 100, ...calcChange(xauusd, prevXauusd || xauusd), timestamp: now },
      { pair: 'XAUEUR', label: 'Arany (EUR)', rate: Math.round(xaueur * 100) / 100, ...calcChange(xaueur, prevXaueur || xaueur), timestamp: now },
      { pair: 'XAUHUF', label: 'Arany (HUF)', rate: Math.round(xauhuf), ...calcChange(xauhuf, prevXauhuf || xauhuf), timestamp: now },
    );
  } else {
    // Gold unavailable — push placeholder rates so frontend doesn't crash on missing XAU entries
    logger.warn('Gold rates unavailable — returning goldUnavailable placeholder');
    rates.push(
      { pair: 'XAUUSD', label: 'Arany (USD)', rate: 0, change24h: 0, changePercent: 0, timestamp: now, goldUnavailable: true } as RateInfo,
      { pair: 'XAUEUR', label: 'Arany (EUR)', rate: 0, change24h: 0, changePercent: 0, timestamp: now, goldUnavailable: true } as RateInfo,
      { pair: 'XAUHUF', label: 'Arany (HUF)', rate: 0, change24h: 0, changePercent: 0, timestamp: now, goldUnavailable: true } as RateInfo,
    );
  }

  clearTimeout(globalTimer); // cleanup global budget timer
  return rates;
}

// --- Fő endpoint ---
router.get('/briefing', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();
  if (!forceRefresh && cachedBriefing && (now - cachedAt) < CACHE_TTL_MS) {
    return res.json({
      success: true,
      data: { ...cachedBriefing, cached: true },
    });
  }

  // BUG3 FIX: if another request is already generating, return stale cache or 503
  if (isGenerating) {
    if (cachedBriefing) {
      return res.json({ success: true, data: { ...cachedBriefing, cached: true } });
    }
    return res.status(503).json({ success: false, error: 'Elemzés folyamatban, kérlek próbáld újra 30 másodperc múlva.' });
  }

  isGenerating = true;
  try {
    const rates = await fetchLiveRates();

    // AI elemzés (ha van API kulcs), egyébként sablon fallback
    // Promise.race: hard 45s timeout — if AI hangs, fall back to template
    const aiResult = await Promise.race([
      generateAIAnalysis(rates),
      new Promise<null>((resolve) => setTimeout(() => {
        logger.warn('generateAIAnalysis hard timeout (45s) — falling back to template');
        resolve(null);
      }, 45_000)),
    ]);

    let analyses: AnalysisItem[];
    let positioning: PositioningItem[];
    let newsItems: NewsItem[];
    let weightedConclusion: Record<string, WeightedConclusion>;
    let overallSentiment: string;

    let isAIPowered = false;

    if (aiResult) {
      logger.info('AI-alapú piaci elemzés használata');
      isAIPowered = true;
      analyses = aiResult.analyses;
      positioning = aiResult.positioning;
      newsItems = aiResult.newsItems;
      weightedConclusion = aiResult.weightedConclusion;
      overallSentiment = aiResult.overallSentiment;
    } else {
      logger.info('Sablon-alapú piaci elemzés használata (nincs AI)');
      analyses = generateAnalyses(rates);
      positioning = generatePositioning(rates);
      newsItems = generateNewsItems(rates);
      weightedConclusion = computeWeightedConclusion(analyses, rates);
      overallSentiment = generateOverallSentiment(weightedConclusion) +
        '\n\n⚠️ Ez sablon-alapú becslés, nem valódi AI elemzés. Az ANTHROPIC_API_KEY beállításával valós AI elemzés érhető el.';
      // Mark template-based analyses clearly
      analyses = analyses.map(a => ({
        ...a,
        source: `${a.source} (sablon becslés)`,
        summary: a.summary + ' ⚠️ Ez automatikus sablon-alapú becslés az élő árfolyamadatok alapján, nem valódi intézményi elemzés.',
      }));
    }

    const briefing: MarketBriefingData = {
      generatedAt: new Date().toISOString(),
      cached: false,
      isAIPowered,
      rates,
      analyses,
      positioning,
      newsItems,
      weightedConclusion,
      overallSentiment,
    };

    // Update cache
    cachedBriefing = briefing;
    cachedAt = now;

    return res.json({ success: true, data: briefing });
  } catch (error) {
    logger.error('Piaci elemzés hiba:', error);
    return res.status(500).json({
      success: false,
      error: 'Piaci elemzés generálása sikertelen',
    });
  } finally {
    isGenerating = false; // BUG3 FIX: always release the lock
  }
});

// --- 7 napos trend lekérés ---
async function fetchTrendData(days: number = 7): Promise<TrendDataPoint[]> {
  const now = Date.now();
  if (cachedTrend && cachedTrend.days === days && (now - trendCachedAt) < TREND_CACHE_TTL_MS) {
    return cachedTrend.data;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(
      `https://api.frankfurter.dev/v1/${startStr}..${endStr}?base=EUR&symbols=USD,HUF,GBP,CHF`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn(`Frankfurter trend API hiba: ${resp.status}`);
      return [];
    }

    const data = await resp.json() as {
      rates: Record<string, Record<string, number | undefined>>;
    };

    const result: TrendDataPoint[] = Object.entries(data.rates)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rates]) => {
        // Calculate cross rates for HUF pairs with null safety
        const eurUsd = rates['USD'];
        const eurHuf = rates['HUF'];
        const eurGbp = rates['GBP'];
        const eurChf = rates['CHF'];

        return {
          date,
          rates: {
            EUR_HUF: eurHuf ?? null,
            USD_HUF: eurHuf && eurUsd ? Math.round((eurHuf / eurUsd) * 100) / 100 : null,
            GBP_HUF: eurHuf && eurGbp ? Math.round((eurHuf / eurGbp) * 100) / 100 : null,
            CHF_HUF: eurHuf && eurChf ? Math.round((eurHuf / eurChf) * 100) / 100 : null,
            EUR_USD: eurUsd ?? null,
          },
        };
      });

    // Update cache
    cachedTrend = { data: result, days };
    trendCachedAt = now;

    logger.info(`Trend adatok betöltve: ${result.length} nap (${startStr}..${endStr})`);
    return result;
  } catch (err) {
    logger.warn('Trend API hiba:', err instanceof Error ? err.message : err);
    return [];
  }
}

// --- Trend endpoint ---
router.get('/trend', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7));

  try {
    const trendData = await fetchTrendData(days);
    return res.json({ success: true, data: trendData });
  } catch (error) {
    logger.error('Trend lekérés hiba:', error);
    return res.status(500).json({ success: false, error: 'Trend adatok lekérése sikertelen' });
  }
});

// --- Deep Analysis endpoint ---
router.post('/deep-analysis', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const now = Date.now();

  // Return cached if fresh
  if (cachedDeepAnalysis && (now - deepAnalysisCachedAt) < DEEP_ANALYSIS_CACHE_TTL_MS) {
    return res.json({
      success: true,
      data: { ...cachedDeepAnalysis, cached: true },
    });
  }

  // Prevent concurrent generation
  if (isDeepAnalysisGenerating) {
    if (cachedDeepAnalysis) {
      return res.json({
        success: true,
        data: { ...cachedDeepAnalysis, cached: true },
      });
    }
    return res.status(503).json({
      success: false,
      error: 'Mély elemzés folyamatban, kérlek próbáld újra 30 másodperc múlva.',
    });
  }

  isDeepAnalysisGenerating = true;
  try {
    // Fetch live rates + 7 day trend in parallel
    const [rates, trendData] = await Promise.all([
      fetchLiveRates(),
      fetchTrendData(7),
    ]);

    const result = await generateDeepAnalysis(rates, trendData);

    if (!result) {
      // Template-based fallback when AI is unavailable
      const fallbackCurrencies: Record<string, { trend: string; support: number; resistance: number; forecast: string; recommendation: string; confidence: number }> = {};
      for (const r of rates) {
        if (r.pair.startsWith('XAU')) continue;
        const trend = r.changePercent > 0.1 ? 'up' : r.changePercent < -0.1 ? 'down' : 'sideways';
        const spread = r.rate * 0.015;
        fallbackCurrencies[r.pair.replace(/(.{3})(.{3})/, '$1_$2')] = {
          trend,
          support: Math.round((r.rate - spread) * 100) / 100,
          resistance: Math.round((r.rate + spread) * 100) / 100,
          forecast: `Sablon alapú elemzés: a ${r.label} ${r.changePercent >= 0 ? 'emelkedik' : 'csökken'} (${r.changePercent.toFixed(2)}%).`,
          recommendation: r.changePercent > 0.3 ? 'buy' : r.changePercent < -0.3 ? 'sell' : 'hold',
          confidence: 3,
        };
      }

      return res.json({
        success: true,
        data: {
          summary: 'Sablon alapú elemzés - Az AI mély elemzés átmenetileg nem elérhető. Az alábbi adatok az élő árfolyamok alapján készültek.',
          currencies: fallbackCurrencies,
          gold: {
            trend: rates.find(r => r.pair === 'XAUUSD') ? 'Adatok alapján' : 'Nem elérhető',
            forecast: 'Sablon alapú elemzés - nincs AI előrejelzés.',
            recommendation: 'Kézi elemzés javasolt.',
          },
          overallRecommendation: 'Sablon alapú elemzés - az AI átmenetileg nem elérhető. Az élő árfolyamok és trend adatok alapján hozzon döntést.',
          risks: ['Az elemzés sablon alapú, nem AI-generált - körültekintő döntéshozatal javasolt.'],
          generatedAt: new Date().toISOString(),
          cached: false,
          trendData,
          rates,
        },
      });
    }

    // Cache the result
    cachedDeepAnalysis = result;
    deepAnalysisCachedAt = now;

    return res.json({
      success: true,
      data: {
        ...result,
        cached: false,
        trendData,
        rates,
      },
    });
  } catch (error) {
    logger.error('Deep analysis hiba:', error);
    return res.status(500).json({
      success: false,
      error: 'Mély elemzés generálása sikertelen',
    });
  } finally {
    isDeepAnalysisGenerating = false;
  }
});

// --- News endpoint (RSS) ---
router.get('/news', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const articles = await fetchNews();
    return res.json({ success: true, articles });
  } catch (error) {
    logger.error('Hírek lekérés hiba:', error);
    return res.status(500).json({ success: false, error: 'Hírek lekérése sikertelen' });
  }
});

// --- Crypto endpoint (CoinGecko) ---
router.get('/crypto', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const prices = await fetchCryptoPrices();
    return res.json({ success: true, prices });
  } catch (error) {
    logger.error('Crypto lekérés hiba:', error);
    return res.status(500).json({ success: false, error: 'Crypto árfolyamok lekérése sikertelen' });
  }
});

export default router;