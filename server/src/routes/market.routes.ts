import { isAIAvailable } from '../ai/provider.js';
import { Router } from 'express';
import logger from '../utils/logger.js';
import { generateAIAnalysis, generateDeepAnalysis } from '../services/ai-market.service.js';
import type { DeepAnalysisResult } from '../services/ai-market.service.js';
import {
  BRIEFING_ROUTE_TIMEOUT_MS,
  DEEP_ANALYSIS_ROUTE_TIMEOUT_MS,
} from '../services/market-ai-config.js';
import {
  fetchMarketRates,
  fetchMarketNews,
  fetchTrendData,
} from '../services/market-data.service.js';
import type { RateInfo, TrendDataPoint } from '../services/market-data.service.js';
import { fetchNews } from '../services/news.service.js';
import { fetchCryptoPrices } from '../services/crypto.service.js';

const router = Router();

// --- Cache ---
let cachedBriefing: MarketBriefingData | null = null;
let cachedSuccessfulAIBriefing: MarketBriefingData | null = null;
let cachedAt = 0;
let isGenerating = false; // BUG3 FIX: prevent duplicate AI calls on concurrent requests
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 perc

// Deep analysis cache (15 perc - draga AI hivas)
let cachedDeepAnalysis: DeepAnalysisPayload | null = null;
let cachedSuccessfulAIDeepAnalysis: DeepAnalysisPayload | null = null;
let deepAnalysisCachedAt = 0;
let isDeepAnalysisGenerating = false;
const DEEP_ANALYSIS_CACHE_TTL_MS = 15 * 60 * 1000;

// --- Tipusok ---
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
  impact: string;
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
  fallbackReason?: 'missing_api_key' | 'timeout' | 'generation_failed';
  fallbackMessage?: string;
  rates: RateInfo[];
  analyses: AnalysisItem[];
  positioning: PositioningItem[];
  newsItems: NewsItem[];
  weightedConclusion: Record<string, WeightedConclusion>;
  overallSentiment: string;
}

interface DeepAnalysisPayload extends DeepAnalysisResult {
  cached: boolean;
  trendData: TrendDataPoint[];
  rates: RateInfo[];
  isAIPowered: boolean;
  fallbackReason?: MarketFallbackReason;
  fallbackMessage?: string;
}

type MarketFallbackReason = 'missing_api_key' | 'timeout' | 'generation_failed';

function getBriefingFallbackMessage(reason: MarketFallbackReason): string {
  switch (reason) {
    case 'missing_api_key':
      return 'Sablon-alapú becslés fut, mert a market AI API kulcs nincs beállítva a szerveren.';
    case 'timeout':
      return 'Sablon-alapú becslés fut, mert a market AI elemzés időtúllépés miatt fallbackre váltott.';
    default:
      return 'Sablon-alapú becslés fut, mert a market AI elemzés hibára futott vagy érvénytelen választ adott.';
  }
}

function sanitizeFallbackText(text: string): string {
  return text
    .replace(/Sablon alapu elemzes/gi, 'Sablon-alapú elemzés')
    .replace(/Mely elemzes/gi, 'Mély elemzés')
    .replace(/atmenetileg/gi, 'átmenetileg')
    .replace(/elerheto/gi, 'elérhető')
    .replace(/elo arfolyamok/gi, 'élő árfolyamok')
    .replace(/elorejelzes/gi, 'előrejelzés')
    .replace(/Kezi elemzes/gi, 'Kézi elemzés')
    .replace(/dontest/gi, 'döntést')
    .replace(/korultekinto/gi, 'körültekintő')
    .replace(/probald ujra/gi, 'próbáld újra')
    .replace(/Osszessegeben/gi, 'Összességében')
    .replace(/dominal/gi, 'dominál')
    .replace(/etvaggy/gi, 'étvágy')
    .replace(/erosodese/gi, 'erősödése')
    .replace(/jellmezo/gi, 'jellemző')
    .replace(/kockazatkerules/gi, 'kockázatkerülés')
    .replace(/novekedhet/gi, 'növekedhet');
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
  {
    sourceId: 'ING',
    source: 'ING Think',
    weight: 1.4,
    speciality: 'EUR/HUF, napi FX Daily',
    pairs: ['EURUSD', 'EURHUF', 'GBPHUF'],
    url: 'https://think.ing.com/articles/fx-daily/',
    lang: 'en',
  },
  {
    sourceId: 'JPM',
    source: 'J.P. Morgan',
    weight: 1.4,
    speciality: 'FX + arany forecast',
    pairs: ['EURUSD', 'XAUUSD', 'XAUEUR'],
    url: 'https://www.jpmorgan.com/insights/global-research/currencies',
    lang: 'en',
  },
  {
    sourceId: 'MUFG',
    source: 'MUFG Research',
    weight: 1.3,
    speciality: 'FX forecasts',
    pairs: ['EURUSD', 'GBPHUF', 'CHFHUF'],
    url: 'https://www.mufgamericas.com/insight/fx-weekly',
    lang: 'en',
  },
  {
    sourceId: 'Monex',
    source: 'Monex Global',
    weight: 1.3,
    speciality: 'Bloomberg FX Accuracy #1',
    pairs: ['EURUSD', 'GBPHUF', 'EURHUF'],
    url: 'https://www.monexeurope.com/news-analysis/',
    lang: 'en',
  },
  {
    sourceId: 'Erste',
    source: 'Erste Group',
    weight: 1.3,
    speciality: 'EUR/HUF, kozep-europai FX',
    pairs: ['EURHUF', 'CHFHUF', 'EURUSD'],
    url: 'https://www.erstegroup.com/en/research/report',
    lang: 'en',
  },
  {
    sourceId: 'Ebury',
    source: 'Ebury Insights',
    weight: 1.2,
    speciality: 'GBP/HUF elemzes',
    pairs: ['GBPHUF', 'EURUSD', 'EURHUF'],
    url: 'https://www.ebury.com/insights/',
    lang: 'en',
  },
  {
    sourceId: 'FXStreet',
    source: 'FXStreet',
    weight: 1.1,
    speciality: 'Napi FX + Gold',
    pairs: ['EURUSD', 'XAUUSD', 'GBPHUF'],
    url: 'https://www.fxstreet.com/analysis',
    lang: 'en',
  },
  {
    sourceId: 'ForexCom',
    source: 'FOREX.com',
    weight: 1.0,
    speciality: 'Napi FX elemzes',
    pairs: ['EURUSD', 'GBPHUF', 'CHFHUF'],
    url: 'https://www.forex.com/en/market-analysis/',
    lang: 'en',
  },
];

// --- Helpers ---
function generateDirection(change: number): 'bullish' | 'bearish' | 'neutral' {
  if (change > 0.3) return 'bullish';
  if (change < -0.3) return 'bearish';
  return 'neutral';
}

function generateAnalyses(rates: RateInfo[]): AnalysisItem[] {
  const rateMap = new Map(rates.map((r) => [r.pair, r]));
  const now = new Date();
  const hour = now.getUTCHours();
  const isEuropeanSession = hour >= 7 && hour < 16;
  const isUSSession = hour >= 13 && hour < 22;
  const isAsianSession = !isEuropeanSession && !isUSSession;

  const sessionContext = isUSSession
    ? 'az amerikai kereskedesi session'
    : isEuropeanSession
      ? 'az europai kereskedesi session'
      : 'az azsiai kereskedesi session';

  return SOURCES.map((src) => {
    const primaryPair = src.pairs[0];
    const rateInfo = rateMap.get(primaryPair);
    const change = rateInfo?.changePercent ?? 0;
    const direction = generateDirection(change);
    const confidence = Math.min(
      95,
      Math.max(45, 65 + Math.round(Math.abs(change) * 30) + Math.round((src.weight - 1.0) * 20)),
    );

    const dirHu = direction === 'bullish' ? 'bika' : direction === 'bearish' ? 'medve' : 'semleges';
    const rateStr = rateInfo ? rateInfo.rate.toFixed(4) : 'N/A';

    const summaryTemplates: Record<string, string[]> = {
      ING: [
        `Az ING elemzoi ${dirHu} kilatast latnak az EUR-ra. A ${primaryPair} ${rateStr} kornyeken mozog, ${sessionContext} soran fokozott volumen mellett.`,
        `Az ING FX Daily szerint a forint ${change > 0 ? 'gyengulese' : 'erosodese'} folytatodhat. A ${primaryPair} par technikai szintjei meghatarozoak.`,
      ],
      JPM: [
        `A J.P. Morgan ${dirHu} poziciot javasol. Az arany ${rateMap.get('XAUUSD')?.rate?.toFixed(2) ?? 'N/A'} USD/oz szinten kereskedik, ${change > 0 ? 'erosodo' : 'gyengulo'} momentum mellett.`,
        `A JPM FX es arany elorejelzese ${dirHu} iranyu. A dollar ${change > 0 ? 'gyengulese' : 'erosodese'} hatassal van a fo devizaparokra.`,
      ],
      MUFG: [
        `A MUFG Research ${dirHu} iranyt jelez a ${primaryPair} parra. A ${rateStr} szint fontos technikai referenciapontkent szolgal.`,
        `Az MUFG elemzoi szerint ${sessionContext} dominalja a piaci hangulatot. A ${primaryPair} ${dirHu} iranyba mozdulhat.`,
      ],
      Monex: [
        `A Monex Global - Bloomberg FX pontossagi rangsor elso helyezettje - ${dirHu} velemeny mellett ervel. A ${primaryPair} ${rateStr} kornyeken stabilizalodott.`,
        `A Monex szerint a ${primaryPair} ${change > 0 ? 'tovabbi emelkedes' : 'korrekcio'} elott all. A technikai szintek tamogatjak a ${dirHu} forgatkonyvet.`,
      ],
      Erste: [
        `Az Erste Group kozep-europai elemzese ${dirHu} a forint szamara. A regionalis kotvenypiaci mozgasok hatassal vannak az EUR/HUF-ra.`,
        `Az Erste szerint a magyar jegybanki kommunikacio ${dirHu} iranyu nyomast gyakorol a forintra. Az EUR/HUF ${rateStr} kornyeken mozog.`,
      ],
      Ebury: [
        `Az Ebury Insights - GBP elemzes piacvezeto - ${dirHu} iranyt lat a fo devizaparokban. A ${primaryPair} ${rateStr}-nel kereskedik.`,
        `Az Ebury szerint a Bank of England kommunikacioja ${dirHu} iranyu. A ${primaryPair} kovetkezo celar-szintje ${change > 0 ? 'magasabb' : 'alacsonyabb'} lehet.`,
      ],
      FXStreet: [
        `Az FXStreet technikai elemzese ${dirHu} jelzest ad. A ${primaryPair} ${rateStr} szinten all, az RSI es MACD indikatorok ${direction === 'bullish' ? 'pozitiv' : direction === 'bearish' ? 'negativ' : 'semleges'} divergenciat mutatnak.`,
        `Az FXStreet szerint az arany es devizapiacok ${dirHu} trendet kovetnek. A napi pivot szintek fontosak a ${primaryPair} szamara.`,
      ],
      ForexCom: [
        `A FOREX.com napi elemzese ${dirHu} hangulatu. A ${primaryPair} ${rateStr} szinten kereskedik, a volumen ${change > 0 ? 'novekszik' : 'csokken'}.`,
        `A FOREX.com szerint a ${primaryPair} par ${dirHu} iranyu mozgasra szamithat ${sessionContext} maradekaban.`,
      ],
    };

    const templates = summaryTemplates[src.sourceId] ?? [
      `${src.source} ${dirHu} iranyt lat a ${primaryPair} szamara.`,
    ];
    const summary = templates[hour % templates.length];

    const keyLevelMap: Record<string, string> = {
      EURUSD: `${(rateInfo?.rate ?? 1.08).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 1.08) - 0.005).toFixed(4)} (tamasz)`,
      EURHUF: `${(rateInfo?.rate ?? 395).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 395) + 2).toFixed(2)} (ellenallas)`,
      GBPHUF: `${(rateInfo?.rate ?? 460).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 460) + 2).toFixed(2)} (ellenallas)`,
      CHFHUF: `${(rateInfo?.rate ?? 415).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 415) + 2).toFixed(2)} (ellenallas)`,
      XAUUSD: `${(rateMap.get('XAUUSD')?.rate ?? 2650).toFixed(2)} USD/oz (pivot)`,
      XAUEUR: `${(rateMap.get('XAUEUR')?.rate ?? 2450).toFixed(2)} EUR/oz (pivot)`,
    };

    const keyLevel = keyLevelMap[primaryPair] ?? `${rateStr} (aktualis szint)`;

    const outlookTemplates = [
      `Rovid tavon ${dirHu}, a kovetkezo 48 oraban ${direction === 'bullish' ? 'emelkedes' : direction === 'bearish' ? 'eses' : 'oldalazas'} varhato.`,
      `A heti kilatasok ${dirHu} iranyt sugallnak, kulonosen ${sessionContext} aktivitasat figyelembe veve.`,
      `A kovetkezo jegybanki kommunikacio fordulopontot hozhat. Jelenleg ${dirHu} a hangulat.`,
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
  return rates.map((r) => {
    // Derive positioning from actual changePercent (no randomness)
    const clampedChange = Math.max(-2, Math.min(2, r.changePercent));
    const longPct = Math.round(50 + clampedChange * 8); // +-2% -> 34-66 range
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
      support:
        Math.round((r.rate - spread * 0.7) * (isGold ? 100 : 10000)) / (isGold ? 100 : 10000),
      resistance:
        Math.round((r.rate + spread * 0.7) * (isGold ? 100 : 10000)) / (isGold ? 100 : 10000),
      catalyst48h: generateCatalyst(r.pair),
      scenarioBull: generateBullScenario(r.pair, r.rate),
      scenarioBear: generateBearScenario(r.pair, r.rate),
    };
  });
}

function generateCatalyst(pair: string): string {
  const catalysts: Record<string, string[]> = {
    EURUSD: [
      'Fed beszéd / FOMC jegyzőkönyv',
      'Eurozónás PMI adatok',
      'US foglalkoztatasi adat (NFP)',
    ],
    EURHUF: [
      'MNB kamatdontes / kommunikacio',
      'Regionalis kotvenypiaci mozgas',
      'EU forrasok kiutalasa',
    ],
    GBPHUF: ['BoE kamatdontes', 'UK CPI inflacio adat', 'MNB monetaris politika'],
    CHFHUF: ['SNB monetaris politika', 'MNB kamatdontes', 'Svajci inflacio adat'],
    XAUUSD: [
      'Fed kamatvaltozasi varakozasok',
      'Geopolitikai feszultseg',
      'US realhozamok valtozasa',
    ],
    XAUEUR: ['ECB kamatpalya', 'Europai inflacio', 'Safe-haven keresleti sokk'],
  };
  const list = catalysts[pair] ?? ['Makrogazdasagi adat megjelenes'];
  // Deterministic selection based on current day of week
  const dayOfWeek = new Date().getDay();
  return list[dayOfWeek % list.length];
}

function generateBullScenario(pair: string, rate: number): string {
  const isGold = pair.startsWith('XAU');
  const target = isGold ? (rate * 1.02).toFixed(2) : (rate * 1.01).toFixed(4);
  if (pair === 'EURHUF') {
    return `Ha az EUR erosodik, az EUR/HUF ${(rate + 3).toFixed(2)} fele mozdulhat. Forint gyengules a regionalis kockazati etvaggy romlasa eseten.`;
  }
  return `Bika forgatkonyv ben a ${pair} elerheti a ${target} szintet, ha a piaci momentum fenntartodik.`;
}

function generateBearScenario(pair: string, rate: number): string {
  const isGold = pair.startsWith('XAU');
  const target = isGold ? (rate * 0.98).toFixed(2) : (rate * 0.99).toFixed(4);
  if (pair === 'EURHUF') {
    return `Forint erosodesi forgatkonyv ben az EUR/HUF ${(rate - 3).toFixed(2)} ala eshet. Pozitiv regionalis hangulat es EU forrasok tamogatjak.`;
  }
  return `Medve forgatkonyv ben a ${pair} a ${target} szintig korrigalhat, ha a nyomas fokozodik.`;
}

function generateNewsItems(rates: RateInfo[]): NewsItem[] {
  const rateMap = new Map(rates.map((r) => [r.pair, r]));
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
      summary:
        'Az Európai Központi Bank legfrissebb közleménye szerint az eurózónás infláció továbbra is a 2%-os célszint felett marad. A kamatpálya bizonytalan.',
      publishedAt: new Date(now.getTime() - 7 * 3600000).toISOString(),
      url: 'https://www.ecb.europa.eu/press/pr/html/index.en.html',
    },
    {
      title: 'GBP/EUR mozgás a BoE kamatdöntés előtt',
      source: 'Financial Times',
      originalLanguage: 'en',
      impact: 'Alacsony' as const,
      pairs: ['GBPHUF'],
      summary:
        'A piac a Bank of England következő kamatdöntését várja. A font/forint árfolyam mozgásban.',
      publishedAt: new Date(now.getTime() - 10 * 3600000).toISOString(),
      url: 'https://www.ft.com/currencies',
    },
    {
      title: 'Svájci frank: menedékdeviza szerepe erősödik',
      source: 'NZZ',
      originalLanguage: 'de',
      impact: 'Alacsony' as const,
      pairs: ['CHFHUF'],
      summary:
        'A geopolitikai bizonytalanság közepette a svájci frank menedékdeviza szerepe ismét felértékelődött. A CHF/HUF árfolyam emelkedhet.',
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

function computeWeightedConclusion(
  analyses: AnalysisItem[],
  rates: RateInfo[],
): Record<string, WeightedConclusion> {
  const pairs = ['EURUSD', 'EURHUF', 'USDHUF', 'GBPHUF', 'CHFHUF', 'XAUUSD', 'XAUEUR', 'XAUHUF'];
  const result: Record<string, WeightedConclusion> = {};

  for (const pair of pairs) {
    const relevantAnalyses = analyses.filter((a) => a.pairs.includes(pair));
    if (relevantAnalyses.length === 0) {
      result[pair] = {
        direction: 'neutral',
        score: 50,
        summary: 'Nincs eleg adat az ertekeleshez.',
      };
      continue;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    for (const a of relevantAnalyses) {
      const dirScore =
        a.direction === 'bullish'
          ? a.confidence
          : a.direction === 'bearish'
            ? 100 - a.confidence
            : 50;
      weightedSum += dirScore * a.weight;
      totalWeight += a.weight;
    }

    const score = Math.round(weightedSum / totalWeight);
    const direction = score > 60 ? 'bullish' : score < 45 ? 'bearish' : 'neutral';
    const dirHu = direction === 'bullish' ? 'Bika' : direction === 'bearish' ? 'Medve' : 'Semleges';

    const rateInfo = rates.find((r) => r.pair === pair);
    const rateStr = rateInfo
      ? pair.startsWith('XAU')
        ? rateInfo.rate.toFixed(2)
        : rateInfo.rate.toFixed(4)
      : 'N/A';

    result[pair] = {
      direction,
      score,
      summary: `${dirHu} hangulat (${score}%). A ${pair} ${rateStr} szinten, ${relevantAnalyses.length} intezmeny egyezo elemzese alapjan.`,
    };
  }

  return result;
}

function generateOverallSentiment(conclusion: Record<string, WeightedConclusion>): string {
  const scores = Object.values(conclusion).map((c) => c.score);
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const bullCount = Object.values(conclusion).filter((c) => c.direction === 'bullish').length;
  const bearCount = Object.values(conclusion).filter((c) => c.direction === 'bearish').length;

  if (bullCount >= 4) {
    return sanitizeFallbackText(
      `Osszessegeben BIKA hangulat dominal a deviza- es aranypiacokon (atlag: ${avg}%). ${bullCount} devizaparbol ${bullCount} mutat pozitiv iranyt. A kockazati etvaggy javult, az EUR erosodese jellmezo.`,
    );
  }
  if (bearCount >= 4) {
    return sanitizeFallbackText(
      `Osszessegeben MEDVE hangulat uralja a piacot (atlag: ${avg}%). ${bearCount} devizapar mutat negativ iranyt. A kockazatkerules erosodott, a menedekdevizak es az arany iranti kereslet novekedhet.`,
    );
  }
  return sanitizeFallbackText(
    `VEGYES piaci hangulat (atlag: ${avg}%). A devizaparok ${bullCount} bika es ${bearCount} medve iranyt mutatnak. A piac varakozik a kovetkezo makroadatokra es jegybanki kommunikaciora.`,
  );
}

// --- Fo endpoint ---
router.get('/briefing', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktiv fiok' });
  }

  const forceRefresh = req.query.refresh === 'true';
  const now = Date.now();
  if (!forceRefresh && cachedBriefing && now - cachedAt < CACHE_TTL_MS) {
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
    return res
      .status(503)
      .json({
        success: false,
        error: 'Elemzés folyamatban, kérlek próbáld újra 30 másodperc múlva.',
      });
  }

  isGenerating = true;
  const t0 = Date.now();
  try {
    logger.info('[BRIEFING] Step 1: fetchMarketRates + fetchMarketNews starting...');
    const [rates, marketNews] = await Promise.all([fetchMarketRates(), fetchMarketNews()]);
    logger.info(
      `[BRIEFING] Step 1 done: ${rates.length} rates, ${marketNews.length} news in ${Date.now() - t0}ms`,
    );

    // AI elemzes (ha van API kulcs), egyebkent sablon fallback
    // Promise.race: hard 45s timeout — if AI hangs, fall back to template
    logger.info(
      `[BRIEFING] Step 2: generateAIAnalysis starting... (ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING'})`,
    );
    const t1 = Date.now();
    const aiResult = await Promise.race([
      generateAIAnalysis(rates, marketNews),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => {
          logger.warn(
            `generateAIAnalysis hard timeout (${BRIEFING_ROUTE_TIMEOUT_MS}ms) — falling back to template or cached AI result`,
          );
          resolve('timeout');
        }, BRIEFING_ROUTE_TIMEOUT_MS),
      ),
    ]);
    logger.info(`[BRIEFING] Step 2 done: AI=${!!aiResult} in ${Date.now() - t1}ms`);

    let analyses: AnalysisItem[];
    let positioning: PositioningItem[];
    let newsItems: NewsItem[];
    let weightedConclusion: Record<string, WeightedConclusion>;
    let overallSentiment: string;

    let isAIPowered = false;
    let fallbackReason: MarketFallbackReason | undefined;
    let fallbackMessage: string | undefined;

    if (aiResult && aiResult !== 'timeout') {
      logger.info('AI-alapu piaci elemzes hasznalata');
      isAIPowered = true;
      analyses = aiResult.analyses;
      positioning = aiResult.positioning;
      newsItems = aiResult.newsItems;
      weightedConclusion = aiResult.weightedConclusion;
      overallSentiment = aiResult.overallSentiment;
    } else {
      logger.info('[BRIEFING] Step 3: generating template fallback...');
      fallbackReason = !isAIAvailable()
        ? 'missing_api_key'
        : aiResult === 'timeout'
          ? 'timeout'
          : 'generation_failed';
      if (fallbackReason !== 'missing_api_key' && cachedSuccessfulAIBriefing) {
        logger.warn(
          `[BRIEFING] Reusing last successful AI briefing because generation ended with ${fallbackReason}`,
        );
        return res.json({
          success: true,
          data: { ...cachedSuccessfulAIBriefing, cached: true },
        });
      }
      fallbackMessage = getBriefingFallbackMessage(fallbackReason);
      analyses = generateAnalyses(rates);
      positioning = generatePositioning(rates);
      newsItems = generateNewsItems(rates);
      weightedConclusion = computeWeightedConclusion(analyses, rates);
      overallSentiment = generateOverallSentiment(weightedConclusion);
      // Mark template-based analyses clearly
      analyses = analyses.map((a) => ({
        ...a,
        source: `${a.source} (sablon becslés)`,
        summary:
          a.summary +
          ' ⚠️ Ez automatikus sablon-alapú becslés az élő árfolyamadatok alapján, nem valódi intézményi elemzés.',
      }));
      logger.info(`[BRIEFING] Step 3 done: template fallback in ${Date.now() - t1}ms`);
    }

    const briefing: MarketBriefingData = {
      generatedAt: new Date().toISOString(),
      cached: false,
      isAIPowered,
      fallbackReason,
      fallbackMessage,
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
    if (isAIPowered) {
      cachedSuccessfulAIBriefing = briefing;
    }

    logger.info(
      `[BRIEFING] SUCCESS: total ${Date.now() - t0}ms, AI=${isAIPowered}, ${rates.length} rates, ${analyses.length} analyses`,
    );
    return res.json({ success: true, data: briefing });
  } catch (error) {
    logger.error(`[BRIEFING] FAILED after ${Date.now() - t0}ms:`, error);
    return res.status(500).json({
      success: false,
      error: 'Piaci elemzes generalasa sikertelen',
    });
  } finally {
    isGenerating = false; // BUG3 FIX: always release the lock
  }
});

// --- Trend endpoint ---
router.get('/trend', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktiv fiok' });
  }

  const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7));

  try {
    const trendData = await fetchTrendData(days);
    return res.json({ success: true, data: trendData });
  } catch (error) {
    logger.error('Trend lekeres hiba:', error);
    return res.status(500).json({ success: false, error: 'Trend adatok lekerese sikertelen' });
  }
});

// --- Deep Analysis endpoint ---
router.post('/deep-analysis', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktiv fiok' });
  }

  const now = Date.now();
  const forceRefresh = req.query.refresh === 'true';

  // Return cached if fresh
  if (
    !forceRefresh &&
    cachedDeepAnalysis &&
    now - deepAnalysisCachedAt < DEEP_ANALYSIS_CACHE_TTL_MS
  ) {
    return res.json({
      success: true,
      data: { ...cachedDeepAnalysis, cached: true },
    });
  }

  // Prevent concurrent generation
  if (isDeepAnalysisGenerating) {
    if (!forceRefresh && cachedDeepAnalysis) {
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
    const [rates, trendData] = await Promise.all([fetchMarketRates(), fetchTrendData(7)]);

    const result = await Promise.race([
      generateDeepAnalysis(rates, trendData),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => {
          logger.warn(
            `generateDeepAnalysis hard timeout (${DEEP_ANALYSIS_ROUTE_TIMEOUT_MS}ms) — falling back to template or cached AI result`,
          );
          resolve('timeout');
        }, DEEP_ANALYSIS_ROUTE_TIMEOUT_MS),
      ),
    ]);

    if (!result || result === 'timeout') {
      // Template-based fallback when AI is unavailable
      const fallbackReason: MarketFallbackReason = !isAIAvailable()
        ? 'missing_api_key'
        : result === 'timeout'
          ? 'timeout'
          : 'generation_failed';
      if (fallbackReason !== 'missing_api_key' && cachedSuccessfulAIDeepAnalysis) {
        logger.warn(
          `[DEEP_ANALYSIS] Reusing last successful AI analysis because generation ended with ${fallbackReason}`,
        );
        return res.json({
          success: true,
          data: { ...cachedSuccessfulAIDeepAnalysis, cached: true },
        });
      }
      const fallbackMessage = getBriefingFallbackMessage(fallbackReason);
      const fallbackCurrencies: DeepAnalysisPayload['currencies'] = {};
      for (const r of rates) {
        if (r.pair.startsWith('XAU')) continue;
        const trend: 'up' | 'down' | 'sideways' =
          r.changePercent > 0.1 ? 'up' : r.changePercent < -0.1 ? 'down' : 'sideways';
        const spread = r.rate * 0.015;
        fallbackCurrencies[r.pair.replace(/(.{3})(.{3})/, '$1_$2')] = {
          trend,
          support: Math.round((r.rate - spread) * 100) / 100,
          resistance: Math.round((r.rate + spread) * 100) / 100,
          forecast: sanitizeFallbackText(
            `Sablon alapu elemzes: a ${r.label} ${r.changePercent >= 0 ? 'emelkedik' : 'csokken'} (${r.changePercent.toFixed(2)}%).`,
          ),
          recommendation: r.changePercent > 0.3 ? 'buy' : r.changePercent < -0.3 ? 'sell' : 'hold',
          confidence: 3,
        };
      }

      const fallbackPayload: DeepAnalysisPayload = {
        summary: sanitizeFallbackText(`Sablon alapu elemzes - ${fallbackMessage}`),
        currencies: fallbackCurrencies,
        gold: {
          trend: rates.find((r) => r.pair === 'XAUUSD') ? 'Adatok alapján' : 'Nem elérhető',
          forecast: 'Sablon-alapú elemzés - nincs AI előrejelzés.',
          recommendation: 'Kézi elemzés javasolt.',
        },
        overallRecommendation:
          'Sablon-alapú elemzés - az AI átmenetileg nem elérhető. Az élő árfolyamok és trend adatok alapján hozzon döntést.',
        risks: ['Az elemzés sablon alapú, nem AI-generált - körültekintő döntéshozatal javasolt.'],
        generatedAt: new Date().toISOString(),
        cached: false,
        trendData,
        rates,
        isAIPowered: false,
        fallbackReason,
        fallbackMessage,
      };
      cachedDeepAnalysis = fallbackPayload;
      deepAnalysisCachedAt = now;
      return res.json({
        success: true,
        data: fallbackPayload,
      });
    }

    // Cache the result
    const deepAnalysisPayload: DeepAnalysisPayload = {
      ...result,
      cached: false,
      trendData,
      rates,
      isAIPowered: true,
    };
    cachedDeepAnalysis = deepAnalysisPayload;
    cachedSuccessfulAIDeepAnalysis = deepAnalysisPayload;
    deepAnalysisCachedAt = now;

    return res.json({
      success: true,
      data: deepAnalysisPayload,
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
    return res.status(401).json({ error: 'Nincs aktiv fiok' });
  }

  try {
    const articles = await fetchNews();
    return res.json({ success: true, articles });
  } catch (error) {
    logger.error('Hirek lekeres hiba:', error);
    return res.status(500).json({ success: false, error: 'Hirek lekerese sikertelen' });
  }
});

// --- Crypto endpoint (CoinGecko) ---
router.get('/crypto', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktiv fiok' });
  }

  try {
    const prices = await fetchCryptoPrices();
    return res.json({ success: true, prices });
  } catch (error) {
    logger.error('Crypto lekeres hiba:', error);
    return res.status(500).json({ success: false, error: 'Crypto arfolyamok lekerese sikertelen' });
  }
});

export default router;
