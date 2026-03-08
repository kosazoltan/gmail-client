import logger from '../utils/logger.js';

// --- Types ---
export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet: string;
}

// --- Cache ---
let cachedArticles: NewsArticle[] | null = null;
let cachedAt = 0;
const NEWS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 perc

// --- RSS Feed sources ---
const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: 'https://news.google.com/rss?hl=hu&gl=HU&ceid=HU:hu', source: 'Google Hírek' },
  { url: 'https://www.portfolio.hu/rss/all.xml', source: 'Portfolio.hu' },
  { url: 'https://feeds.feedburner.com/economx', source: 'Economx' },
];

// --- Simple XML tag extractor (no xml2js dependency) ---
function extractTag(xml: string, tag: string): string {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle normal: <tag>content</tag>
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  if (match) return match[1].trim();

  return '';
}

function extractItems(xml: string): string[] {
  const items: string[] = [];
  const regex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ''); // Strip remaining HTML tags
}

async function fetchFeed(url: string, source: string): Promise<NewsArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ZMail/1.0 RSS Reader',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn(`RSS feed hiba (${source}): HTTP ${resp.status}`);
      return [];
    }

    const xml = await resp.text();
    const items = extractItems(xml);

    return items.slice(0, 10).map((itemXml) => {
      const title = decodeHtmlEntities(extractTag(itemXml, 'title'));
      const link = extractTag(itemXml, 'link');
      const pubDate = extractTag(itemXml, 'pubDate');
      const description = decodeHtmlEntities(extractTag(itemXml, 'description'));

      // Snippet: first 200 chars of description
      const snippet = description.length > 200
        ? description.substring(0, 200) + '...'
        : description;

      return {
        title: title || 'Cím nélkül',
        link: link || '',
        source,
        pubDate: pubDate || new Date().toISOString(),
        snippet: snippet || '',
      };
    }).filter(a => a.title !== 'Cím nélkül' || a.link);
  } catch (err) {
    logger.warn(`RSS feed lekérés sikertelen (${source}):`, err instanceof Error ? err.message : err);
    return [];
  }
}

// --- Public API ---
export async function fetchNews(): Promise<NewsArticle[]> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedArticles && (now - cachedAt) < NEWS_CACHE_TTL_MS) {
    return cachedArticles;
  }

  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    RSS_FEEDS.map(feed => fetchFeed(feed.url, feed.source))
  );

  const articles: NewsArticle[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }

  // Sort by pubDate descending
  articles.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime() || 0;
    const dateB = new Date(b.pubDate).getTime() || 0;
    return dateB - dateA;
  });

  // Limit to 30 articles max
  const trimmed = articles.slice(0, 30);

  // Update cache
  cachedArticles = trimmed;
  cachedAt = now;

  logger.info(`Hírek betöltve: ${trimmed.length} cikk ${RSS_FEEDS.length} forrásból`);
  return trimmed;
}
