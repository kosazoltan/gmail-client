import { queryAll, queryOne } from '../db/index.js';
import logger from '../utils/logger.js';

// --- Típusok ---

interface PrioritizedEmail {
  emailId: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  reason: string;
}

interface PendingFollowup {
  emailId: string;
  subject: string;
  from_email: string;
  from_name: string;
  daysSince: number;
  urgency: string;
}

interface ExtractedEvent {
  title: string;
  date: string;
  type: 'meeting' | 'deadline' | 'reminder';
}

interface EmailEvents {
  emailId: string;
  events: ExtractedEvent[];
}

interface ContactScore {
  email: string;
  name: string;
  score: number;
  emailCount: number;
  avgResponseTime: number;
  lastContact: number;
  relationship: 'frequent' | 'regular' | 'occasional' | 'rare';
}

interface EmailHealth {
  unreadCount: number;
  pendingReplies: number;
  avgResponseTime: number;
  oldestUnread: number;
  emailsPerDay: { date: string; count: number }[];
  topSenders: { email: string; name: string; count: number }[];
  categoryDistribution: { name: string; count: number; percentage: number }[];
}

interface SimilarEmail {
  id: string;
  subject: string;
  similarity: number;
}

// SmartFolder type for getSmartFolders (virtual folders, different from smart-folders.service.ts SmartFolder)
interface VirtualSmartFolder {
  name: string;
  query: string;
  count: number;
  icon: string;
}

// --- Segédfüggvények ---

// VIP feladók lekérése
function getVipSenders(accountId: string): Set<string> {
  const vips = queryAll<{ email: string }>(
    'SELECT email FROM vip_senders WHERE account_id = ?',
    [accountId],
  );
  return new Set(vips.map((v) => v.email.toLowerCase()));
}

// Urgency keywords, amelyek magasabb prioritást jeleznek
const URGENT_KEYWORDS = [
  'sürgős', 'urgent', 'asap', 'azonnal', 'deadline', 'határidő',
  'fontos', 'important', 'critical', 'kritikus', 'emergency', 'vészhelyzet',
];

const HIGH_KEYWORDS = [
  'kérlek', 'please', 'action required', 'intézkedés', 'teendő',
  'válaszolj', 'reply needed', 'waiting for', 'várok', 'mielőbb',
];

// Dátum pattern-ek az emailekből
const DATE_PATTERNS = [
  // ISO formátum
  /(\d{4}-\d{2}-\d{2})/g,
  // Magyar dátum: 2026. március 7., 2026.03.07.
  /(\d{4})\.\s*(\w+|\d{2})\.\s*(\d{1,2})\./g,
  // Angol: March 7, 2026
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/gi,
  // Magyar hónapok: március 7.
  /(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)\s+(\d{1,2})\./gi,
];

const MEETING_KEYWORDS = [
  'meeting', 'megbeszélés', 'call', 'hívás', 'zoom', 'teams', 'google meet',
  'találkozó', 'egyeztetés', 'standup', 'sync', 'demo', 'review',
];

const DEADLINE_KEYWORDS = [
  'deadline', 'határidő', 'due date', 'lejárat', 'esedékes', 'due by',
];

const REMINDER_KEYWORDS = [
  'reminder', 'emlékeztető', 'ne felejtsd', "don't forget", 'remind',
];

const HUNGARIAN_MONTHS: Record<string, number> = {
  január: 1, február: 2, március: 3, április: 4, május: 5, június: 6,
  július: 7, augusztus: 8, szeptember: 9, október: 10, november: 11, december: 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function normalizeText(text: string): string {
  return (text || '').toLowerCase().trim();
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalizeText(a).split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(normalizeText(b).split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

// --- Fő szolgáltatás funkciók ---

/**
 * Auto-prioritás — emailek priorizálása szabályok alapján
 */
export function autoPrioritize(
  accountId: string,
  emailIds: string[],
): PrioritizedEmail[] {
  if (emailIds.length === 0) return [];

  const vipSenders = getVipSenders(accountId);

  const placeholders = emailIds.map(() => '?').join(',');
  const emails = queryAll<{
    id: string;
    subject: string;
    from_email: string;
    snippet: string;
    is_read: number;
    is_starred: number;
    date: number;
  }>(
    `SELECT id, subject, from_email, snippet, is_read, is_starred, date
     FROM emails WHERE id IN (${placeholders}) AND account_id = ?`,
    [...emailIds, accountId],
  );

  const now = Date.now();

  return emails.map((email) => {
    let score = 0;
    const reasons: string[] = [];
    const subjectLower = normalizeText(email.subject || '');
    const snippetLower = normalizeText(email.snippet || '');
    const combined = subjectLower + ' ' + snippetLower;

    // VIP feladó → +30
    if (email.from_email && vipSenders.has(email.from_email.toLowerCase())) {
      score += 30;
      reasons.push('VIP feladó');
    }

    // Csillagozott → +20
    if (email.is_starred) {
      score += 20;
      reasons.push('Csillagozott');
    }

    // Olvasatlan → +10
    if (!email.is_read) {
      score += 10;
      reasons.push('Olvasatlan');
    }

    // Sürgős kulcsszavak → +40
    if (URGENT_KEYWORDS.some((kw) => combined.includes(kw))) {
      score += 40;
      reasons.push('Sürgős kulcsszó');
    }

    // Magas prioritás kulcsszavak → +20
    if (HIGH_KEYWORDS.some((kw) => combined.includes(kw))) {
      score += 20;
      reasons.push('Fontos kulcsszó');
    }

    // Frissesség: <1 óra → +15, <24h → +10, <3 nap → +5
    const ageMs = now - email.date;
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 1) {
      score += 15;
      reasons.push('Nagyon friss (<1 óra)');
    } else if (ageHours < 24) {
      score += 10;
      reasons.push('Friss (<24 óra)');
    } else if (ageHours < 72) {
      score += 5;
    }

    // Prioritás szint meghatározása
    let priority: 'urgent' | 'high' | 'normal' | 'low';
    if (score >= 60) {
      priority = 'urgent';
    } else if (score >= 35) {
      priority = 'high';
    } else if (score >= 15) {
      priority = 'normal';
    } else {
      priority = 'low';
    }

    return {
      emailId: email.id,
      priority,
      reason: reasons.length > 0 ? reasons.join(', ') : 'Normál levél',
    };
  });
}

/**
 * Follow-up detekció — kapott emailek amelyekre nem válaszoltunk >2 napja
 */
export function detectPendingFollowups(accountId: string): PendingFollowup[] {
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

  // Bejövő levelek amelyekre nem válaszoltunk:
  // - INBOX label-lel rendelkezik
  // - Nincs kimenő levél ugyanabban a thread-ben, ami későbbi
  // - >2 napja érkezett
  const pendingEmails = queryAll<{
    id: string;
    subject: string;
    from_email: string;
    from_name: string;
    date: number;
    thread_id: string;
  }>(
    `SELECT e.id, e.subject, e.from_email, e.from_name, e.date, e.thread_id
     FROM emails e
     WHERE e.account_id = ?
       AND e.date < ?
       AND e.labels LIKE '%INBOX%'
       AND e.labels NOT LIKE '%SENT%'
       AND e.labels NOT LIKE '%DRAFT%'
       AND e.labels NOT LIKE '%TRASH%'
       AND NOT EXISTS (
         SELECT 1 FROM emails reply
         WHERE reply.account_id = e.account_id
           AND reply.thread_id = e.thread_id
           AND reply.labels LIKE '%SENT%'
           AND reply.date > e.date
       )
     ORDER BY e.date DESC
     LIMIT 50`,
    [accountId, twoDaysAgo],
  );

  const now = Date.now();

  return pendingEmails.map((email) => {
    const daysSince = Math.floor((now - email.date) / (1000 * 60 * 60 * 24));

    let urgency: string;
    if (daysSince >= 7) {
      urgency = 'critical';
    } else if (daysSince >= 5) {
      urgency = 'high';
    } else {
      urgency = 'medium';
    }

    return {
      emailId: email.id,
      subject: email.subject || '(Nincs tárgy)',
      from_email: email.from_email || '',
      from_name: email.from_name || '',
      daysSince,
      urgency,
    };
  });
}

/**
 * Meeting/deadline extraction — emailekből dátumok és események kinyerése
 */
export function extractEventsFromEmails(
  accountId: string,
  emailIds: string[],
): EmailEvents[] {
  if (emailIds.length === 0) return [];

  const placeholders = emailIds.map(() => '?').join(',');
  const emails = queryAll<{
    id: string;
    subject: string;
    body: string;
    snippet: string;
  }>(
    `SELECT id, subject, body, snippet FROM emails
     WHERE id IN (${placeholders}) AND account_id = ?`,
    [...emailIds, accountId],
  );

  return emails.map((email) => {
    const events: ExtractedEvent[] = [];
    const textToSearch = [email.subject, email.snippet, email.body]
      .filter(Boolean)
      .join(' ');
    const textLower = textToSearch.toLowerCase();

    // Dátumok keresése
    const foundDates = new Set<string>();

    // ISO formátum: 2026-03-07
    const isoRegex = /(\d{4}-\d{2}-\d{2})/g;
    let match: RegExpExecArray | null;
    while ((match = isoRegex.exec(textToSearch)) !== null) {
      foundDates.add(match[1]);
    }

    // Magyar formátum: 2026. 03. 07. vagy 2026. március 7.
    const hunDateRegex = /(\d{4})\.\s*(\d{2})\.\s*(\d{1,2})\./g;
    while ((match = hunDateRegex.exec(textToSearch)) !== null) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      foundDates.add(`${y}-${m}-${d}`);
    }

    // Magyar hónapnév: március 7.
    const hunMonthRegex = /(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)\s+(\d{1,2})\./gi;
    while ((match = hunMonthRegex.exec(textToSearch)) !== null) {
      const monthNum = HUNGARIAN_MONTHS[match[1].toLowerCase()];
      if (monthNum) {
        const year = new Date().getFullYear();
        foundDates.add(`${year}-${String(monthNum).padStart(2, '0')}-${match[2].padStart(2, '0')}`);
      }
    }

    // Angol hónapnév: March 7, 2026
    const engMonthRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/gi;
    while ((match = engMonthRegex.exec(textToSearch)) !== null) {
      const monthNum = ENGLISH_MONTHS[match[1].toLowerCase()];
      if (monthNum) {
        foundDates.add(`${match[3]}-${String(monthNum).padStart(2, '0')}-${match[2].padStart(2, '0')}`);
      }
    }

    // Esemény típus meghatározása a szövegkörnyezetből
    for (const dateStr of foundDates) {
      let type: 'meeting' | 'deadline' | 'reminder' = 'reminder';
      let title = email.subject || 'Esemény';

      if (MEETING_KEYWORDS.some((kw) => textLower.includes(kw))) {
        type = 'meeting';
        title = email.subject || 'Megbeszélés';
      } else if (DEADLINE_KEYWORDS.some((kw) => textLower.includes(kw))) {
        type = 'deadline';
        title = email.subject || 'Határidő';
      } else if (REMINDER_KEYWORDS.some((kw) => textLower.includes(kw))) {
        type = 'reminder';
        title = email.subject || 'Emlékeztető';
      }

      events.push({ title, date: dateStr, type });
    }

    return { emailId: email.id, events };
  });
}

/**
 * Contact scoring — kapcsolati háló elemzés
 */
export function scoreContacts(accountId: string): ContactScore[] {
  // Kontaktonkénti statisztika: email szám, utolsó kapcsolat
  const contactStats = queryAll<{
    email: string;
    name: string;
    emailCount: number;
    lastContact: number;
    firstContact: number;
  }>(
    `SELECT
       from_email AS email,
       COALESCE(from_name, from_email) AS name,
       COUNT(*) AS emailCount,
       MAX(date) AS lastContact,
       MIN(date) AS firstContact
     FROM emails
     WHERE account_id = ?
       AND from_email IS NOT NULL
       AND from_email != ''
       AND labels NOT LIKE '%TRASH%'
     GROUP BY LOWER(from_email)
     ORDER BY emailCount DESC
     LIMIT 200`,
    [accountId],
  );

  const now = Date.now();

  // Átlagos válaszidő kiszámítása threadek alapján
  // Egyszerűsített: thread-ben a SENT és nem-SENT üzenetek közötti idő
  const responseTimeData = queryAll<{
    from_email: string;
    avgResp: number;
  }>(
    `SELECT
       e1.from_email,
       AVG(e2.date - e1.date) AS avgResp
     FROM emails e1
     JOIN emails e2 ON e1.thread_id = e2.thread_id
       AND e2.account_id = e1.account_id
       AND e2.labels LIKE '%SENT%'
       AND e2.date > e1.date
     WHERE e1.account_id = ?
       AND e1.labels NOT LIKE '%SENT%'
       AND e1.from_email IS NOT NULL
     GROUP BY LOWER(e1.from_email)`,
    [accountId],
  );

  const responseTimeMap = new Map<string, number>();
  for (const r of responseTimeData) {
    if (r.from_email) {
      responseTimeMap.set(r.from_email.toLowerCase(), r.avgResp);
    }
  }

  return contactStats.map((c) => {
    const emailLower = (c.email || '').toLowerCase();
    const avgResponseTime = responseTimeMap.get(emailLower) || 0;

    // Score kiszámítása: emailCount * recency faktor
    const daysSinceLast = (now - c.lastContact) / (1000 * 60 * 60 * 24);
    const recencyFactor = daysSinceLast < 7 ? 1.5 : daysSinceLast < 30 ? 1.0 : daysSinceLast < 90 ? 0.7 : 0.3;
    const score = Math.round(c.emailCount * recencyFactor * 10) / 10;

    // Relationship típus
    let relationship: 'frequent' | 'regular' | 'occasional' | 'rare';
    if (c.emailCount >= 20 && daysSinceLast < 30) {
      relationship = 'frequent';
    } else if (c.emailCount >= 5 && daysSinceLast < 60) {
      relationship = 'regular';
    } else if (c.emailCount >= 2) {
      relationship = 'occasional';
    } else {
      relationship = 'rare';
    }

    return {
      email: c.email,
      name: c.name || c.email,
      score,
      emailCount: c.emailCount,
      avgResponseTime: Math.round(avgResponseTime),
      lastContact: c.lastContact,
      relationship,
    };
  });
}

/**
 * Email health dashboard — inbox statisztika
 */
export function getEmailHealth(accountId: string): EmailHealth {
  // Olvasatlan levelek
  const unreadResult = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0 AND labels NOT LIKE \'%TRASH%\'',
    [accountId],
  );
  const unreadCount = unreadResult?.count || 0;

  // Válaszra váró levelek (kapott, nincs reply, >24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const pendingResult = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails e
     WHERE e.account_id = ?
       AND e.date < ?
       AND e.labels LIKE '%INBOX%'
       AND e.labels NOT LIKE '%SENT%'
       AND e.labels NOT LIKE '%TRASH%'
       AND NOT EXISTS (
         SELECT 1 FROM emails reply
         WHERE reply.account_id = e.account_id
           AND reply.thread_id = e.thread_id
           AND reply.labels LIKE '%SENT%'
           AND reply.date > e.date
       )`,
    [accountId, oneDayAgo],
  );
  const pendingReplies = pendingResult?.count || 0;

  // Átlagos válaszidő (ms) — saját válaszaink a thread-ekben
  const avgRespResult = queryOne<{ avgResp: number }>(
    `SELECT AVG(sent.date - incoming.date) AS avgResp
     FROM emails sent
     JOIN emails incoming ON sent.thread_id = incoming.thread_id
       AND incoming.account_id = sent.account_id
       AND incoming.labels NOT LIKE '%SENT%'
       AND incoming.date < sent.date
     WHERE sent.account_id = ?
       AND sent.labels LIKE '%SENT%'`,
    [accountId],
  );
  const avgResponseTime = Math.round(avgRespResult?.avgResp || 0);

  // Legrégebbi olvasatlan
  const oldestResult = queryOne<{ oldest: number }>(
    'SELECT MIN(date) as oldest FROM emails WHERE account_id = ? AND is_read = 0 AND labels NOT LIKE \'%TRASH%\'',
    [accountId],
  );
  const oldestUnread = oldestResult?.oldest || 0;

  // Napi email szám (utolsó 30 nap)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const dailyData = queryAll<{ day: string; count: number }>(
    `SELECT
       DATE(date / 1000, 'unixepoch') AS day,
       COUNT(*) AS count
     FROM emails
     WHERE account_id = ? AND date > ? AND labels NOT LIKE '%TRASH%'
     GROUP BY day
     ORDER BY day DESC
     LIMIT 30`,
    [accountId, thirtyDaysAgo],
  );
  const emailsPerDay = dailyData.map((d) => ({ date: d.day, count: d.count }));

  // Top feladók
  const topSendersData = queryAll<{ email: string; name: string; count: number }>(
    `SELECT
       from_email AS email,
       COALESCE(from_name, from_email) AS name,
       COUNT(*) AS count
     FROM emails
     WHERE account_id = ?
       AND from_email IS NOT NULL
       AND labels NOT LIKE '%TRASH%'
     GROUP BY LOWER(from_email)
     ORDER BY count DESC
     LIMIT 10`,
    [accountId],
  );
  const topSenders = topSendersData.map((s) => ({
    email: s.email,
    name: s.name || s.email,
    count: s.count,
  }));

  // Kategória eloszlás
  const totalResult = queryOne<{ total: number }>(
    'SELECT COUNT(*) as total FROM emails WHERE account_id = ? AND labels NOT LIKE \'%TRASH%\'',
    [accountId],
  );
  const totalEmails = totalResult?.total || 1;

  const categoryData = queryAll<{ name: string; count: number }>(
    `SELECT
       COALESCE(c.name, 'Kategorizálatlan') AS name,
       COUNT(*) AS count
     FROM emails e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.account_id = ? AND e.labels NOT LIKE '%TRASH%'
     GROUP BY e.category_id
     ORDER BY count DESC`,
    [accountId],
  );
  const categoryDistribution = categoryData.map((c) => ({
    name: c.name,
    count: c.count,
    percentage: Math.round((c.count / totalEmails) * 1000) / 10,
  }));

  return {
    unreadCount,
    pendingReplies,
    avgResponseTime,
    oldestUnread,
    emailsPerDay,
    topSenders,
    categoryDistribution,
  };
}

/**
 * Duplikáció detekció — hasonló emailek keresése tárgy és feladó alapján
 */
export function findSimilarEmails(
  accountId: string,
  emailId: string,
): SimilarEmail[] {
  // Referencia email lekérése
  const refEmail = queryOne<{
    id: string;
    subject: string;
    from_email: string;
    from_name: string;
  }>(
    'SELECT id, subject, from_email, from_name FROM emails WHERE id = ? AND account_id = ?',
    [emailId, accountId],
  );

  if (!refEmail || !refEmail.subject) return [];

  const normalizedSubject = normalizeText(refEmail.subject);
  // Keresés: hasonló tárgyú levelek (LIKE alapú közelítés)
  const subjectWords = normalizedSubject.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);

  if (subjectWords.length === 0) return [];

  // Az első 3 releváns szóval keresünk
  const likeConditions = subjectWords.map(() => 'LOWER(subject) LIKE ?').join(' AND ');
  const likeParams = subjectWords.map((w) => `%${w}%`);

  const candidates = queryAll<{
    id: string;
    subject: string;
  }>(
    `SELECT id, subject FROM emails
     WHERE account_id = ? AND id != ? AND labels NOT LIKE '%TRASH%'
       AND ${likeConditions}
     LIMIT 20`,
    [accountId, emailId, ...likeParams],
  );

  return candidates
    .map((c) => ({
      id: c.id,
      subject: c.subject || '',
      similarity: Math.round(wordOverlap(refEmail.subject, c.subject || '') * 100) / 100,
    }))
    .filter((c) => c.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);
}

/**
 * Smart folders — virtuális mappák intelligens lekérdezések alapján
 */
export function getSmartFolders(accountId: string): VirtualSmartFolder[] {
  const folders: VirtualSmartFolder[] = [];
  const now = Date.now();

  // 1. Válaszra vár
  const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
  const pendingCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails e
     WHERE e.account_id = ?
       AND e.date < ?
       AND e.labels LIKE '%INBOX%'
       AND e.labels NOT LIKE '%SENT%'
       AND e.labels NOT LIKE '%TRASH%'
       AND NOT EXISTS (
         SELECT 1 FROM emails reply
         WHERE reply.account_id = e.account_id
           AND reply.thread_id = e.thread_id
           AND reply.labels LIKE '%SENT%'
           AND reply.date > e.date
       )`,
    [accountId, twoDaysAgo],
  );
  folders.push({
    name: 'Válaszra vár',
    query: 'is:inbox -is:sent older_than:2d',
    count: pendingCount?.count || 0,
    icon: '⏳',
  });

  // 2. Számlák e hónapban (invoice-related keywords)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const invoiceCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails
     WHERE account_id = ?
       AND date >= ?
       AND labels NOT LIKE '%TRASH%'
       AND (LOWER(subject) LIKE '%számla%' OR LOWER(subject) LIKE '%invoice%'
         OR LOWER(subject) LIKE '%fizetés%' OR LOWER(subject) LIKE '%payment%'
         OR LOWER(subject) LIKE '%receipt%' OR LOWER(subject) LIKE '%nyugta%')`,
    [accountId, startOfMonth.getTime()],
  );
  folders.push({
    name: 'Számlák e hónapban',
    query: 'subject:(számla OR invoice OR fizetés) newer_than:30d',
    count: invoiceCount?.count || 0,
    icon: '🧾',
  });

  // 3. Csatolmányos levelek (utolsó 7 nap)
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const attachmentCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails
     WHERE account_id = ? AND has_attachments = 1 AND date >= ? AND labels NOT LIKE '%TRASH%'`,
    [accountId, weekAgo],
  );
  folders.push({
    name: 'Friss csatolmányok',
    query: 'has:attachment newer_than:7d',
    count: attachmentCount?.count || 0,
    icon: '📎',
  });

  // 4. Olvasatlan levelek
  const unreadCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_read = 0 AND labels NOT LIKE \'%TRASH%\'',
    [accountId],
  );
  folders.push({
    name: 'Olvasatlan',
    query: 'is:unread',
    count: unreadCount?.count || 0,
    icon: '📬',
  });

  // 5. Csillagozott
  const starredCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_starred = 1 AND labels NOT LIKE \'%TRASH%\'',
    [accountId],
  );
  folders.push({
    name: 'Csillagozott',
    query: 'is:starred',
    count: starredCount?.count || 0,
    icon: '⭐',
  });

  // 6. VIP levelek (utolsó 30 nap)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const vipEmails = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM emails e
     JOIN vip_senders v ON LOWER(e.from_email) = LOWER(v.email) AND v.account_id = e.account_id
     WHERE e.account_id = ? AND e.date >= ? AND e.labels NOT LIKE '%TRASH%'`,
    [accountId, thirtyDaysAgo],
  );
  folders.push({
    name: 'VIP levelek',
    query: 'from:vip newer_than:30d',
    count: vipEmails?.count || 0,
    icon: '👑',
  });

  // 7. Mai levelek
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND date >= ? AND labels NOT LIKE \'%TRASH%\'',
    [accountId, startOfToday.getTime()],
  );
  folders.push({
    name: 'Mai levelek',
    query: 'newer_than:1d',
    count: todayCount?.count || 0,
    icon: '📅',
  });

  return folders;
}
