/**
 * RFC 2047 (encoded-word) és címlista feldolgozás — tárgy, feladó/címzett nevek, UTF-8/kelet-európai kódolások.
 */
import iconv from 'iconv-lite';
import logger from './logger.js';

/** RFC 2047: az encoded-wordök közötti lineáris whitespace nem jelenik meg (összefűzés). */
function collapseEncodedWordWhitespace(text: string): string {
  return text.replace(/(\?=)[ \t\r\n]+(?==\?)/g, '$1');
}

function decodeBytesWithIconvVariants(decoded: Buffer, charset: string): string {
  const variants = Array.from(
    new Set(
      [
        charset,
        charset.toLowerCase(),
        charset.replace(/_/g, '-'),
        charset.toLowerCase().replace(/_/g, '-'),
      ].filter(Boolean),
    ),
  );

  for (const c of variants) {
    try {
      if (iconv.encodingExists(c)) {
        return iconv.decode(decoded, c);
      }
    } catch {
      /* próbáljuk a következő változatot */
    }
  }

  const lowerCharset = charset.toLowerCase().replace(/[_-]/g, '');

  if (lowerCharset === 'utf8') {
    return decoded.toString('utf-8');
  }
  if (
    lowerCharset === 'iso88591' ||
    lowerCharset === 'latin1' ||
    lowerCharset === 'usascii' ||
    lowerCharset === 'ascii'
  ) {
    return decoded.toString('latin1');
  }
  if (lowerCharset === 'iso88592' || lowerCharset === 'latin2') {
    return iconv.decode(decoded, 'iso-8859-2');
  }
  if (lowerCharset === 'windows1250' || lowerCharset === 'cp1250' || lowerCharset === 'xcp1250') {
    return iconv.decode(decoded, 'windows-1250');
  }
  if (lowerCharset === 'windows1252' || lowerCharset === 'cp1252' || lowerCharset === 'xcp1252') {
    return iconv.decode(decoded, 'windows-1252');
  }
  if (lowerCharset === 'iso885915' || lowerCharset === 'latin9') {
    return iconv.decode(decoded, 'iso-8859-15');
  }
  if (lowerCharset === 'koi8r') {
    return iconv.decode(decoded, 'koi8-r');
  }
  if (lowerCharset === 'windows1251' || lowerCharset === 'cp1251') {
    return iconv.decode(decoded, 'windows-1251');
  }

  return decoded.toString('utf-8');
}

/**
 * MIME encoded-word (=?charset?B|Q?...?=) dekódolása fejlécekhez (Subject, From, fájlnév, stb.).
 */
export function decodeRFC2047(text: string): string {
  if (!text) return text;

  const input = collapseEncodedWordWhitespace(text);
  const encodedWordPattern = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

  return input.replace(encodedWordPattern, (match, charset, encoding, encodedText) => {
    try {
      const upperEncoding = String(encoding).toUpperCase();
      let decoded: Buffer;

      if (upperEncoding === 'B') {
        let b64 = String(encodedText).replace(/\s+/g, '');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        decoded = Buffer.from(b64, 'base64');
      } else if (upperEncoding === 'Q') {
        const normalized = String(encodedText).replace(/_/g, ' ');
        const bytes: number[] = [];
        let i = 0;
        while (i < normalized.length) {
          if (normalized[i] === '=' && i + 2 < normalized.length) {
            const hex = normalized.substring(i + 1, i + 3);
            const byte = parseInt(hex, 16);
            if (!Number.isNaN(byte)) {
              bytes.push(byte);
              i += 3;
              continue;
            }
          }
          bytes.push(normalized.charCodeAt(i));
          i++;
        }
        decoded = Buffer.from(bytes);
      } else {
        return match;
      }

      return decodeBytesWithIconvVariants(decoded, String(charset).trim());
    } catch (err) {
      logger.warn('RFC2047 decode failed', { match, error: err });
      return match;
    }
  });
}

/**
 * Címlista szétválasztása vesszőknél, idézőjelek és <…> között figyelve (RFC 5322 egyszerűsített).
 */
export function splitRfc5322AddressList(list: string): string[] {
  const out: string[] = [];
  let inQuotes = false;
  let angle = 0;
  let cur = '';
  const s = list;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== '\\') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === '<') {
      angle++;
    } else if (!inQuotes && c === '>') {
      angle = Math.max(0, angle - 1);
    } else if (!inQuotes && angle === 0 && c === ',') {
      const t = cur.trim();
      if (t) out.push(t);
      cur = '';
      continue;
    }
    cur += c;
  }
  const t = cur.trim();
  if (t) out.push(t);
  return out;
}

export interface ParsedMailbox {
  email: string;
  name: string | null;
}

/**
 * To/Cc/Bcc sor feldolgozása: RFC 2047 + „Név <email>” / sima email.
 */
export function parseEmailAddressesFromHeader(addressString: string): ParsedMailbox[] {
  const results: ParsedMailbox[] = [];
  if (!addressString?.trim()) return results;

  const parts = splitRfc5322AddressList(addressString);
  for (const part of parts) {
    const decoded = decodeRFC2047(part.trim());
    const match = decoded.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      const rawName = match[1].replace(/^["']|["']$/g, '').trim();
      results.push({
        name: rawName || null,
        email: match[2].trim(),
      });
    } else if (decoded.includes('@')) {
      results.push({ name: null, email: decoded.trim() });
    }
  }

  return results;
}
