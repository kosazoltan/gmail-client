import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { queryOne, queryAll } from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Anthropic client (lazy init)
let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Helper: strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { message, conversationId, emailId } = req.body as {
      message?: string;
      conversationId?: string;
      emailId?: string;
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'A message mező kötelező' });
    }

    // Build context from email if emailId is provided
    let emailContext = '';
    if (emailId) {
      const email = queryOne<{
        subject: string | null;
        from_email: string | null;
        from_name: string | null;
        to_email: string | null;
        snippet: string | null;
        body: string | null;
        date: number;
      }>(
        'SELECT subject, from_email, from_name, to_email, snippet, body, date FROM emails WHERE id = ? AND account_id = ?',
        [emailId, accountId],
      );

      if (email) {
        const bodyText = email.body ? stripHtml(email.body).substring(0, 3000) : (email.snippet || '');
        emailContext = `\n\nEmail kontextus:
Tárgy: ${email.subject || '(nincs tárgy)'}
Feladó: ${email.from_name || email.from_email || 'ismeretlen'}
Címzett: ${email.to_email || 'ismeretlen'}
Dátum: ${new Date(email.date).toLocaleString('hu-HU')}
Tartalom: ${bodyText}`;
      }
    }

    const anthropic = getClient();
    if (!anthropic) {
      // Fallback if no API key
      return res.json({
        reply: 'Az AI asszisztens jelenleg nem elérhető. Kérem ellenőrizze az ANTHROPIC_API_KEY beállítást.',
        conversationId: conversationId || null,
      });
    }

    const systemPrompt = `Te egy intelligens email asszisztens vagy, aki egy magyar cégvezető (90 valutaváltó iroda igazgatója) munkáját segíti. 
Magyarul válaszolj, lényegre törően és professzionálisan.
Ha email kontextust kapsz, használd azt a válaszodban.
Segíts email fogalmazásban, elemzésben, összefoglalásban és szervezésben.`;

    const userContent = emailContext
      ? `${message}${emailContext}`
      : message;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Nem sikerült választ generálni.';

    res.json({
      reply,
      conversationId: conversationId || null,
    });
  } catch (err) {
    logger.error('AI chat error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: message });
  }
});

// POST /api/ai/smart-search — AI-powered natural language email search
router.post('/smart-search', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { query, suggestionsOnly } = req.body as {
      query?: string;
      suggestionsOnly?: boolean;
    };

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'A query mező kötelező' });
    }

    const anthropic = getClient();

    if (suggestionsOnly) {
      // Return search suggestions
      if (!anthropic) {
        return res.json({ suggestions: [] });
      }

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `A user is searching their email inbox. They typed: "${query}". Suggest 3 possible refined search queries in Hungarian. Return ONLY a JSON array of strings.`,
          }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
        const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
        const jsonMatch = stripped.match(/\[[\s\S]*\]/);
        const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        return res.json({ suggestions });
      } catch {
        return res.json({ suggestions: [] });
      }
    }

    // Full search — parse query and search emails
    // Simple keyword-based search as fallback (works without AI too)
    const searchTerm = query.trim();
    const emails = queryAll<{ id: string; subject: string; from_email: string; from_name: string; date: number }>(
      `SELECT id, subject, from_email, from_name, date FROM emails
       WHERE account_id = ? AND (
         subject LIKE ? COLLATE NOCASE OR
         from_email LIKE ? COLLATE NOCASE OR
         from_name LIKE ? COLLATE NOCASE OR
         snippet LIKE ? COLLATE NOCASE
       )
       ORDER BY date DESC LIMIT 50`,
      [accountId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
    );

    let interpretation = '';
    if (anthropic) {
      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Briefly explain in Hungarian what this email search query means: "${searchTerm}". One short sentence.`,
          }],
        });
        interpretation = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '';
      } catch {
        // Silent fail
      }
    }

    res.json({
      interpretation,
      resultCount: emails.length,
      emails: emails.slice(0, 20),
    });
  } catch (err) {
    logger.error('Smart search error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: message });
  }
});

export default router;
