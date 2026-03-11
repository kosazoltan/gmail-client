import Anthropic from '@anthropic-ai/sdk';
import { queryAll } from '../db/index.js';
import logger from '../utils/logger.js';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

interface SenderInfo {
  email: string;
  name: string | null;
  messageCount: number;
  lastMessageAt: number | null;
  contactFrequency: number;
}

interface VipSuggestion {
  email: string;
  name: string | null;
  reason: string;
}

export async function suggestVipSenders(accountId: string): Promise<VipSuggestion[]> {
  const anthropic = getClient();
  if (!anthropic) {
    logger.warn('VIP suggestions: ANTHROPIC_API_KEY nincs beállítva');
    return getFallbackSuggestions(accountId);
  }

  const data = await gatherSenderData(accountId);
  if (data.length === 0) {
    return [];
  }

  const existingVips = await queryAll<{ email: string }>(
    'SELECT email FROM vip_senders WHERE account_id = ?',
    [accountId],
  );
  const vipSet = new Set(existingVips.map((v) => v.email.toLowerCase()));

  const candidates = data.filter((s) => !vipSet.has(s.email.toLowerCase()));
  if (candidates.length === 0) {
    return [];
  }

  const lines = candidates
    .slice(0, 60)
    .map(
      (s) =>
        `- ${s.email} | név: ${s.name || '?'} | üzenetek: ${s.messageCount} | kontakt gyakoriság: ${s.contactFrequency} | utolsó: ${s.lastMessageAt ? new Date(s.lastMessageAt).toISOString().slice(0, 10) : '?'}`,
    )
    .join('\n');

  const prompt = `A felhasználó email fiókjának küldői listája (üzenetszám, kontakt használat szerint). A felhasználó VIP küldőket szeretne — olyan személyeket, akiktől fontos azonnal értesítést kapnia (pl. főnök, üzleti partnerek, fontos személyes kapcsolatok).

KÜLDŐ ADATOK:
${lines}

FELADAT: Válaszd ki maximum 15 küldőt, akiket VIPnek javasolsz. Főleg:
- gyakori kapcsolat (sok üzenet)
- nemrég kommunikált (utolsó üzenet)
- valószínűleg fontos (név alapján üzleti/jelentős személy)
- ne legyenek benne: automatikus értesítések, noreply, newsletter, marketing domainek

Válaszolj KIZÁRÓLAG az alábbi JSON formátumban (semmi más szöveg):
{"suggestions":[{"email":"cim@example.com","name":"Név vagy null","reason":"Rövid indoklás magyarul"}]}

- email: pontosan a fenti listából
- name: a fent megadott név vagy null
- reason: 1 mondat magyarul, miért VIP
- maximum 15 elem`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('VIP suggestions: AI válasz nem JSON');
      return getFallbackSuggestions(accountId);
    }

    const parsed = JSON.parse(jsonMatch[0]) as { suggestions?: VipSuggestion[] };
    const list = parsed?.suggestions ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      return getFallbackSuggestions(accountId);
    }

    // Validate: only include emails from our candidate list
    const candidateEmails = new Set(candidates.map((c) => c.email.toLowerCase()));
    const valid = list.filter((s) => s.email && candidateEmails.has(s.email.toLowerCase()));
    return valid.slice(0, 15);
  } catch (err) {
    logger.error('VIP suggestions AI hiba:', err);
    return getFallbackSuggestions(accountId);
  }
}

async function gatherSenderData(accountId: string): Promise<SenderInfo[]> {
  const senders = await queryAll<{
    email: string;
    name: string | null;
    message_count: number;
    last_message_at: number | null;
  }>(
    `SELECT email, name, message_count, last_message_at
     FROM sender_groups
     WHERE account_id = ? AND email IS NOT NULL AND email != ''
     ORDER BY message_count DESC, last_message_at DESC
     LIMIT 80`,
    [accountId],
  );

  const contacts = await queryAll<{ email: string; frequency: number }>(
    'SELECT email, frequency FROM contacts WHERE account_id = ?',
    [accountId],
  );
  const contactMap = new Map(contacts.map((c) => [c.email.toLowerCase(), c.frequency]));

  return senders.map((s) => ({
    email: s.email,
    name: s.name,
    messageCount: s.message_count,
    lastMessageAt: s.last_message_at,
    contactFrequency: contactMap.get(s.email.toLowerCase()) ?? 0,
  }));
}

async function getFallbackSuggestions(accountId: string): Promise<VipSuggestion[]> {
  const senders = await queryAll<{
    email: string;
    name: string | null;
    message_count: number;
  }>(
    `SELECT email, name, message_count
     FROM sender_groups
     WHERE account_id = ? AND email IS NOT NULL AND email != ''
     ORDER BY message_count DESC
     LIMIT 15`,
    [accountId],
  );

  const existingVips = await queryAll<{ email: string }>(
    'SELECT email FROM vip_senders WHERE account_id = ?',
    [accountId],
  );
  const vipSet = new Set(existingVips.map((v) => v.email.toLowerCase()));

  const filtered = senders.filter((s) => !vipSet.has(s.email.toLowerCase()));

  return filtered
    .filter((s) => {
      const email = s.email.toLowerCase();
      return (
        !email.includes('noreply') &&
        !email.includes('no-reply') &&
        !email.includes('mailer-daemon') &&
        !email.endsWith('@google.com') &&
        !email.endsWith('@github.com')
      );
    })
    .slice(0, 10)
    .map((s) => ({
      email: s.email,
      name: s.name,
      reason: `${s.message_count} üzenet a feladótól`,
    }));
}
