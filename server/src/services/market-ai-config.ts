export interface MarketNewsPromptItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

export const MARKET_AI_TIMEOUT_BUFFER_MS = 10_000;

// Keep SDK request timeout below the route-level fallback timeout,
// otherwise the route can label a still-running request as a timeout prematurely.
export const BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS = 60_000;
export const DEEP_ANALYSIS_REQUEST_TIMEOUT_MS = 60_000;

export const BRIEFING_ROUTE_TIMEOUT_MS =
  BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS + MARKET_AI_TIMEOUT_BUFFER_MS;
export const DEEP_ANALYSIS_ROUTE_TIMEOUT_MS =
  DEEP_ANALYSIS_REQUEST_TIMEOUT_MS + MARKET_AI_TIMEOUT_BUFFER_MS;

export const MARKET_AI_NEWS_LIMIT = 6;

export function trimNewsItemsForPrompt<T extends MarketNewsPromptItem>(items: T[]): T[] {
  return items.slice(0, MARKET_AI_NEWS_LIMIT);
}
