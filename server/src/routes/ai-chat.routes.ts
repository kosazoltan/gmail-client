import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { queryOne, queryAll, execute } from '../db/index.js';
import {
  executeAgentPlan,
  executeConfirmedAction,
  planAgentAction,
  type PendingAgentAction,
} from '../services/ai-agent.service.js';
import { searchEmails } from '../services/ai-agent-tools.service.js';
import logger from '../utils/logger.js';

const router = Router();

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateId(): string {
  return crypto.randomUUID();
}

const MAX_HISTORY_MESSAGES = 20;

async function resolveConversation(accountId: string, conversationId: string | undefined, message: string, emailId?: string) {
  let activeConversationId = conversationId || null;
  if (activeConversationId) {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
      [activeConversationId, accountId],
    );
    if (!existing) {
      activeConversationId = null;
    }
  }

  if (!activeConversationId) {
    const now = Date.now();
    activeConversationId = generateId();
    const title = message.trim().slice(0, 80) + (message.trim().length > 80 ? '...' : '');
    await execute(
      'INSERT INTO ai_conversations (id, account_id, title, context_type, context_data, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [activeConversationId, accountId, title, emailId ? 'email' : null, emailId ? JSON.stringify({ emailId }) : '{}', '[]', now, now],
    );
  }

  return activeConversationId;
}

async function loadConversationHistory(conversationId: string) {
  const historyRows = await queryAll<{ role: string; content: string }>(
    'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId],
  );
  return historyRows.slice(-MAX_HISTORY_MESSAGES).map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
  }));
}

function parseMessageMetadata(raw: string | null | undefined): {
  result?: unknown;
  pendingAction?: PendingAgentAction | null;
} {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as {
      result?: unknown;
      pendingAction?: PendingAgentAction | null;
    };
    return {
      result: parsed.result,
      pendingAction: parsed.pendingAction ?? null,
    };
  } catch {
    return {};
  }
}

async function appendConversationMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: { result?: unknown; pendingAction?: PendingAgentAction | null },
) {
  const now = Date.now();
  await execute(
    'INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [generateId(), conversationId, role, content, metadata ? JSON.stringify(metadata) : null, now],
  );
  await execute('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);
}

async function buildEmailContext(accountId: string, emailId?: string): Promise<string> {
  if (!emailId) return '';
  const email = await queryOne<{
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

  if (!email) return '';
  const bodyText = email.body ? stripHtml(email.body).slice(0, 3000) : email.snippet || '';
  return `Email kontextus:
Tárgy: ${email.subject || '(nincs tárgy)'}
Feladó: ${email.from_name || email.from_email || 'ismeretlen'}
Címzett: ${email.to_email || 'ismeretlen'}
Dátum: ${new Date(email.date).toLocaleString('hu-HU')}
Tartalom: ${bodyText}`;
}

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

    const activeConversationId = await resolveConversation(accountId, conversationId, message, emailId);
    const history = await loadConversationHistory(activeConversationId);
    const emailContext = await buildEmailContext(accountId, emailId);
    const anthropic = getClient();

    const plan = await planAgentAction(anthropic, message.trim(), emailContext);
    const agentResponse = await executeAgentPlan({
      accountId,
      anthropic,
      message: message.trim(),
      plan,
      history,
      emailContext,
    });

    await appendConversationMessage(activeConversationId, 'user', message.trim());
    await appendConversationMessage(activeConversationId, 'assistant', agentResponse.reply, {
      result: agentResponse.result ?? null,
      pendingAction: agentResponse.pendingAction ?? null,
    });

    res.json({
      reply: agentResponse.reply,
      conversationId: activeConversationId,
      result: agentResponse.result ?? null,
      pendingAction: agentResponse.pendingAction ?? null,
    });
  } catch (err) {
    logger.error('AI chat error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: message });
  }
});

router.post('/confirm-action', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { conversationId, pendingAction } = req.body as {
      conversationId?: string;
      pendingAction?: PendingAgentAction;
    };

    if (!pendingAction || typeof pendingAction !== 'object' || typeof pendingAction.toolName !== 'string') {
      return res.status(400).json({ error: 'A pendingAction megadása kötelező' });
    }

    const agentResponse = await executeConfirmedAction({
      accountId,
      pendingAction,
    });

    if (conversationId && typeof conversationId === 'string') {
      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
        [conversationId, accountId],
      );
      if (existing) {
        await appendConversationMessage(conversationId, 'assistant', agentResponse.reply, {
          result: agentResponse.result ?? null,
          pendingAction: null,
        });
      }
    }

    res.json({
      reply: agentResponse.reply,
      result: agentResponse.result ?? null,
    });
  } catch (err) {
    logger.error('AI confirm action error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: message });
  }
});

// GET /api/ai/conversations — list all conversations for active account
router.get('/conversations', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const conversations = await queryAll<{
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
router.get('/conversations/:id/messages', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const conv = await queryOne<{ id: string }>(
      'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
      [id, accountId],
    );
    if (!conv) {
      return res.status(404).json({ error: 'Beszélgetés nem található' });
    }

    const messages = await queryAll<{
      id: string;
      role: string;
      content: string;
      metadata: string | null;
      created_at: number;
    }>(
      'SELECT id, role, content, metadata, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id],
    );

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        ...parseMessageMetadata(m.metadata),
      })),
    });
  } catch (err) {
    logger.error('Get conversation messages error:', err);
    const msg = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/ai/conversations/:id — delete a conversation
router.delete('/conversations/:id', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { id } = req.params;

    // Ownership check
    const conv = await queryOne<{ id: string }>(
      'SELECT id FROM ai_conversations WHERE id = ? AND account_id = ?',
      [id, accountId],
    );
    if (!conv) {
      return res.status(404).json({ error: 'Beszélgetés nem található' });
    }

    // Delete messages first (CASCADE should handle this, but be explicit)
    await execute('DELETE FROM ai_messages WHERE conversation_id = ?', [id]);
    await execute('DELETE FROM ai_conversations WHERE id = ?', [id]);

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

    const searchTerm = query.trim();
    const searchResult = await searchEmails(accountId, { query: searchTerm, limit: 20 });
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
      query: searchTerm,
      interpretation,
      resultCount: searchResult.resultCount,
      emails: searchResult.emails,
    });
  } catch (err) {
    logger.error('Smart search error:', err);
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    res.status(500).json({ error: message });
  }
});

export default router;
