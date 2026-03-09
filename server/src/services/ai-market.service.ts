import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

interface RateInfo {
  pair: string;
  label: string;
  rate: number;
  changePercent: number;
}

interface RSSNewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
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

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// --- RSS hírgyűjtés valós forrásokból ---
async function fetchRSSNews(): Promise<RSSNewsItem[]> {
  const feeds = [
    { url: 'https://news.google.com/rss/search?q=EUR+USD+forex+market&hl=en&gl=US&ceid=US:en', source: 'Google News (FX)' },
    { url: 'https://news.google.com/rss/search?q=gold+price+XAU&hl=en&gl=US&ceid=US:en', source: 'Google News (Gold)' },
    { url: 'https://news.google.com/rss/search?q=forint+HUF+Hungary+economy&hl=en&gl=US&ceid=US:en', source: 'Google News (HUF)' },
    { url: 'https://news.google.com/rss/search?q=ECB+Fed+interest+rate&hl=en&gl=US&ceid=US:en', source: 'Google News (CB)' },
    { url: 'https://www.portfolio.hu/rss/all.xml', source: 'Portfolio.hu' },
  ];

  const allItems: RSSNewsItem[] = [];

  await Promise.allSettled(feeds.map(async (feed) => {
    try {
      const controller = new AbortController();
      // BUG1 FIX: timeout covers the FULL fetch + body read (8s total), not just connection
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ZMail-MarketAnalysis/1.0' },
      });

      if (!resp.ok) { clearTimeout(timeout); return; }
      const xml = await resp.text(); // controller still active during body read
      clearTimeout(timeout);         // cancel only after body is fully read

      // Simple RSS XML parsing (no dependency needed)
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xml)) !== null && count < 5) {
        const itemXml = match[1];
        // BUG2 FIX: ([\s\S]*?) instead of (.*?) to handle newlines in CDATA
        const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
        const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '';
        const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '';
        const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);

        if (title && title.length > 10) {
          allItems.push({
            title: decodeHTMLEntities(title),
            source: sourceMatch ? decodeHTMLEntities(sourceMatch[1]) : feed.source,
            url: link,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          });
          count++;
        }
      }
    } catch (err) {
      logger.warn(`RSS lekérés sikertelen (${feed.source}):`, err instanceof Error ? err.message : err);
    }
  }));

  logger.info(`${allItems.length} hír lekérve RSS forrásokból`);
  return allItems;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const elapsed = Date.now() - startTime;
    logger.info(`Deep analysis kész (${elapsed}ms, ${response.usage?.input_tokens ?? '?'} input / ${response.usage?.output_tokens ?? '?'} output token)`);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const stripped = text
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```\s*/gi, '');

    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Deep analysis: AI válasz nem tartalmaz JSON-t:', text.substring(0, 200));
      return null;
    }

    let result: DeepAnalysisResult;
    try {
      result = JSON.parse(jsonMatch[0]) as DeepAnalysisResult;
    } catch (parseErr) {
      logger.error('Deep analysis JSON parse hiba:', parseErr instanceof Error ? parseErr.message : parseErr);
      return null;
    }

    // Validate
    if (!result.summary || !result.currencies || !result.gold || !result.overallRecommendation || !result.risks) {
      logger.error('Deep analysis: hiányos struktúra');
      return null;
    }

    // Clamp confidence
    for (const cur of Object.values(result.currencies)) {
      cur.confidence = Math.max(1, Math.min(10, Math.round(cur.confidence)));
    }

    result.generatedAt = new Date().toISOString();

    logger.info(`Deep analysis: ${Object.keys(result.currencies).length} deviza, ${result.risks.length} kockázat`);
    return result;
  } catch (err) {
    logger.error('Deep analysis hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateAIAnalysis(rates: RateInfo[]): Promise<AIAnalysisResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  // 1. Valós hírek lekérése párhuzamosan
  const newsItems = await fetchRSSNews();

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
- Pontosan 5 analyses elem: Makrogazdasag, Technikai elemzes, Geopolitika, Jegybanki politika, Piaci hangulat/sentiment
- Legalabb 6 newsItems elem (a valos RSS hirek alapjan, magyarra forditva, a valos URL-ekkel)
- Positioning minden rate parhoz: ${rates.map(r => r.pair).join(', ')}
- weightedConclusion MINDEN parhoz: EURUSD, EURHUF, USDHUF, GBPHUF, CHFHUF, XAUUSD, XAUEUR, XAUHUF
- score: 0-100 (50=semleges, >60=bullish, <40=bearish)
- Minden szoveg MAGYAR nyelven legyen
- confidence: 40-95 kozott
- A newsItems publishedAt ertekek legyenek realis idopontok az elmult 24 orabol
- Az elemzes legyen MEGALAPOZOTT es OVATOSAN OPTIMISTA/PESSZIMISTA, ne legyen tulzottan egyertelmuen egyik iranyba sem (kiveve ha a hirek egyertelmuen azt mutatjak)`;

  try {
    logger.info(`AI piaci elemzes inditasa (Sonnet 4, ${newsItems.length} hir alapjan)...`);
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Same model as AI chat (confirmed working)
      max_tokens: 10000,
      messages: [{ role: 'user', content: prompt }],
    });

    const elapsed = Date.now() - startTime;
    logger.info(`AI piaci elemzes kesz (${elapsed}ms, ${response.usage?.input_tokens ?? '?'} input / ${response.usage?.output_tokens ?? '?'} output token)`);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // BUG4 FIX: strip markdown code blocks before JSON extraction
    const stripped = text
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```\s*/gi, '');

    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('AI valasz nem tartalmaz JSON-t:', text.substring(0, 200));
      return null;
    }

    let result: AIAnalysisResult;
    try {
      result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    } catch (parseErr) {
      logger.error('JSON parse hiba az AI valaszban:', parseErr instanceof Error ? parseErr.message : parseErr);
      logger.error('AI valasz (elso 500 karakter):', text.substring(0, 500));
      return null;
    }

    // Validate basic structure
    if (!result.analyses || !result.newsItems || !result.positioning || !result.weightedConclusion || !result.overallSentiment) {
      logger.error('AI valasz hianyos strukturu');
      return null;
    }

    // BUG5 FIX: clamp confidence and score values to valid ranges
    result.analyses.forEach(a => {
      a.confidence = Math.max(40, Math.min(95, Math.round(a.confidence)));
    });
    Object.values(result.weightedConclusion).forEach(wc => {
      wc.score = Math.max(0, Math.min(100, Math.round(wc.score)));
    });

    logger.info(`AI elemzes: ${result.analyses.length} elemzes, ${result.newsItems.length} hir, ${result.positioning.length} pozicio`);
    return result;
  } catch (err) {
    logger.error('AI piaci elemzes hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}
