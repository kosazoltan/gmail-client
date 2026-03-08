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

const CRYPTOCOMPARE_URL =
  'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH&tsyms=USD,EUR,HUF';

// --- Fetch from CoinGecko (primary) ---
async function fetchFromCoinGecko(): Promise<CryptoPrices | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(COINGECKO_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZMail/1.0 (https://mail.mindenes.org)',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn(`CoinGecko API hiba: HTTP ${resp.status}`);
      return null;
    }

    const data = await resp.json() as Record<string, Record<string, number>>;

    return {
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
  } catch (err) {
    clearTimeout(timeout);
    logger.warn('CoinGecko API hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Fetch from CryptoCompare (fallback) ---
async function fetchFromCryptoCompare(): Promise<CryptoPrices | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(CRYPTOCOMPARE_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ZMail/1.0 (https://mail.mindenes.org)',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn(`CryptoCompare API hiba: HTTP ${resp.status}`);
      return null;
    }

    const data = await resp.json() as Record<string, Record<string, number>>;

    return {
      bitcoin: {
        usd: data.BTC?.USD ?? 0,
        eur: data.BTC?.EUR ?? 0,
        huf: data.BTC?.HUF ?? 0,
      },
      ethereum: {
        usd: data.ETH?.USD ?? 0,
        eur: data.ETH?.EUR ?? 0,
        huf: data.ETH?.HUF ?? 0,
      },
    };
  } catch (err) {
    clearTimeout(timeout);
    logger.warn('CryptoCompare API hiba:', err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Public API ---
export async function fetchCryptoPrices(): Promise<CryptoPrices> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedPrices && (now - cachedAt) < CRYPTO_CACHE_TTL_MS) {
    return cachedPrices;
  }

  // Try CoinGecko first, then CryptoCompare fallback
  let prices = await fetchFromCoinGecko();

  if (!prices) {
    logger.info('CoinGecko sikertelen, CryptoCompare fallback...');
    prices = await fetchFromCryptoCompare();
  }

  if (prices) {
    // Validate: ensure we got real non-zero data
    if (prices.bitcoin.usd > 0 && prices.ethereum.usd > 0) {
      cachedPrices = prices;
      cachedAt = now;
      logger.info(
        `Crypto árfolyamok betöltve: BTC $${prices.bitcoin.usd.toLocaleString()}, ETH $${prices.ethereum.usd.toLocaleString()}`
      );
      return prices;
    }
    logger.warn('Crypto API válasz nulla árfolyamokat tartalmazott');
  }

  // Return stale cache if available
  if (cachedPrices) {
    logger.info('Crypto: gyorsítótárazott adatok használata');
    return cachedPrices;
  }

  // No cache, no data — return zeros
  return {
    bitcoin: { usd: 0, eur: 0, huf: 0 },
    ethereum: { usd: 0, eur: 0, huf: 0 },
  };
}
