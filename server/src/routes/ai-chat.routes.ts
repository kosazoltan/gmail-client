import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { queryOne, queryAll, execute, runInTransactionAsync } from '../db/index.js';
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

// Helper: generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Max conversation history messages to send to Claude
const MAX_HISTORY_MESSAGES = 20;

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
      return res.json({
        reply: 'Az AI asszisztens jelenleg nem elérhető. Kérem ellenőrizze az ANTHROPIC_API_KEY beállítást.',
        conversationId: conversationId || null,
      });
    }

    // Resolve or create conversation
    let activeConversationId = conversationId || null;

    if (activeConversationId) {
      // Verify ownership
      const conv = queryOne<{ id: string }>(
        'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
        [activeConversationId, accountId],
      );
      if (!conv) {
        // Invalid conversationId — create new
        activeConversationId = null;
      }
    }

    const now = Date.now();

    if (!activeConversationId) {
      // Create new conversation with first ~50 chars of message as title
      activeConversationId = generateId();
      const title = message.trim().substring(0, 80) + (message.trim().length > 80 ? '...' : '');
      execute(
        'INSERT INTO ai_conversations (id, account_id, title, context_type, context_data, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [activeConversationId, accountId, title, emailId ? 'email' : null, emailId ? JSON.stringify({ emailId }) : '{}', '[]', now, now],
      );
    }

    // Load conversation history (last MAX_HISTORY_MESSAGES messages)
    const historyRows = queryAll<{ role: string; content: string }>(
      'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [activeConversationId],
    );

    // Take last MAX_HISTORY_MESSAGES
    const recentHistory = historyRows.slice(-MAX_HISTORY_MESSAGES);

    // Build messages array for Claude
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const row of recentHistory) {
      claudeMessages.push({
        role: row.role as 'user' | 'assistant',
        content: row.content,
      });
    }

    // Add current user message
    const userContent = emailContext ? `${message}${emailContext}` : message;
    claudeMessages.push({ role: 'user', content: userContent });

    const systemPrompt = `Te egy intelligens email asszisztens vagy, aki egy magyar cégvezető (90 valutaváltó iroda igazgatója) munkáját segíti. 
Magyarul válaszolj, lényegre törően és professzionálisan.
Ha email kontextust kapsz, használd azt a válaszodban.
Segíts email fogalmazásban, elemzésben, összefoglalásban és szervezésben.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Nem sikerült választ generálni.';

    // Save both messages to ai_messages
    const userMsgId = generateId();
    const assistantMsgId = generateId();
    const msgNow = Date.now();

    execute(
      'INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [userMsgId, activeConversationId, 'user', userContent, msgNow],
    );
    execute(
      'INSERT INTO ai_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [assistantMsgId, activeConversationId, 'assistant', reply, msgNow + 1],
    );

    // Update conversation timestamp
    execute(
      'UPDATE ai_conversations SET updated_at = ? WHERE id = ?',
      [msgNow, activeConversationId],
    );

    res.json({
      reply,
      conversationId: activeConversationId,
    });
  } catch (err) {
    logger.error('AI chat error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: message });
  }
});

// GET /api/ai/conversations — list all conversations for active account
router.get('/conversations', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const conversations = queryAll<{
      id: string;
      title: string;
      updated_at: number;
      created_at: number;
    }>(
      'SELECT id, title, updated_at, created_at FROM ai_conversations WHERE account_id = ? ORDER BY updated_at DESC',
      [accountId],
    );

    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updated_at,
        createdAt: c.created_at,
      })),
    });
  } catch (err) {
    logger.error('List conversations error:', err);
    const msg = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: msg });
  }
});

// GET /api/ai/conversations/:id/messages — get messages for a conversation
router.get('/conversations/:id/messages', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const conv = queryOne<{ id: string }>(
      'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
      [id, accountId],
    );
    if (!conv) {
      return res.status(404).json({ error: 'Beszélgetés nem található' });
    }

    const messages = queryAll<{
      id: string;
      role: string;
      content: string;
      created_at: number;
    }>(
      'SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id],
    );

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
      })),
    });
  } catch (err) {
    logger.error('Get conversation messages error:', err);
    const msg = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/ai/conversations/:id — delete a conversation
router.delete('/conversations/:id', (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const conv = queryOne<{ id: string }>(
      'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
      [id, accountId],
    );
    if (!conv) {
      return res.status(404).json({ error: 'Beszélgetés nem található' });
    }

    // Delete messages first (CASCADE should handle this, but be explicit)
    execute('DELETE FROM ai_messages WHERE conversation_id = ?', [id]);
    execute('DELETE FROM ai_conversations WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (err) {
    logger.error('Delete conversation error:', err);
    const msg = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: msg });
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
