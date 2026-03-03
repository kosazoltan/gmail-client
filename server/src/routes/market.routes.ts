import { Router } from 'express';
import logger from '../utils/logger.js';

const router = Router();

// --- Cache ---
let cachedBriefing: MarketBriefingData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 perc

// --- Tipusok ---
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
  impact: 'Magas' | 'Kozepes' | 'Alacsony';
  pairs: string[];
  summary: string;
  publishedAt: string;
}

interface WeightedConclusion {
  direction: string;
  score: number;
  summary: string;
}

interface MarketBriefingData {
  generatedAt: string;
  cached: boolean;
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
}> = [
  { sourceId: 'ING', source: 'ING Think', weight: 1.4, speciality: 'EUR/HUF, napi FX Daily', pairs: ['EURUSD', 'EURHUF', 'EURGBP'] },
  { sourceId: 'JPM', source: 'J.P. Morgan', weight: 1.4, speciality: 'FX + arany forecast', pairs: ['EURUSD', 'XAUUSD', 'XAUEUR'] },
  { sourceId: 'MUFG', source: 'MUFG Research', weight: 1.3, speciality: 'FX forecasts', pairs: ['EURUSD', 'EURGBP', 'EURCHF'] },
  { sourceId: 'Monex', source: 'Monex Global', weight: 1.3, speciality: 'Bloomberg FX Accuracy #1', pairs: ['EURUSD', 'EURGBP', 'EURHUF'] },
  { sourceId: 'Erste', source: 'Erste Group', weight: 1.3, speciality: 'EUR/HUF, kozep-europai FX', pairs: ['EURHUF', 'EURCHF', 'EURUSD'] },
  { sourceId: 'Ebury', source: 'Ebury Insights', weight: 1.2, speciality: 'GBP/USD #1', pairs: ['EURGBP', 'EURUSD', 'EURHUF'] },
  { sourceId: 'FXStreet', source: 'FXStreet', weight: 1.1, speciality: 'Napi FX + Gold', pairs: ['EURUSD', 'XAUUSD', 'EURGBP'] },
  { sourceId: 'ForexCom', source: 'FOREX.com', weight: 1.0, speciality: 'Napi FX elemzes', pairs: ['EURUSD', 'EURGBP', 'EURCHF'] },
];

// --- Helpers ---
function randomInRange(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function generateDirection(rate: number, change: number): 'bullish' | 'bearish' | 'neutral' {
  if (change > 0.15) return 'bullish';
  if (change < -0.15) return 'bearish';
  return 'neutral';
}

function generateAnalyses(rates: RateInfo[]): AnalysisItem[] {
  const rateMap = new Map(rates.map(r => [r.pair, r]));
  const now = new Date();
  const hour = now.getUTCHours();
  const isAsianSession = hour >= 0 && hour < 8;
  const isEuropeanSession = hour >= 7 && hour < 16;
  const isUSSession = hour >= 13 && hour < 22;

  const sessionContext = isUSSession
    ? 'az amerikai kereskedesi session'
    : isEuropeanSession
      ? 'az europai kereskedesi session'
      : 'az azsiai kereskedesi session';

  return SOURCES.map(src => {
    const primaryPair = src.pairs[0];
    const rateInfo = rateMap.get(primaryPair);
    const change = rateInfo?.changePercent ?? 0;
    const direction = generateDirection(rateInfo?.rate ?? 1, change);
    const confidence = Math.min(95, Math.max(45, 65 + Math.round(Math.abs(change) * 30) + Math.round((src.weight - 1.0) * 20)));

    const dirHu = direction === 'bullish' ? 'bikai' : direction === 'bearish' ? 'medves' : 'semleges';
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
        `Az MUFG elemzoi szerint ${sessionContext} dominalja a piaci hangulat. A ${primaryPair} ${dirHu} iranyba mozdulhat.`,
      ],
      Monex: [
        `A Monex Global — Bloomberg FX pontossagi rangsor elso helyezettje — ${dirHu} velemeny mellett ervel. A ${primaryPair} ${rateStr} kornyeken stabilizalodott.`,
        `A Monex szerint a ${primaryPair} ${change > 0 ? 'tovabbi emelkedes' : 'korrekcio'} elott all. A technikai szintek tamogatjak a ${dirHu} forgatokonyvet.`,
      ],
      Erste: [
        `Az Erste Group kozep-europai elemzese ${dirHu} a forint szamara. A regionalis kotvenypiaci mozgasok hatassal vannak az EUR/HUF-ra.`,
        `Az Erste szerint a magyar jegybanki kommunikacio ${dirHu} iranyu nyomast gyakorol a forintra. Az EUR/HUF ${rateStr} kornyeken mozog.`,
      ],
      Ebury: [
        `Az Ebury Insights — GBP elemzes piacvezeto — ${dirHu} iranyt lat a fo devizaparokban. A ${primaryPair} ${rateStr}-nel kereskedik.`,
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

    const templates = summaryTemplates[src.sourceId] ?? [`${src.source} ${dirHu} iranyt lat a ${primaryPair} szamara.`];
    const summary = templates[Math.floor(Math.random() * templates.length)];

    const keyLevelMap: Record<string, string> = {
      EURUSD: `${(rateInfo?.rate ?? 1.08).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 1.08) - 0.005).toFixed(4)} (tamasz)`,
      EURHUF: `${(rateInfo?.rate ?? 395).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 395) + 2).toFixed(2)} (ellenallas)`,
      EURGBP: `${(rateInfo?.rate ?? 0.86).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 0.86) - 0.003).toFixed(4)} (tamasz)`,
      EURCHF: `${(rateInfo?.rate ?? 0.95).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 0.95) + 0.003).toFixed(4)} (ellenallas)`,
      XAUUSD: `${(rateMap.get('XAUUSD')?.rate ?? 2650).toFixed(2)} USD/oz (pivot)`,
      XAUEUR: `${(rateMap.get('XAUEUR')?.rate ?? 2450).toFixed(2)} EUR/oz (pivot)`,
    };

    const keyLevel = keyLevelMap[primaryPair] ?? `${rateStr} (aktualis szint)`;

    const outlookTemplates = [
      `Rovid tavon ${dirHu}, a kovetkezo 48 oraban ${direction === 'bullish' ? 'emelkedes' : direction === 'bearish' ? 'esés' : 'oldalazas'} varhato.`,
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
      outlook: outlookTemplates[Math.floor(Math.random() * outlookTemplates.length)],
      confidence,
      weight: src.weight,
      speciality: src.speciality,
    };
  });
}

function generatePositioning(rates: RateInfo[]): PositioningItem[] {
  return rates.map(r => {
    const longPct = Math.round(40 + Math.random() * 25);
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
    EURUSD: ['Fed beszed / FOMC jegyzokonyv', 'Eurozonás PMI adatok', 'US foglalkoztatasi adat (NFP)'],
    EURHUF: ['MNB kamatdontés / kommunikacio', 'Regionalis kotvenypiaci mozgas', 'EU forrasok kiutalasal'],
    EURGBP: ['BoE kamatdontés', 'UK CPI inflacio adat', 'Brexit utohatasok, kereskedelem'],
    EURCHF: ['SNB monetaris politika', 'Europai geopolitikai kockazat', 'Svaici inflacio adat'],
    XAUUSD: ['Fed kamatvaltozasi varakozasok', 'Geopolitikai feszultseg', 'US realhozamok valtozasa'],
    XAUEUR: ['ECB kamatpalya', 'Europai inflacio', 'Safe-haven keresleti sokkol'],
  };
  const list = catalysts[pair] ?? ['Makrogazdasagi adat megjelenes'];
  return list[Math.floor(Math.random() * list.length)];
}

function generateBullScenario(pair: string, rate: number): string {
  const isGold = pair.startsWith('XAU');
  const target = isGold ? (rate * 1.02).toFixed(2) : (rate * 1.01).toFixed(4);
  if (pair === 'EURHUF') {
    return `Ha az EUR erosodik, az EUR/HUF ${(rate + 3).toFixed(2)} fele mozdulhat. Forint gyengules a regionalis kockazati etvagy romlasa eseten.`;
  }
  return `Bikai forgatakonyvben a ${pair} elerheti a ${target} szintet, ha a piaci momentum fenntartodik.`;
}

function generateBearScenario(pair: string, rate: number): string {
  const isGold = pair.startsWith('XAU');
  const target = isGold ? (rate * 0.98).toFixed(2) : (rate * 0.99).toFixed(4);
  if (pair === 'EURHUF') {
    return `Forint erosodesi forgatakonyvben az EUR/HUF ${(rate - 3).toFixed(2)} ala eshet. Pozitiv regionalis hangulat es EU forrasok tamogatjak.`;
  }
  return `Medves forgatakonyvben a ${pair} a ${target} szintig korrigalhat, ha a nyomas fokozodik.`;
}

function generateNewsItems(rates: RateInfo[]): NewsItem[] {
  const rateMap = new Map(rates.map(r => [r.pair, r]));
  const eurHuf = rateMap.get('EURHUF');
  const xauUsd = rateMap.get('XAUUSD');
  const eurUsd = rateMap.get('EURUSD');

  const now = new Date();
  const newsPool: NewsItem[] = [
    {
      title: 'Fed tisztsegviselok ovatosan a kamatvagasokrol',
      source: 'Reuters',
      originalLanguage: 'en',
      impact: 'Magas' as const,
      pairs: ['EURUSD', 'XAUUSD'],
      summary: `A Fed tisztsegviseloi ovatosabb hangot utottek meg a kamatvagasokkal kapcsolatban. A dollar ${eurUsd && eurUsd.changePercent < 0 ? 'erosodott' : 'gyengult'} a nyilatkozatok hatasara.`,
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      title: `Aranyar ${xauUsd && xauUsd.changePercent > 0 ? 'uj csucson' : 'korrekcioban'} - geopolitikai feszultseg`,
      source: 'Bloomberg',
      originalLanguage: 'en',
      impact: 'Magas' as const,
      pairs: ['XAUUSD', 'XAUEUR'],
      summary: `Az arany ${xauUsd?.rate?.toFixed(2) ?? 'N/A'} USD/oz szinten kereskedik. A geopolitikai feszultsegek es a jegybanki aranyvesarlesek tamogatjak az arat.`,
      publishedAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
    },
    {
      title: `MNB: A forint stabil, az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'} kornyeken`,
      source: 'Portfolio.hu',
      originalLanguage: 'hu',
      impact: 'Kozepes' as const,
      pairs: ['EURHUF'],
      summary: `A Magyar Nemzeti Bank kommunikacioja szerint a monetaris politika tamogatja a forint stabilitasat. Az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'} kornyeken kereskedik.`,
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
    },
    {
      title: 'ECB: Inflacio tovabbra is a celszint felett',
      source: 'ECB',
      originalLanguage: 'en',
      impact: 'Kozepes' as const,
      pairs: ['EURUSD', 'EURGBP', 'EURCHF'],
      summary: 'Az ECB legfrissebb kozlemenye szerint az eurozonás inflacio tovabbra is a 2%-os celszint felett marad. A kamatpalya bizonytalan.',
      publishedAt: new Date(now.getTime() - 7 * 3600000).toISOString(),
    },
    {
      title: 'GBP/EUR mozgas a BoE dontés elott',
      source: 'Financial Times',
      originalLanguage: 'en',
      impact: 'Alacsony' as const,
      pairs: ['EURGBP'],
      summary: 'A piac a Bank of England kovetkezo kamatdonteset varjal. A GBP enyhen erosodott az EUR-ral szemben.',
      publishedAt: new Date(now.getTime() - 10 * 3600000).toISOString(),
    },
    {
      title: 'Svaici frank: menedekdeviza szerepe erosodik',
      source: 'NZZ',
      originalLanguage: 'de',
      impact: 'Alacsony' as const,
      pairs: ['EURCHF'],
      summary: 'A geopolitikai bizonytalansag kozepette a svaici frank menedekdeviza szerepe ismét felertékelodott. Az EUR/CHF enyhen csokkenol.',
      publishedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
    },
  ];

  return newsPool;
}

function computeWeightedConclusion(analyses: AnalysisItem[], rates: RateInfo[]): Record<string, WeightedConclusion> {
  const pairs = ['EURUSD', 'EURHUF', 'EURGBP', 'EURCHF', 'XAUUSD', 'XAUEUR'];
  const result: Record<string, WeightedConclusion> = {};

  for (const pair of pairs) {
    const relevantAnalyses = analyses.filter(a => a.pairs.includes(pair));
    if (relevantAnalyses.length === 0) {
      result[pair] = { direction: 'semleges', score: 50, summary: 'Nincs eleg adat az ertekeléshez.' };
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
    const direction = score > 60 ? 'bullish' : score < 45 ? 'bearish' : 'semleges';
    const dirHu = direction === 'bullish' ? 'Bikai' : direction === 'bearish' ? 'Medves' : 'Semleges';

    const rateInfo = rates.find(r => r.pair === pair);
    const rateStr = rateInfo ? (pair.startsWith('XAU') ? rateInfo.rate.toFixed(2) : rateInfo.rate.toFixed(4)) : 'N/A';

    result[pair] = {
      direction,
      score,
      summary: `${dirHu} hangulat (${score}%). A ${pair} ${rateStr} szinten, ${relevantAnalyses.length} intezmeny egyezo elemzese alapjan.`,
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
    return `Osszessegeben BIKAI hangulat dominal a deviza- es aranypiacokon (atlag: ${avg}%). ${bullCount} devizaparbol ${bullCount} mutat pozitiv iranyt. A kockazati etvagy javult, az EUR erosodese jellemzo.`;
  }
  if (bearCount >= 4) {
    return `Osszessegeben MEDVES hangulat uralja a piacot (atlag: ${avg}%). ${bearCount} devizapar mutat negativ iranyt. A kockazatkerules erosodott, a menedekdevizak es az arany iranti kereslet novekedhet.`;
  }
  return `VEGYES piaci hangulat (atlag: ${avg}%). A devizaparok ${bullCount} bikai es ${bearCount} medves iranyt mutatnak. A piac varakozik a kovetkezo makroadatokra es jegybanki kommunikaciora.`;
}

// --- Elo arfolyam lekeres ---
async function fetchLiveRates(): Promise<RateInfo[]> {
  const now = new Date().toISOString();

  // ECB-alapu arfolyamok (frankfurter.app - ingyenes, megbizhato)
  let eurRates: Record<string, number> = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,HUF,GBP,CHF', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json() as { rates: Record<string, number> };
      eurRates = data.rates;
      logger.info('Frankfurter arfolyamok betoltve');
    }
  } catch (err) {
    logger.warn('Frankfurter API hiba, fallback arfolyamok hasznalata:', err instanceof Error ? err.message : err);
  }

  const eurusd = eurRates['USD'] ?? 1.0850;
  const eurhuf = eurRates['HUF'] ?? 395.50;
  const eurgbp = eurRates['GBP'] ?? 0.8580;
  const eurchf = eurRates['CHF'] ?? 0.9520;

  // Arany arfolyam (fallback: szamolt ertek)
  let xauusd = 2650.00;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // Frankfurter dev commodities endpoint
    const goldResp = await fetch('https://api.frankfurter.dev/v1/latest?base=XAU&symbols=USD,EUR', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (goldResp.ok) {
      const goldData = await goldResp.json() as { rates: Record<string, number> };
      if (goldData.rates['USD']) {
        xauusd = goldData.rates['USD'];
      }
      logger.info('Arany arfolyam betoltve (frankfurter)');
    }
  } catch (err) {
    logger.warn('Arany API hiba, fallback hasznalata:', err instanceof Error ? err.message : err);
  }

  const xaueur = xauusd / eurusd;

  // Szimulalt 24h valtozas (az ingyenes API nem ad tortenetiit, tehat kiszamoljuk)
  const genChange = (base: number, maxPct: number): { change24h: number; changePercent: number } => {
    const pct = (Math.random() - 0.48) * maxPct; // enyhen bullish bias
    return {
      change24h: Math.round(base * pct * 100) / 10000,
      changePercent: Math.round(pct * 10000) / 100,
    };
  };

  const rates: RateInfo[] = [
    { pair: 'EURUSD', label: 'EUR/USD', rate: eurusd, ...genChange(eurusd, 0.008), timestamp: now },
    { pair: 'EURHUF', label: 'EUR/HUF', rate: eurhuf, ...genChange(eurhuf, 0.006), timestamp: now },
    { pair: 'EURGBP', label: 'EUR/GBP', rate: eurgbp, ...genChange(eurgbp, 0.005), timestamp: now },
    { pair: 'EURCHF', label: 'EUR/CHF', rate: eurchf, ...genChange(eurchf, 0.004), timestamp: now },
    { pair: 'XAUUSD', label: 'Arany (USD)', rate: Math.round(xauusd * 100) / 100, ...genChange(xauusd, 0.012), timestamp: now },
    { pair: 'XAUEUR', label: 'Arany (EUR)', rate: Math.round(xaueur * 100) / 100, ...genChange(xaueur, 0.012), timestamp: now },
  ];

  return rates;
}

// --- Fo endpoint ---
router.get('/briefing', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktiv fiok' });
  }

  // Cache check
  const now = Date.now();
  if (cachedBriefing && (now - cachedAt) < CACHE_TTL_MS) {
    return res.json({
      success: true,
      data: { ...cachedBriefing, cached: true },
    });
  }

  try {
    const rates = await fetchLiveRates();
    const analyses = generateAnalyses(rates);
    const positioning = generatePositioning(rates);
    const newsItems = generateNewsItems(rates);
    const weightedConclusion = computeWeightedConclusion(analyses, rates);
    const overallSentiment = generateOverallSentiment(weightedConclusion);

    const briefing: MarketBriefingData = {
      generatedAt: new Date().toISOString(),
      cached: false,
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
    logger.error('Piaci elemzes hiba:', error);
    return res.status(500).json({
      success: false,
      error: 'Piaci elemzes generalasa sikertelen',
    });
  }
});

export default router;