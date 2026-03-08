import logger from '../utils/logger.js';

// --- Types ---
export interface CryptoPriceData {
  usd: number;
  eur: number;
  huf: number;
}

export interface CryptoPrices {
  bitcoin: CryptoPriceData;
  ethereum: CryptoPriceData;
}

// --- Cache ---
let cachedPrices: CryptoPrices | null = null;
let cachedAt = 0;
const CRYPTO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 perc

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,eur,huf';

// --- Public API ---
export async function fetchCryptoPrices(): Promise<CryptoPrices> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedPrices && (now - cachedAt) < CRYPTO_CACHE_TTL_MS) {
    return cachedPrices;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(COINGECKO_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn(`CoinGecko API hiba: HTTP ${resp.status}`);
      if (cachedPrices) return cachedPrices; // stale cache fallback
      throw new Error(`CoinGecko API HTTP ${resp.status}`);
    }

    const data = await resp.json() as Record<string, Record<string, number>>;

    const prices: CryptoPrices = {
      bitcoin: {
        usd: data.bitcoin?.usd ?? 0,
        eur: data.bitcoin?.eur ?? 0,
        huf: data.bitcoin?.huf ?? 0,
      },
      ethereum: {
        usd: data.ethereum?.usd ?? 0,
        eur: data.ethereum?.eur ?? 0,
        huf: data.ethereum?.huf ?? 0,
      },
    };

    // Update cache
    cachedPrices = prices;
    cachedAt = now;

    logger.info(
      `Crypto árfolyamok betöltve: BTC $${prices.bitcoin.usd.toLocaleString()}, ETH $${prices.ethereum.usd.toLocaleString()}`
    );

    return prices;
  } catch (err) {
    logger.warn('CoinGecko API hiba:', err instanceof Error ? err.message : err);

    // Return stale cache if available
    if (cachedPrices) {
      logger.info('CoinGecko: gyorsítótárazott adatok használata');
      return cachedPrices;
    }

    // No cache, no data — return zeros
    return {
      bitcoin: { usd: 0, eur: 0, huf: 0 },
      ethereum: { usd: 0, eur: 0, huf: 0 },
    };
  }
}
