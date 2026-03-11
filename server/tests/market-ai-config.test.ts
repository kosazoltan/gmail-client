import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS,
  BRIEFING_ROUTE_TIMEOUT_MS,
  DEEP_ANALYSIS_REQUEST_TIMEOUT_MS,
  DEEP_ANALYSIS_ROUTE_TIMEOUT_MS,
  MARKET_AI_TIMEOUT_BUFFER_MS,
  MARKET_AI_NEWS_LIMIT,
  trimNewsItemsForPrompt,
} from '../src/services/market-ai-config.ts';

test('route-level market AI timeouts allow service request timeout plus buffer', () => {
  assert.equal(
    BRIEFING_ROUTE_TIMEOUT_MS,
    BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS + MARKET_AI_TIMEOUT_BUFFER_MS,
  );
  assert.equal(
    DEEP_ANALYSIS_ROUTE_TIMEOUT_MS,
    DEEP_ANALYSIS_REQUEST_TIMEOUT_MS + MARKET_AI_TIMEOUT_BUFFER_MS,
  );
  assert.ok(BRIEFING_ROUTE_TIMEOUT_MS > BRIEFING_ANALYSIS_REQUEST_TIMEOUT_MS);
  assert.ok(DEEP_ANALYSIS_ROUTE_TIMEOUT_MS > DEEP_ANALYSIS_REQUEST_TIMEOUT_MS);
});

test('market AI prompt trims news payload to a bounded size', () => {
  const news = Array.from({ length: MARKET_AI_NEWS_LIMIT + 4 }, (_, index) => ({
    title: `News ${index + 1}`,
    source: 'Test',
    url: `https://example.com/${index + 1}`,
    publishedAt: new Date(2026, 0, index + 1).toISOString(),
    summary: `Summary ${index + 1}`,
  }));

  const trimmed = trimNewsItemsForPrompt(news);

  assert.equal(trimmed.length, MARKET_AI_NEWS_LIMIT);
  assert.deepEqual(
    trimmed.map((item) => item.title),
    news.slice(0, MARKET_AI_NEWS_LIMIT).map((item) => item.title),
  );
});
