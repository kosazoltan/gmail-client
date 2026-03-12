import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';
import {
  BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS,
  DEEP_ANALYSIS_REQUEST_TIMEOUT_MS,
  trimNewsItemsForPrompt,
} from './market-ai-config.js';

interface RateInfo {
  pair: string;
  label: string;
  rate: number;
  changePercent: number;
}

export interface NewsItemInput {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

interface AIAnalysisResult {
  analyses: Array<{
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
  }>;
  newsItems: Array<{
    title: string;
    source: string;
    originalLanguage: string;
    impact: 'Magas' | 'Közepes' | 'Alacsony';
    pairs: string[];
    summary: string;
    publishedAt: string;
    url: string;
  }>;
  positioning: Array<{
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
  }>;
  weightedConclusion: Record<string, {
    direction: string;
    score: number;
    summary: string;
  }>;
  overallSentiment: string;
}

let client: Anthropic | null = null;
const MAX_GENERATION_ATTEMPTS = 2;
const MARKET_ANALYSIS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceId: { type: 'string' },
          source: { type: 'string' },
          direction: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
          pairs: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          keyLevel: { type: 'string' },
          outlook: { type: 'string' },
          confidence: { type: 'number' },
          weight: { type: 'number' },
          speciality: { type: 'string' },
          url: { type: 'string' },
          originalLanguage: { type: 'string' },
        },
        required: ['sourceId', 'source', 'direction', 'pairs', 'summary', 'confidence', 'weight'],
        additionalProperties: false,
      },
    },
    newsItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          source: { type: 'string' },
          originalLanguage: { type: 'string' },
          impact: { type: 'string', enum: ['Magas', 'Közepes', 'Kozepes', 'Alacsony'] },
          pairs: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          publishedAt: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['title', 'source', 'impact', 'summary'],
        additionalProperties: false,
      },
    },
    positioning: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pair: { type: 'string' },
          longPct: { type: 'number' },
          shortPct: { type: 'number' },
          bias: { type: 'string' },
          targetLow: { type: 'number' },
          targetHigh: { type: 'number' },
          support: { type: 'number' },
          resistance: { type: 'number' },
          catalyst48h: { type: 'string' },
          scenarioBull: { type: 'string' },
          scenarioBear: { type: 'string' },
        },
        required: ['pair', 'longPct', 'shortPct', 'bias'],
        additionalProperties: false,
      },
    },
    weightedConclusion: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          direction: { type: 'string' },
          score: { type: 'number' },
          summary: { type: 'string' },
        },
        required: ['direction', 'score', 'summary'],
        additionalProperties: false,
      },
    },
    overallSentiment: { type: 'string' },
  },
  required: ['analyses', 'newsItems', 'positioning', 'weightedConclusion', 'overallSentiment'],
  additionalProperties: false,
} as const;

const DEEP_ANALYSIS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    currencies: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          trend: { type: 'string', enum: ['up', 'down', 'sideways'] },
          support: { type: 'number' },
          resistance: { type: 'number' },
          forecast: { type: 'string' },
          recommendation: { type: 'string', enum: ['buy', 'sell', 'hold'] },
          confidence: { type: 'number' },
        },
        required: ['trend', 'support', 'resistance', 'forecast', 'recommendation', 'confidence'],
        additionalProperties: false,
      },
    },
    gold: {
      type: 'object',
      properties: {
        trend: { type: 'string' },
        forecast: { type: 'string' },
        recommendation: { type: 'string' },
      },
      required: ['trend', 'forecast', 'recommendation'],
      additionalProperties: false,
    },
    overallRecommendation: { type: 'string' },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'currencies', 'gold', 'overallRecommendation', 'risks'],
  additionalProperties: false,
} as const;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseJsonLenient<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Common LLM issue: trailing commas
    const cleaned = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }
}

function getTextFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function normalizeDirection(value: unknown): 'bullish' | 'bearish' | 'neutral' {
  if (value === 'bullish' || value === 'bearish' || value === 'neutral') return value;
  return 'neutral';
}

function normalizeImpact(value: unknown): 'Magas' | 'Közepes' | 'Alacsony' {
  if (value === 'Magas' || value === 'Alacsony') return value;
  if (value === 'Közepes' || value === 'Kozepes') return 'Közepes';
  return 'Közepes';
}

function normalizeAIAnalysisResult(
  parsed: Partial<AIAnalysisResult>,
  allowedNewsUrls: Set<string>,
): AIAnalysisResult {
  const analyses = Array.isArray(parsed.analyses)
    ? parsed.analyses
      .map((entry) => ({
        sourceId: String(entry?.sourceId ?? 'AI_UNKNOWN'),
        source: String(entry?.source ?? 'AI forrás'),
        direction: normalizeDirection(entry?.direction),
        pairs: Array.isArray(entry?.pairs) ? entry.pairs.map((p) => String(p)) : [],
        summary: String(entry?.summary ?? '').trim(),
        keyLevel: String(entry?.keyLevel ?? ''),
        outlook: String(entry?.outlook ?? ''),
        confidence: Number(entry?.confidence ?? 60),
        weight: Number(entry?.weight ?? 1),
        speciality: String(entry?.speciality ?? ''),
        url: String(entry?.url ?? ''),
        originalLanguage: String(entry?.originalLanguage ?? 'en'),
      }))
      .filter((entry) => entry.summary.length > 0)
      .slice(0, 6)
    : [];

  const fallbackNewsUrl = allowedNewsUrls.values().next().value as string | undefined;
  const newsItems = Array.isArray(parsed.newsItems)
    ? parsed.newsItems
      .map((item) => {
        const rawUrl = String(item?.url ?? '');
        const normalizedUrl = allowedNewsUrls.size > 0
          ? (allowedNewsUrls.has(rawUrl) ? rawUrl : (fallbackNewsUrl ?? rawUrl))
          : rawUrl;
        return {
          title: String(item?.title ?? '').trim(),
          source: String(item?.source ?? '').trim(),
          originalLanguage: String(item?.originalLanguage ?? 'en'),
          impact: normalizeImpact(item?.impact),
          pairs: Array.isArray(item?.pairs) ? item.pairs.map((p) => String(p)) : [],
          summary: String(item?.summary ?? '').trim(),
          publishedAt: String(item?.publishedAt ?? new Date().toISOString()),
          url: normalizedUrl,
        };
      })
      .filter((item) => item.title.length > 0 && item.summary.length > 0)
      .slice(0, 8)
    : [];

  const positioning = Array.isArray(parsed.positioning)
    ? parsed.positioning
      .map((entry) => ({
        pair: String(entry?.pair ?? ''),
        longPct: Number(entry?.longPct ?? 50),
        shortPct: Number(entry?.shortPct ?? 50),
        bias: String(entry?.bias ?? 'Vegyes'),
        targetLow: Number(entry?.targetLow ?? 0),
        targetHigh: Number(entry?.targetHigh ?? 0),
        support: Number(entry?.support ?? 0),
        resistance: Number(entry?.resistance ?? 0),
        catalyst48h: String(entry?.catalyst48h ?? ''),
        scenarioBull: String(entry?.scenarioBull ?? ''),
        scenarioBear: String(entry?.scenarioBear ?? ''),
      }))
      .filter((entry) => entry.pair.length > 0)
      .slice(0, 12)
    : [];

  const weightedConclusion: AIAnalysisResult['weightedConclusion'] = {};
  if (parsed.weightedConclusion && typeof parsed.weightedConclusion === 'object') {
    for (const [pair, value] of Object.entries(parsed.weightedConclusion)) {
      if (!value || typeof value !== 'object') continue;
      weightedConclusion[pair] = {
        direction: String((value as { direction?: string }).direction ?? 'neutral'),
        score: Number((value as { score?: number }).score ?? 50),
        summary: String((value as { summary?: string }).summary ?? '').trim(),
      };
    }
  }

  return {
    analyses,
    newsItems,
    positioning,
    weightedConclusion,
    overallSentiment:
      typeof parsed.overallSentiment === 'string' && parsed.overallSentiment.trim().length > 0
        ? parsed.overallSentiment.trim()
        : 'Piaci összefoglaló részben AI-ból származik; hiányos AI válasz esetén egyes elemek sablonosak lehetnek.',
  };
}

function validateAIAnalysisResult(result: AIAnalysisResult): { ok: boolean; reason?: string } {
  if (result.analyses.length < 2) return { ok: false, reason: 'too_few_analyses' };
  if (result.newsItems.length < 2) return { ok: false, reason: 'too_few_news_items' };
  if (Object.keys(result.weightedConclusion).length < 3) return { ok: false, reason: 'missing_weighted_conclusion' };
  if (result.overallSentiment.trim().length < 24) return { ok: false, reason: 'overall_sentiment_too_short' };
  return { ok: true };
}

function normalizeDeepAnalysisResult(parsed: Partial<DeepAnalysisResult>): DeepAnalysisResult {
  const currencies: DeepAnalysisResult['currencies'] = {};
  if (parsed.currencies && typeof parsed.currencies === 'object') {
    for (const [key, value] of Object.entries(parsed.currencies)) {
      if (!value || typeof value !== 'object') continue;
      const trendValue = (value as { trend?: string }).trend;
      const recommendationValue = (value as { recommendation?: string }).recommendation;
      currencies[key] = {
        trend: trendValue === 'up' || trendValue === 'down' || trendValue === 'sideways' ? trendValue : 'sideways',
        support: Number((value as { support?: number }).support ?? 0),
        resistance: Number((value as { resistance?: number }).resistance ?? 0),
        forecast: String((value as { forecast?: string }).forecast ?? '').trim(),
        recommendation:
          recommendationValue === 'buy' || recommendationValue === 'sell' || recommendationValue === 'hold'
            ? recommendationValue
            : 'hold',
        confidence: Number((value as { confidence?: number }).confidence ?? 5),
      };
    }
  }

  return {
    summary: String(parsed.summary ?? '').trim(),
    currencies,
    gold: {
      trend: String(parsed.gold?.trend ?? '').trim(),
      forecast: String(parsed.gold?.forecast ?? '').trim(),
      recommendation: String(parsed.gold?.recommendation ?? '').trim(),
    },
    overallRecommendation: String(parsed.overallRecommendation ?? '').trim(),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map((risk) => String(risk)).filter((risk) => risk.trim().length > 0) : [],
    generatedAt: new Date().toISOString(),
  };
}

function validateDeepAnalysisResult(result: DeepAnalysisResult): { ok: boolean; reason?: string } {
  if (result.summary.length < 20) return { ok: false, reason: 'summary_too_short' };
  if (Object.keys(result.currencies).length < 2) return { ok: false, reason: 'too_few_currencies' };
  if (result.overallRecommendation.length < 20) return { ok: false, reason: 'recommendation_too_short' };
  if (result.risks.length < 1) return { ok: false, reason: 'missing_risks' };
  return { ok: true };
}

async function createMarketAnalysisMessage(
  anthropic: Anthropic,
  prompt: string,
  structured: boolean,
): Promise<Anthropic.Messages.Message> {
  const baseRequest: Anthropic.Messages.MessageCreateParams = {
    model: 'claude-sonnet-4-5-20250929',
    stream: false,
    max_tokens: 3500,
    messages: [{ role: 'user', content: prompt }],
  };
  const request = structured
    ? { ...baseRequest, output_config: { format: { type: 'json_schema' as const, schema: MARKET_ANALYSIS_OUTPUT_SCHEMA } } }
    : baseRequest;
  return anthropic.messages.create(request, { timeout: BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS });
}

async function createDeepAnalysisMessage(
  anthropic: Anthropic,
  prompt: string,
  structured: boolean,
): Promise<Anthropic.Messages.Message> {
  const baseRequest: Anthropic.Messages.MessageCreateParams = {
    model: 'claude-sonnet-4-5-20250929',
    stream: false,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  };
  const request = structured
    ? { ...baseRequest, output_config: { format: { type: 'json_schema' as const, schema: DEEP_ANALYSIS_OUTPUT_SCHEMA } } }
    : baseRequest;
  return anthropic.messages.create(request, { timeout: DEEP_ANALYSIS_REQUEST_TIMEOUT_MS });
}

// RSS fetching REMOVED — news now comes from market-data.service.ts
// (Finnhub + Alpha Vantage + RSS fallback, cached 30 min)

// --- Deep Analysis típusok ---
export interface DeepAnalysisCurrencyDetail {
  trend: 'up' | 'down' | 'sideways';
  support: number;
  resistance: number;
  forecast: string;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
}

export interface DeepAnalysisGold {
  trend: string;
  forecast: string;
  recommendation: string;
}

export interface DeepAnalysisResult {
  summary: string;
  currencies: Record<string, DeepAnalysisCurrencyDetail>;
  gold: DeepAnalysisGold;
  overallRecommendation: string;
  risks: string[];
  generatedAt: string;
}

export interface TrendDataPoint {
  date: string;
  rates: Record<string, number | null>;
}

export async function generateDeepAnalysis(
  rates: RateInfo[],
  trendData: TrendDataPoint[]
): Promise<DeepAnalysisResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const ratesText = rates.map(r =>
    `${r.label}: ${r.rate} (${r.changePercent >= 0 ? '+' : ''}${r.changePercent.toFixed(2)}%)`
  ).join('\n');

  // Trend szöveg generálás
  let trendText = 'Nincs trend adat.';
  if (trendData.length > 1) {
    const currencies = Object.keys(trendData[0].rates);
    trendText = currencies.map(cur => {
      const values = trendData.map(d => d.rates[cur]).filter((v): v is number => v != null);
      if (values.length < 2) return `${cur}: nincs elég adat`;
      const first = values[0];
      const last = values[values.length - 1];
      const change = ((last - first) / first * 100).toFixed(2);
      const trend = last > first ? 'emelkedő' : last < first ? 'csökkenő' : 'oldalazó';
      return `${cur}: ${first.toFixed(2)} → ${last.toFixed(2)} (${change}%, ${trend}) [${trendData.length} nap]`;
    }).join('\n');
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

  const prompt = `Te egy professzionális forex és devizapiaci elemző vagy. Elemezd az alábbi adatokat egy magyar valutaváltó cég igazgatója számára.
A mai dátum: ${dateStr} ${timeStr}.

AKTUÁLIS ÁRFOLYAMOK:
${ratesText}

7 NAPOS TREND:
${trendText}

KÉRLEK ADJ:
1. ÖSSZEFOGLALÓ: Mi történt az elmúlt 24 órában és az elmúlt héten a piacon? (2-3 mondat)
2. EUR/HUF ELEMZÉS: Trend, támasz/ellenállás szintek, rövid távú előrejelzés
3. USD/HUF ELEMZÉS: Ugyanaz
4. GBP/HUF ELEMZÉS: Ugyanaz
5. CHF/HUF ELEMZÉS: Ugyanaz
6. ARANY (XAU): Trend és előrejelzés USD-ben és HUF-ban
7. AJÁNLÁS: Mit tegyen a valutaváltó? Venni vagy eladni? Melyik devizát tartsuk?
8. KOCKÁZATOK: Mire figyeljen a következő napokban?

Válaszolj KIZÁRÓLAG az alábbi JSON formátumban (semmilyen más szöveg ne legyen a JSON előtt vagy után):

{
  "summary": "Összefoglaló 2-3 mondat...",
  "currencies": {
    "EUR_HUF": { "trend": "up|down|sideways", "support": 390.50, "resistance": 398.00, "forecast": "Előrejelzés magyarul...", "recommendation": "buy|sell|hold", "confidence": 7 },
    "USD_HUF": { "trend": "up|down|sideways", "support": 360.00, "resistance": 370.00, "forecast": "...", "recommendation": "buy|sell|hold", "confidence": 6 },
    "GBP_HUF": { "trend": "up|down|sideways", "support": 455.00, "resistance": 470.00, "forecast": "...", "recommendation": "buy|sell|hold", "confidence": 6 },
    "CHF_HUF": { "trend": "up|down|sideways", "support": 410.00, "resistance": 425.00, "forecast": "...", "recommendation": "buy|sell|hold", "confidence": 5 }
  },
  "gold": { "trend": "emelkedő/csökkenő/oldalazó", "forecast": "Arany előrejelzés...", "recommendation": "Ajánlás az aranyra..." },
  "overallRecommendation": "Átfogó ajánlás a valutaváltó cégnek 2-3 mondatban...",
  "risks": ["Kockázat 1", "Kockázat 2", "Kockázat 3"]
}

KÖVETELMÉNYEK:
- confidence: 1-10 skálán
- support/resistance: valós, reális szintek a jelenlegi árfolyam közelében
- Minden szöveg MAGYAR nyelven
- A recommendation mező CSAK "buy", "sell" vagy "hold" lehet
- A trend mező CSAK "up", "down" vagy "sideways" lehet
- Legyél MEGALAPOZOTT és ÓVATOS — ez éles üzleti döntésekhez kell`;

  try {
    logger.info('Deep analysis indítása (Sonnet 4)...');
    const startTime = Date.now();
    let attemptPrompt = prompt;
    let lastValidationReason = 'unknown';
    let lastResponseText = '';

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      const response = await createDeepAnalysisMessage(anthropic, attemptPrompt, attempt === 1);
      const elapsed = Date.now() - startTime;
      logger.info(`Deep analysis attempt ${attempt}/${MAX_GENERATION_ATTEMPTS} (${elapsed}ms, ${response.usage?.input_tokens ?? '?'} input / ${response.usage?.output_tokens ?? '?'} output token)`);

      const text = getTextFromMessage(response);
      lastResponseText = text;

      const stripped = text
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/gi, '');

      const jsonObjectText = extractFirstJsonObject(stripped);
      if (!jsonObjectText) {
        lastValidationReason = 'missing_json_object';
      } else {
        const parsed = parseJsonLenient<Partial<DeepAnalysisResult>>(jsonObjectText);
        if (!parsed) {
          lastValidationReason = 'json_parse_failed';
        } else {
          const result = normalizeDeepAnalysisResult(parsed);
          const validation = validateDeepAnalysisResult(result);
          if (validation.ok) {
            for (const cur of Object.values(result.currencies)) {
              cur.confidence = Math.max(1, Math.min(10, Math.round(cur.confidence)));
            }
            logger.info(`Deep analysis: ${Object.keys(result.currencies).length} deviza, ${result.risks.length} kockázat`);
            return result;
          }
          lastValidationReason = validation.reason ?? 'invalid_structure';
        }
      }

      if (attempt < MAX_GENERATION_ATTEMPTS) {
        logger.warn(`Deep analysis attempt ${attempt} invalid (${lastValidationReason}), retrying with repair prompt`);
        attemptPrompt = `${prompt}

--- JAVÍTÁS ---
Az előző válasz érvénytelen volt (${lastValidationReason}).
Adj KIZÁRÓLAG érvényes JSON objektumot, markdown blokk nélkül.
Kötelező minimum:
- summary minimum 2 mondat
- currencies legalább 2 kulcs (EUR_HUF, USD_HUF legalább)
- overallRecommendation minimum 2 mondat
- risks legalább 2 elem

Az előző (hibás) válasz kivonata:
${lastResponseText.slice(0, 1400)}`;
      }
    }

    logger.error('Deep analysis invalid after retries:', lastValidationReason);
    return null;
  } catch (err) {
    // Timeout vagy rate limit esetén NE retry-olj — úgysem segít
    if (err instanceof Error) {
      const isTimeout = err.message.includes('timeout') || err.message.includes('timed out') || ('status' in err && (err as { status?: number }).status === 408);
      const isRateLimit = 'status' in err && (err as { status?: number }).status === 429;
      if (isTimeout || isRateLimit) {
        logger.warn(`AI elemzés megszakítva (${isTimeout ? 'timeout' : 'rate limit'}), nem retry-olunk`);
        return null;
      }
    }
    logger.error('AI elemzés hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateAIAnalysis(rates: RateInfo[], externalNews?: NewsItemInput[]): Promise<AIAnalysisResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  // Use externally provided news (from market-data.service)
  const newsItems = trimNewsItemsForPrompt(externalNews ?? []);

  const ratesText = rates.map(r =>
    `${r.label}: ${r.rate} (${r.changePercent >= 0 ? '+' : ''}${r.changePercent.toFixed(2)}%)`
  ).join('\n');

  const newsText = newsItems.length > 0
    ? newsItems.map((n, i) => `${i + 1}. [${n.source}] ${n.title} (${n.url})`).join('\n')
    : 'Nincs elérhető RSS hír.';

  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

  const prompt = `Te egy professzionalis deviza- es aranypiaci elemzo vagy egy magyar penzvalto ceg (EBC - Exclusive Best Change) szamara. A mai datum: ${dateStr} ${timeStr}.

=== ELO ARFOLYAMOK ===
${ratesText}

=== FRISS HIREK (RSS forrasokbol) ===
${newsText}

A fenti VALO arfolyamadatok es VALO hirek alapjan keszits RESZLETES piaci elemzest.
Elemezd melyen a hireket, es ertekeld azok hatasat az egyes devizaparokra es az aranyarra.

Ha a rendelkezesre allo adatok nem elegsegesek valamelyik devizapar/arany megiteleseshez, jelezd az elemzesben es adj ovatosabb (semlegesebb) ertekeleseket ott.

FONTOS:
- Minden devizapar HUF-centrikus (magyar forint szemszogbol)
- Az elemzes legyen relevans penzvalto uzleti dontesekhez
- A hirek URL-jeit hasznald a newsItems-ben (a fenti RSS linkek)
- Ha a hirek kozott talalnal relevansat, emeld ki Magas hatassal

Valaszolj KIZAROLAG az alabbi JSON formatumban (semmilyen mas szoveg ne legyen a JSON elott vagy utan):

{
  "analyses": [
    {
      "sourceId": "AI_MACRO",
      "source": "Makrogazdasagi elemzes",
      "direction": "bullish|bearish|neutral",
      "pairs": ["EURUSD", "EURHUF"],
      "summary": "Reszletes elemzes magyarul, 2-3 mondat...",
      "keyLevel": "1.0850 (pivot), 1.0800 (tamasz)",
      "outlook": "Rovid tavu kilatas, 1-2 mondat...",
      "confidence": 70,
      "weight": 1.5,
      "speciality": "Makrogazdasag, jegybanki politika",
      "url": "https://www.ecb.europa.eu/press/pr/html/index.en.html",
      "originalLanguage": "en"
    }
  ],
  "newsItems": [
    {
      "title": "Hir cime magyarul",
      "source": "Forras neve",
      "originalLanguage": "en|hu|de",
      "impact": "Magas|Kozepes|Alacsony",
      "pairs": ["EURUSD"],
      "summary": "Hir osszefoglalasa magyarul, 1-2 mondat...",
      "publishedAt": "${now.toISOString()}",
      "url": "https://..."
    }
  ],
  "positioning": [
    {
      "pair": "EURUSD",
      "longPct": 55,
      "shortPct": 45,
      "bias": "Long|Short|Vegyes",
      "targetLow": 1.0800,
      "targetHigh": 1.0900,
      "support": 1.0780,
      "resistance": 1.0920,
      "catalyst48h": "Kovetkezo 48 ora katalizatora...",
      "scenarioBull": "Bika forgatokonyv leirasa...",
      "scenarioBear": "Medve forgatokonyv leirasa..."
    }
  ],
  "weightedConclusion": {
    "EURUSD": { "direction": "bullish|bearish|neutral", "score": 65, "summary": "Osszegzes magyarul..." },
    "EURHUF": { "direction": "...", "score": 50, "summary": "..." },
    "USDHUF": { "direction": "...", "score": 50, "summary": "..." },
    "GBPHUF": { "direction": "...", "score": 50, "summary": "..." },
    "CHFHUF": { "direction": "...", "score": 50, "summary": "..." },
    "XAUUSD": { "direction": "...", "score": 50, "summary": "..." },
    "XAUEUR": { "direction": "...", "score": 50, "summary": "..." },
    "XAUHUF": { "direction": "...", "score": 50, "summary": "..." }
  },
  "overallSentiment": "Altalanos piaci hangulat osszefoglalasa magyarul, 2-3 mondat, hivatkozva a konkret hirekre..."
}

KOVETELMENYEK:
- 3-5 analyses elem, minosegi megallapitasokkal
- 4-6 newsItems elem (a valos hirek alapjan, valos URL-ekkel)
- Positioning a legfontosabb parokra: ${rates.map(r => r.pair).join(', ')}
- weightedConclusion legalabb a kulcsparokra: EURUSD, EURHUF, USDHUF, GBPHUF, CHFHUF
- score: 0-100 (50=semleges, >60=bullish, <40=bearish)
- Minden szoveg MAGYAR nyelven legyen
- confidence: 40-95 kozott
- A newsItems publishedAt ertekek legyenek realis idopontok az elmult 24 orabol
- Az elemzes legyen MEGALAPOZOTT es OVATOSAN OPTIMISTA/PESSZIMISTA, ne legyen tulzottan egyertelmuen egyik iranyba sem (kiveve ha a hirek egyertelmuen azt mutatjak)`;

  try {
    logger.info(`AI piaci elemzes inditasa (Sonnet 4, ${newsItems.length} hir alapjan)...`);
    const startTime = Date.now();
    let attemptPrompt = prompt;
    let lastValidationReason = 'unknown';
    let lastResponseText = '';
    const allowedNewsUrls = new Set(newsItems.map((item) => item.url).filter(Boolean));

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      const response = await createMarketAnalysisMessage(anthropic, attemptPrompt, attempt === 1 /* structured only on first attempt */);
      const elapsed = Date.now() - startTime;
      logger.info(`AI piaci elemzes attempt ${attempt}/${MAX_GENERATION_ATTEMPTS} (${elapsed}ms, ${response.usage?.input_tokens ?? '?'} input / ${response.usage?.output_tokens ?? '?'} output token)`);

      const text = getTextFromMessage(response);
      lastResponseText = text;

      const stripped = text
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```\s*/gi, '');

      const jsonObjectText = extractFirstJsonObject(stripped);
      if (!jsonObjectText) {
        lastValidationReason = 'missing_json_object';
      } else {
        const parsed = parseJsonLenient<Partial<AIAnalysisResult>>(jsonObjectText);
        if (!parsed) {
          lastValidationReason = 'json_parse_failed';
        } else {
          const result = normalizeAIAnalysisResult(parsed, allowedNewsUrls);
          const validation = validateAIAnalysisResult(result);
          if (validation.ok) {
            // BUG5 FIX: clamp confidence and score values to valid ranges
            result.analyses.forEach(a => {
              a.confidence = Math.max(40, Math.min(95, Math.round(a.confidence)));
            });
            Object.values(result.weightedConclusion).forEach(wc => {
              wc.score = Math.max(0, Math.min(100, Math.round(wc.score)));
            });

            logger.info(`AI elemzes: ${result.analyses.length} elemzes, ${result.newsItems.length} hir, ${result.positioning.length} pozicio`);
            return result;
          }
          lastValidationReason = validation.reason ?? 'invalid_structure';
        }
      }

      if (attempt < MAX_GENERATION_ATTEMPTS) {
        logger.warn(`AI piaci elemzes attempt ${attempt} invalid (${lastValidationReason}), retrying with repair prompt`);
        attemptPrompt = `${prompt}

--- JAVÍTÁS ---
Az előző válasz érvénytelen volt (${lastValidationReason}).
Adj KIZÁRÓLAG érvényes JSON objektumot, markdown blokk nélkül.
Kötelező minimum:
- analyses legalább 3 elem
- newsItems legalább 3 elem, valós URL-ekkel
- weightedConclusion legalább EURUSD, EURHUF, USDHUF kulcsokkal
- overallSentiment legalább 2 mondat

Az előző (hibás) válasz kivonata:
${lastResponseText.slice(0, 1600)}`;
      }
    }

    logger.error('AI piaci elemzes invalid after retries:', lastValidationReason);
    return null;
  } catch (err) {
    // Timeout vagy rate limit esetén NE retry-olj — úgysem segít
    if (err instanceof Error) {
      const isTimeout = err.message.includes('timeout') || err.message.includes('timed out') || ('status' in err && (err as { status?: number }).status === 408);
      const isRateLimit = 'status' in err && (err as { status?: number }).status === 429;
      if (isTimeout || isRateLimit) {
        logger.warn(`AI elemzés megszakítva (${isTimeout ? 'timeout' : 'rate limit'}), nem retry-olunk`);
        return null;
      }
    }
    logger.error('AI elemzés hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}
