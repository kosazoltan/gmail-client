import { Router } from 'express';
import { approveMonthlyInvoiceDistribution } from '../services/invoice-automation.service.js';

const router = Router();

router.post('/approve', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    const accountIds = req.session?.accountIds || [];
    const monthKey = String(req.body?.monthKey || '').trim();

    if (!accountId || !accountIds.includes(accountId)) {
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
