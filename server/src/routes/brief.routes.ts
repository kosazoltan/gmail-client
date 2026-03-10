import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryAll, queryOne, execute } from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Generate AI summary of today's emails using Anthropic
async function generateAISummary(accountId: string): Promise<{
  summary: string;
  highlights: string[];
  actionItemsCount: number;
  urgentCount: number;
  totalEmails: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  // Get today's emails
  const emails = await queryAll<{
    subject: string | null;
    from_email: string | null;
    from_name: string | null;
    snippet: string | null;
    is_read: number;
    date: number;
  }>(
    `SELECT subject, from_email, from_name, snippet, is_read, date
     FROM emails
     WHERE account_id = ? AND date >= ? AND labels NOT LIKE '%TRASH%'
     ORDER BY date DESC
     LIMIT 50`,
    [accountId, todayMs],
  );

  if (emails.length === 0) {
    return {
      summary: 'Ma még nem érkezett email.',
      highlights: [],
      actionItemsCount: 0,
      urgentCount: 0,
      totalEmails: 0,
    };
  }

  const unreadCount = emails.filter((e) => !e.is_read).length;

  // Build a concise summary of emails for AI
  const emailSummaries = emails
    .slice(0, 30)
    .map((e) => {
      const sender = e.from_name || e.from_email || 'Ismeretlen';
      const subj = e.subject || '(nincs tárgy)';
      const status = e.is_read ? '' : '[OLVASATLAN] ';
      return `${status}${sender}: ${subj}${e.snippet ? ` — ${e.snippet.substring(0, 80)}` : ''}`;
    })
    .join('\n');

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20250401',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Az alábbiakban a mai emailek listája. Készíts rövid magyar nyelvű összefoglalót (max 3-4 mondat), emeld ki a legfontosabb 2-3 tételt, és add meg hány sürgős email van.

Mai emailek (${emails.length} db, ${unreadCount} olvasatlan):
${emailSummaries}

Válaszolj JSON formátumban:
{
  "summary": "rövid összefoglaló szöveg",
  "highlights": ["fontos pont 1", "fontos pont 2"],
  "urgentCount": 0
}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: parsed.summary || 'Összefoglaló nem elérhető.',
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            actionItemsCount: parsed.actionItemsCount || 0,
            urgentCount: parsed.urgentCount || 0,
            totalEmails: emails.length,
          };
        }
      } catch {
        return {
          summary: textContent.text.substring(0, 500),
          highlights: [],
          actionItemsCount: 0,
          urgentCount: unreadCount > 5 ? Math.floor(unreadCount / 3) : 0,
          totalEmails: emails.length,
        };
      }
    }
  } catch (err) {
    logger.error('AI brief generation failed:', err);
  }

  // Fallback without AI
  return {
    summary: `Ma ${emails.length} email érkezett, ebből ${unreadCount} olvasatlan.`,
    highlights: emails
      .filter((e) => !e.is_read)
      .slice(0, 3)
      .map((e) => `${e.from_name || e.from_email}: ${e.subject || '(nincs tárgy)'}`),
    actionItemsCount: 0,
    urgentCount: 0,
    totalEmails: emails.length,
  };
}

// POST /api/brief/generate — Generate (or refresh) today's brief
router.post('/generate', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    const accountIds = req.session?.accountIds || [];

    if (!accountId || !accountIds.includes(accountId)) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const result = await generateAISummary(accountId);

    const id = uuid();
    const now = Date.now();

    await execute(
      `INSERT INTO daily_briefs (id, account_id, date, summary, highlights, action_items_count, urgent_count, total_emails, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, date) DO UPDATE SET
         summary = excluded.summary,
         highlights = excluded.highlights,
         action_items_count = excluded.action_items_count,
         urgent_count = excluded.urgent_count,
         total_emails = excluded.total_emails,
         generated_at = excluded.generated_at`,
      [id, accountId, today, result.summary, JSON.stringify(result.highlights), result.actionItemsCount, result.urgentCount, result.totalEmails, now],
    );

    return res.json({
      success: true,
      brief: {
        date: today,
        summary: result.summary,
        highlights: result.highlights,
        actionItemsCount: result.actionItemsCount,
        urgentCount: result.urgentCount,
        totalEmails: result.totalEmails,
        generatedAt: now,
      },
    });
  } catch (err) {
    logger.error('Brief generate error:', err);
    return res.status(500).json({ error: 'Brief generálás sikertelen' });
  }
});

// GET /api/brief/latest — Get the latest brief for the current account
router.get('/latest', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    const accountIds = req.session?.accountIds || [];

    if (!accountId || !accountIds.includes(accountId)) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const brief = await queryOne<{
      date: string;
      summary: string;
      highlights: string;
      action_items_count: number;
      urgent_count: number;
      total_emails: number;
      generated_at: number;
    }>(
      'SELECT date, summary, highlights, action_items_count, urgent_count, total_emails, generated_at FROM daily_briefs WHERE account_id = ? ORDER BY date DESC LIMIT 1',
      [accountId],
    );

    if (!brief) {
      return res.json({ brief: null });
    }

    let highlights: string[] = [];
    try {
      highlights = JSON.parse(brief.highlights || '[]');
    } catch {
      highlights = [];
    }

    const today = new Date().toISOString().slice(0, 10);
    const isFresh = brief.date === today;

    res.json({
      brief: {
        date: brief.date,
        summary: brief.summary,
        highlights,
        actionItemsCount: brief.action_items_count,
        urgentCount: brief.urgent_count,
        totalEmails: brief.total_emails,
        generatedAt: brief.generated_at,
        isFresh,
      },
    });
  } catch (err) {
    logger.error('Brief latest error:', err);
    res.status(500).json({ error: 'Brief lekérése sikertelen' });
  }
});

export default router;
export { generateAISummary };
