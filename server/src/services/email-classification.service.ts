import Anthropic from '@anthropic-ai/sdk';
import { queryAll, queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const AI_TAGS = ['financial', 'legal', 'attachments', 'urgent', 'newsletter', 'other'] as const;

export async function classifyEmailsBatch(
  accountId: string,
  limit = 50,
): Promise<{ classified: number }> {
  const anthropic = getClient();
  if (!anthropic) {
    logger.warn('Email classification: ANTHROPIC_API_KEY nincs beállítva');
    return { classified: 0 };
  }

  const emails = await queryAll<{ id: string; subject: string | null; snippet: string | null }>(
    `SELECT id, subject, snippet FROM emails
     WHERE account_id = ? AND (ai_tags IS NULL OR ai_tags = '')
     ORDER BY date DESC LIMIT ?`,
    [accountId, limit],
  );

  if (emails.length === 0) return { classified: 0 };

  let classified = 0;
  for (const email of emails) {
    const text = [email.subject || '', email.snippet || ''].filter(Boolean).join('\n');
    if (!text.trim()) continue;

    const tags = await classifySingleEmail(anthropic, text);
    if (tags.length > 0) {
      await execute('UPDATE emails SET ai_tags = ? WHERE id = ? AND account_id = ?', [
        JSON.stringify(tags),
        email.id,
        accountId,
      ]);
      classified++;
    }
  }

  return { classified };
}

async function classifySingleEmail(
  anthropic: InstanceType<typeof Anthropic>,
  text: string,
): Promise<string[]> {
  const truncated = text.slice(0, 2000);
  const prompt = `Az alábbi email tárgya és részlete alapján add meg a kategóriákat. Válaszolj CSAK JSON formátumban, egy tag tömb: ["financial", "legal", "attachments", "urgent", "newsletter", "other"]

Lehetséges tagök: financial (pénzügyi, számla, bank, fizetés), legal (jogi, jogász, compliance, szerződés), attachments (csatolmány említése), urgent (sürgős), newsletter (hírlevél), other (egyéb)

Email:
${truncated}

Példa válasz: ["financial"] vagy ["legal", "urgent"] vagy ["other"]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    const arr = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(arr)) return [];

    return arr
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.toLowerCase())
      .filter((t) => AI_TAGS.includes(t as (typeof AI_TAGS)[number]));
  } catch (err) {
    logger.debug('Email classification single failed:', err);
    return [];
  }
}

export async function getUnclassifiedCount(accountId: string): Promise<number> {
  const r = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM emails
     WHERE account_id = ? AND (ai_tags IS NULL OR ai_tags = '' OR ai_tags = '[]')`,
    [accountId],
  );
  return r?.cnt ?? 0;
}
