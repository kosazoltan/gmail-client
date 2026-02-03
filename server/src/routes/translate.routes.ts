import { Router } from 'express';

const router = Router();

// Simple translation endpoint using LibreTranslate API
// This is a free, open-source translation API
router.post('/', async (req, res) => {
  try {
    const { text, targetLang = 'hu', sourceLang = 'auto' } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    // Use LibreTranslate public instance or your own
    const apiUrl = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';
    const apiKey = process.env.LIBRETRANSLATE_API_KEY || '';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
        api_key: apiKey || undefined,
      }),
    });

    if (!response.ok) {
      // If LibreTranslate fails, try Google Translate scraper (backup)
      const googleResult = await translateWithGoogle(text, targetLang, sourceLang);
      if (googleResult) {
        res.json({
          translatedText: googleResult,
          detectedLanguage: sourceLang === 'auto' ? 'unknown' : sourceLang,
          source: 'google-fallback',
        });
        return;
      }

      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json() as { translatedText?: string; detectedLanguage?: string | { language?: string } };
    // BUG #4 Fix: LibreTranslate returns detectedLanguage as a string, not object
    res.json({
      translatedText: data.translatedText,
      detectedLanguage: typeof data.detectedLanguage === 'string'
        ? data.detectedLanguage
        : (data.detectedLanguage?.language || sourceLang),
      source: 'libretranslate',
    });
  } catch (error) {
    console.error('Translation error:', error);

    // Last resort fallback - try Google Translate
    try {
      const { text, targetLang = 'hu', sourceLang = 'auto' } = req.body;
      const googleResult = await translateWithGoogle(text, targetLang, sourceLang);
      if (googleResult) {
        res.json({
          translatedText: googleResult,
          detectedLanguage: 'unknown',
          source: 'google-fallback',
        });
        return;
      }
    } catch (e) {
      // Ignore fallback errors
    }

    res.status(500).json({ error: 'Translation service unavailable' });
  }
});

// Language detection endpoint
router.post('/detect', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const apiUrl = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/detect';
    const apiKey = process.env.LIBRETRANSLATE_API_KEY || '';

    const response = await fetch(apiUrl.replace('/translate', '/detect'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text.substring(0, 500), // Limit text for detection
        api_key: apiKey || undefined,
      }),
    });

    if (!response.ok) {
      // Simple heuristic fallback
      const detected = detectLanguageSimple(text);
      res.json({ detectedLanguage: detected, confidence: 0.5 });
      return;
    }

    const data = await response.json() as Array<{ language?: string; confidence?: number }>;
    res.json({
      detectedLanguage: data[0]?.language || 'unknown',
      confidence: data[0]?.confidence || 0,
    });
  } catch (error) {
    console.error('Language detection error:', error);
    // Simple heuristic fallback
    const { text } = req.body;
    const detected = detectLanguageSimple(text || '');
    res.json({ detectedLanguage: detected, confidence: 0.3 });
  }
});

// Available languages
router.get('/languages', (_req, res) => {
  // Common languages for email translation
  const languages = [
    { code: 'hu', name: 'Magyar' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'ar', name: 'العربية' },
    { code: 'pl', name: 'Polski' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'cs', name: 'Čeština' },
    { code: 'ro', name: 'Română' },
    { code: 'sk', name: 'Slovenčina' },
    { code: 'uk', name: 'Українська' },
  ];

  res.json({ languages });
});

// Fallback translation using Google Translate (unofficial)
async function translateWithGoogle(text: string, targetLang: string, sourceLang: string): Promise<string | null> {
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

    // FIX: Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    // FIX: Additional validation for nested array structure
    // Google returns nested arrays: [[["translated text", "original text", ...]]]
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && data[0].length > 0) {
      const translated = data[0]
        .filter((item: unknown) => Array.isArray(item) && item.length > 0 && item[0])
        .map((item: unknown[]) => item[0])
        .join('');
      return translated || null;
    }

    return null;
  } catch {
    return null;
  }
}

// Simple language detection heuristic
function detectLanguageSimple(text: string): string {
  // Hungarian specific characters and words
  const hungarianPatterns = /[áéíóöőúüű]|és|hogy|van|nem|egy|vagy|ezt|azt|ami|aki/i;
  // German specific patterns
  const germanPatterns = /[äöüß]|und|der|die|das|ist|nicht|ein|eine/i;
  // French patterns
  const frenchPatterns = /[àâçéèêëîïôùûü]|est|les|des|que|dans|pour|avec/i;
  // Spanish patterns
  const spanishPatterns = /[áéíóúñ¿¡]|que|los|las|del|por|para|está/i;

  if (hungarianPatterns.test(text)) return 'hu';
  if (germanPatterns.test(text)) return 'de';
  if (frenchPatterns.test(text)) return 'fr';
  if (spanishPatterns.test(text)) return 'es';

  // Default to English if can't detect
  return 'en';
}

export default router;
