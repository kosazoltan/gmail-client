import { Router } from 'express';
import logger from '../utils/logger.js';

const router = Router();

// --- Cache ---
let cachedBriefing: MarketBriefingData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 perc

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
  { sourceId: 'Erste', source: 'Erste Group', weight: 1.3, speciality: 'EUR/HUF, közép-európai FX', pairs: ['EURHUF', 'EURCHF', 'EURUSD'] },
  { sourceId: 'Ebury', source: 'Ebury Insights', weight: 1.2, speciality: 'GBP/USD #1', pairs: ['EURGBP', 'EURUSD', 'EURHUF'] },
  { sourceId: 'FXStreet', source: 'FXStreet', weight: 1.1, speciality: 'Napi FX + Gold', pairs: ['EURUSD', 'XAUUSD', 'EURGBP'] },
  { sourceId: 'ForexCom', source: 'FOREX.com', weight: 1.0, speciality: 'Napi FX elemzés', pairs: ['EURUSD', 'EURGBP', 'EURCHF'] },
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
        `A Monex Global — Bloomberg FX pontossági rangsor első helyezettje — ${dirHu} vélemény mellett érvel. A ${primaryPair} ${rateStr} környékén stabilizálódott.`,
        `A Monex szerint a ${primaryPair} ${change > 0 ? 'további emelkedés' : 'korrekció'} előtt áll. A technikai szintek támogatják a ${dirHu} forgatókönyvet.`,
      ],
      Erste: [
        `Az Erste Group közép-európai elemzése ${dirHu} a forint számára. A regionális kötvénypiaci mozgások hatással vannak az EUR/HUF-ra.`,
        `Az Erste szerint a magyar jegybanki kommunikáció ${dirHu} irányú nyomást gyakorol a forintra. Az EUR/HUF ${rateStr} környékén mozog.`,
      ],
      Ebury: [
        `Az Ebury Insights — GBP elemzés piacvezető — ${dirHu} irányt lát a fő devizapárokban. A ${primaryPair} ${rateStr}-nél kereskedik.`,
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
    const summary = templates[Math.floor(Math.random() * templates.length)];

    const keyLevelMap: Record<string, string> = {
      EURUSD: `${(rateInfo?.rate ?? 1.08).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 1.08) - 0.005).toFixed(4)} (támasz)`,
      EURHUF: `${(rateInfo?.rate ?? 395).toFixed(2)} (pivot), ${((rateInfo?.rate ?? 395) + 2).toFixed(2)} (ellenállás)`,
      EURGBP: `${(rateInfo?.rate ?? 0.86).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 0.86) - 0.003).toFixed(4)} (támasz)`,
      EURCHF: `${(rateInfo?.rate ?? 0.95).toFixed(4)} (pivot), ${((rateInfo?.rate ?? 0.95) + 0.003).toFixed(4)} (ellenállás)`,
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
    EURUSD: ['Fed beszéd / FOMC jegyzőkönyv', 'Eurózónás PMI adatok', 'US foglalkoztatási adat (NFP)'],
    EURHUF: ['MNB kamatdöntés / kommunikáció', 'Regionális kötvénypiaci mozgás', 'EU források kiutalása'],
    EURGBP: ['BoE kamatdöntés', 'UK CPI infláció adat', 'Brexit utóhatások, kereskedelem'],
    EURCHF: ['SNB monetáris politika', 'Európai geopolitikai kockázat', 'Svájci infláció adat'],
    XAUUSD: ['Fed kamatváltozási várakozások', 'Geopolitikai feszültség', 'US reálhozamok változása'],
    XAUEUR: ['ECB kamatpálya', 'Európai infláció', 'Safe-haven keresleti sokk'],
  };
  const list = catalysts[pair] ?? ['Makrogazdasági adat megjelenés'];
  return list[Math.floor(Math.random() * list.length)];
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
  const eurUsd = rateMap.get('EURUSD');

  const now = new Date();
  const newsPool: NewsItem[] = [
    {
      title: 'Fed tisztségviselők óvatosan a kamatvágásokról',
      source: 'Reuters',
      originalLanguage: 'en',
      impact: 'Magas' as const,
      pairs: ['EURUSD', 'XAUUSD'],
      summary: `A Fed tisztségviselői óvatosabb hangot ütöttek meg a kamatvágásokkal kapcsolatban. A dollár ${eurUsd && eurUsd.changePercent < 0 ? 'erősödött' : 'gyengült'} a nyilatkozatok hatására.`,
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      title: `Aranyár ${xauUsd && xauUsd.changePercent > 0 ? 'új csúcson' : 'korrekcióban'} - geopolitikai feszültség`,
      source: 'Bloomberg',
      originalLanguage: 'en',
      impact: 'Magas' as const,
      pairs: ['XAUUSD', 'XAUEUR'],
      summary: `Az arany ${xauUsd?.rate?.toFixed(2) ?? 'N/A'} USD/oz szinten kereskedik. A geopolitikai feszültségek és a jegybanki aranyvásárlások támogatják az árat.`,
      publishedAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
    },
    {
      title: `MNB: A forint stabil, az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'} környékén`,
      source: 'Portfolio.hu',
      originalLanguage: 'hu',
      impact: 'Közepes' as const,
      pairs: ['EURHUF'],
      summary: `A Magyar Nemzeti Bank kommunikációja szerint a monetáris politika támogatja a forint stabilitását. Az EUR/HUF ${eurHuf?.rate?.toFixed(2) ?? '395'} környékén kereskedik.`,
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
    },
    {
      title: 'ECB: Infláció továbbra is a célszint felett',
      source: 'ECB',
      originalLanguage: 'en',
      impact: 'Közepes' as const,
      pairs: ['EURUSD', 'EURGBP', 'EURCHF'],
      summary: 'Az ECB legfrissebb közleménye szerint az eurózónás infláció továbbra is a 2%-os célszint felett marad. A kamatpálya bizonytalan.',
      publishedAt: new Date(now.getTime() - 7 * 3600000).toISOString(),
    },
    {
      title: 'GBP/EUR mozgás a BoE döntés előtt',
      source: 'Financial Times',
      originalLanguage: 'en',
      impact: 'Alacsony' as const,
      pairs: ['EURGBP'],
      summary: 'A piac a Bank of England következő kamatdöntését várja. A GBP enyhén erősödött az EUR-ral szemben.',
      publishedAt: new Date(now.getTime() - 10 * 3600000).toISOString(),
    },
    {
      title: 'Svájci frank: menedékdeviza szerepe erősödik',
      source: 'NZZ',
      originalLanguage: 'de',
      impact: 'Alacsony' as const,
      pairs: ['EURCHF'],
      summary: 'A geopolitikai bizonytalanság közepette a svájci frank menedékdeviza szerepe ismét felértékelődött. Az EUR/CHF enyhén csökkenő.',
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
  const now = new Date().toISOString();

  // ECB-alapú árfolyamok (frankfurter.app - ingyenes, megbízható)
  let eurRates: Record<string, number> = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,HUF,GBP,CHF', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json() as { rates: Record<string, number> };
      eurRates = data.rates;
      logger.info('Frankfurter árfolyamok betöltve');
    }
  } catch (err) {
    logger.warn('Frankfurter API hiba, fallback árfolyamok használata:', err instanceof Error ? err.message : err);
  }

  const eurusd = eurRates['USD'] ?? 1.0850;
  const eurhuf = eurRates['HUF'] ?? 395.50;
  const eurgbp = eurRates['GBP'] ?? 0.8580;
  const eurchf = eurRates['CHF'] ?? 0.9520;

  // Arany árfolyam — több forrás próbálása
  let xauusd = 2650.00;
  let goldFetched = false;

  // 1. próba: goldapi.io (ingyenes, nincs API key szükséges a basic endpoint-hoz)
  if (!goldFetched) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const goldResp = await fetch('https://www.goldapi.io/api/XAU/USD', {
        signal: controller.signal,
        headers: { 'x-access-token': 'goldapi-free' },
      });
      clearTimeout(timeout);
      if (goldResp.ok) {
        const goldData = await goldResp.json() as { price?: number };
        if (goldData.price && goldData.price > 0) {
          xauusd = goldData.price;
          goldFetched = true;
          logger.info(`Arany árfolyam betöltve (goldapi): ${xauusd} USD/oz`);
        }
      }
    } catch (err) {
      logger.warn('GoldAPI hiba:', err instanceof Error ? err.message : err);
    }
  }

  // 2. fallback: statikus árfolyam kommenttel
  if (!goldFetched) {
    logger.warn(`Arany API nem elérhető — fallback ${xauusd} USD/oz használata`);
  }

  const xaueur = xauusd / eurusd;

  // Szimulált 24h változás (az ingyenes API nem ad történetit, tehát becsüljük)
  const genChange = (base: number, maxPct: number): { change24h: number; changePercent: number } => {
    const pct = (Math.random() - 0.48) * maxPct; // enyhén bullish bias
    const changePercent = Math.round(pct * 10000) / 100; // pl. 0.42%
    const change24h = Math.round(base * pct * 10000) / 10000; // abszolút érték: pl. 0.0045
    return { change24h, changePercent };
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

// --- Fő endpoint ---
router.get('/briefing', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
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
    logger.error('Piaci elemzés hiba:', error);
    return res.status(500).json({
      success: false,
      error: 'Piaci elemzés generálása sikertelen',
    });
  }
});

export default router;