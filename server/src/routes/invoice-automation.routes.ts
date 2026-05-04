import { Router } from 'express';
import { queryOne } from '../db/index.js';
import {
  approveMonthlyInvoiceDistribution,
  getInvoiceAutomationStatusForAccount,
  getInvoiceAutomationAIStatus,
  type InvoiceManualRunMode,
  runInvoiceAutomationForAccountNow,
  verifyInvoiceAutomationAIModelLive,
} from '../services/invoice-automation.service.js';

const router = Router();

function activeAccountId(req: {
  session?: { activeAccountId?: string | null; accountIds?: string[] };
}): string | null {
  const accountId = req.session?.activeAccountId;
  const accountIds = req.session?.accountIds || [];
  if (!accountId || !accountIds.includes(accountId)) return null;
  return accountId;
}

router.get('/ai-status', async (req, res) => {
  try {
    const accountId = activeAccountId(req);
    if (!accountId) return res.status(401).json({ error: 'Nincs bejelentkezve' });

    const status = getInvoiceAutomationAIStatus();
    if (req.query.live === '1' || req.query.live === 'true') {
      const live = await verifyInvoiceAutomationAIModelLive();
      return res.json({ ...status, live });
    }
    return res.json(status);
  } catch (err) {
    return res.status(500).json({
      error: 'AI modell ellenőrzés sikertelen',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const accountId = activeAccountId(req);
    if (!accountId) return res.status(401).json({ error: 'Nincs bejelentkezve' });

    const status = await getInvoiceAutomationStatusForAccount(accountId);
    return res.json(status);
  } catch (err) {
    return res.status(500).json({
      error: 'Számlaautomatizáció státusz lekérdezése sikertelen',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/run', async (req, res) => {
  try {
    const accountId = activeAccountId(req);
    if (!accountId) return res.status(401).json({ error: 'Nincs bejelentkezve' });

    const account = await queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM accounts WHERE id = ?',
      [accountId],
    );
    if (!account) return res.status(404).json({ error: 'Fiók nem található' });

    const mode = String(req.body?.mode || 'daily') as InvoiceManualRunMode;
    if (!['daily', 'previous_month', 'month'].includes(mode)) {
      return res.status(400).json({ error: 'Érvénytelen mode' });
    }
    const monthKey = req.body?.monthKey ? String(req.body.monthKey).trim() : undefined;
    if (mode === 'month' && !/^\d{4}-\d{2}$/.test(monthKey || '')) {
      return res.status(400).json({ error: 'Érvénytelen monthKey (YYYY-MM)' });
    }

    const result = await runInvoiceAutomationForAccountNow(account, { mode, monthKey });
    const status = result.ok ? 200 : 409;
    return res.status(status).json(result);
  } catch (err) {
    return res.status(500).json({
      error: 'Számlaautomatizáció kézi futtatása sikertelen',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/approve', async (req, res) => {
  try {
    const accountId = activeAccountId(req);
    const monthKey = String(req.body?.monthKey || '').trim();

    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Érvénytelen monthKey (YYYY-MM)' });
    }

    await approveMonthlyInvoiceDistribution(accountId, monthKey);
    return res.json({ success: true, accountId, monthKey });
  } catch {
    return res.status(500).json({ error: 'Jóváhagyás mentése sikertelen' });
  }
});

export default router;
