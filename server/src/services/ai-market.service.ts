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
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ZMail-MarketAnalysis/1.0' },
      });
      clearTimeout(timeout);

      if (!resp.ok) return;
      const xml = await resp.text();

      // Simple RSS XML parsing (no dependency needed)
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xml)) !== null && count < 5) {
        const itemXml = match[1];
        const title = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? '';
        const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
        const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10000,
      messages: [{ role: 'user', content: prompt }],
    });

    const elapsed = Date.now() - startTime;
    logger.info(`AI piaci elemzes kesz (${elapsed}ms, ${response.usage?.input_tokens ?? '?'} input / ${response.usage?.output_tokens ?? '?'} output token)`);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('AI valasz nem tartalmaz JSON-t:', text.substring(0, 200));
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;

    // Validate basic structure
    if (!result.analyses || !result.newsItems || !result.positioning || !result.weightedConclusion || !result.overallSentiment) {
      logger.error('AI valasz hianyos strukturu');
      return null;
    }

    logger.info(`AI elemzes: ${result.analyses.length} elemzes, ${result.newsItems.length} hir, ${result.positioning.length} pozicio`);
    return result;
  } catch (err) {
    logger.error('AI piaci elemzes hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}
