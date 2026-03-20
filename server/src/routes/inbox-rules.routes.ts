import { Router } from 'express';
import {
  createInboxRule,
  deleteInboxRule,
  listInboxRules,
  updateInboxRule,
} from '../services/inbox-rules.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });
  const rules = await listInboxRules(accountId);
  return res.json({ rules });
});

router.post('/', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });
  const rule = await createInboxRule(accountId, req.body);
  return res.status(201).json({ rule });
});

router.put('/:id', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });
  const rule = await updateInboxRule(accountId, req.params.id, req.body);
  if (!rule) return res.status(404).json({ error: 'Szabály nem található' });
  return res.json({ rule });
});

router.delete('/:id', async (req, res) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });
  await deleteInboxRule(accountId, req.params.id);
  return res.json({ success: true });
});

export default router;
