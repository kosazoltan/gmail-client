import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

interface RateInfo {
  pair: string;
  label: string;
  rate: number;
  changePercent: number;
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

export async function generateAIAnalysis(rates: RateInfo[]): Promise<AIAnalysisResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const ratesText = rates.map(r =>
    `${r.label}: ${r.rate} (${r.changePercent >= 0 ? '+' : ''}${r.changePercent.toFixed(2)}%)`
  ).join('\n');

  const now = new Date();
  const dateStr = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

  const prompt = `Te egy professzionalis deviza- es aranypiaci elemzo vagy. A mai datum: ${dateStr} ${timeStr}.

Elo arfolyamok:
${ratesText}

A fenti VALO arfolyamadatok alapjan keszits RESZLETES piaci elemzest MAGYARUL.
Hasznald a tudasod a jelenlegi globalis gazdasagi helyzetrol, jegybanki politikakrol, geopolitikai esemenyekrol.

FONTOS: A devizaparok HUF-centrikusak (magyar forint). Az elemzesnek relevansnak kell lennie egy magyar penzvalto/devizakereskedesi ceg szamara.

Valaszolj KIZAROLAG az alabbi JSON formatumban (semmilyen mas szoveg ne legyen a JSON elott vagy utan):

{
  "analyses": [
    {
      "sourceId": "AI_MACRO",
      "source": "Makrogazdasagi elemzes",
      "direction": "bullish|bearish|neutral",
      "pairs": ["EURUSD", "EURHUF"],
      "summary": "Reszletes elemzes magyarul...",
      "keyLevel": "1.0850 (pivot), 1.0800 (tamasz)",
      "outlook": "Rovid tavu kilatas...",
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
      "originalLanguage": "en",
      "impact": "Magas|Kozepes|Alacsony",
      "pairs": ["EURUSD"],
      "summary": "Hir osszefoglalasa magyarul...",
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
      "scenarioBull": "Bika forgatokonyv...",
      "scenarioBear": "Medve forgatokonyv..."
    }
  ],
  "weightedConclusion": {
    "EURUSD": { "direction": "bullish|bearish|neutral", "score": 65, "summary": "Osszegzes..." },
    "EURHUF": { "direction": "...", "score": 50, "summary": "..." },
    "USDHUF": { "direction": "...", "score": 50, "summary": "..." },
    "GBPHUF": { "direction": "...", "score": 50, "summary": "..." },
    "CHFHUF": { "direction": "...", "score": 50, "summary": "..." },
    "XAUUSD": { "direction": "...", "score": 50, "summary": "..." },
    "XAUEUR": { "direction": "...", "score": 50, "summary": "..." },
    "XAUHUF": { "direction": "...", "score": 50, "summary": "..." }
  },
  "overallSentiment": "Altalanos piaci hangulat osszefoglalasa magyarul, 2-3 mondat..."
}

KOVETELMENYEK:
- Pontosan 5 analyses elem (Makrogazdasag, Technikai elemzes, Geopolitika, Jegybanki politika, Piaci hangulat)
- Pontosan 6 newsItems elem (aktualis, relevans hirek - hasznald a tudasod a mai naprol)
- Positioning minden rates parhoz (${rates.map(r => r.pair).join(', ')})
- weightedConclusion MINDEN parhoz: EURUSD, EURHUF, USDHUF, GBPHUF, CHFHUF, XAUUSD, XAUEUR, XAUHUF
- score: 0-100 (50=semleges, >60=bullish, <40=bearish)
- A hirek URL-jei legyenek VALOS, letező forras-oldalak (pl. reuters.com, portfolio.hu, ecb.europa.eu)
- Minden szoveg MAGYAR nyelven
- confidence: 40-95 kozott
- A newsItems publishedAt ertekek legyenek az elmult 24 oraban`;

  try {
    logger.info('AI piaci elemzes inditasa...');
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const elapsed = Date.now() - startTime;
    logger.info(`AI piaci elemzes kesz (${elapsed}ms)`);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('AI valasz nem tartalmaz JSON-t');
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;

    // Validate basic structure
    if (!result.analyses || !result.newsItems || !result.positioning || !result.weightedConclusion || !result.overallSentiment) {
      logger.error('AI valasz hianyos strukturu');
      return null;
    }

    return result;
  } catch (err) {
    logger.error('AI piaci elemzes hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}
