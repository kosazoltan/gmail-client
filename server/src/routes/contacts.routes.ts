import logger from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import {
  addContact,
  deleteContact,
  getContacts,
  getFrequentContacts,
  searchContacts,
} from '../services/contact.service.js';
import { harvestContactsForAccount } from '../services/contact-harvester.service.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });

    const q = req.query.q;
    const query = typeof q === 'string' ? q : undefined;
    const limitStr =
      typeof req.query.limit === 'string' ? req.query.limit : String(req.query.limit || '20');
    const limit = Math.max(1, Math.min(parseInt(limitStr, 10) || 20, 100));

    const contacts = query
      ? await searchContacts(accountId, query, limit)
      : await getContacts(accountId, undefined, limit);

    return res.json(contacts);
  } catch (error) {
    logger.error('Kontaktok lekérése hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

router.get('/frequent', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });

    const limitStr =
      typeof req.query.limit === 'string' ? req.query.limit : String(req.query.limit || '20');
    const limit = Math.max(1, Math.min(parseInt(limitStr, 10) || 20, 100));
    const contacts = await getFrequentContacts(accountId, limit);
    return res.json(contacts);
  } catch (error) {
    logger.error('Gyakori kontaktok lekérése hiba:', error);
    return res.status(500).json({ error: 'Szerverhiba' });
  }
});

router.post('/harvest', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });

    const processed = await harvestContactsForAccount(accountId);
    return res.json({ success: true, processed });
  } catch (error) {
    logger.error('Kontakt harvest hiba:', error);
    return res.status(500).json({ error: 'Kontakt import sikertelen' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });

    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email kötelező' });
    }

    const contact = await addContact(accountId, email, typeof name === 'string' ? name : null);
    return res.status(201).json(contact);
  } catch (error) {
    logger.error('Kontakt hozzáadás hiba:', error);
    return res.status(500).json({ error: 'Kontakt mentése sikertelen' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = await deleteContact(accountId, id);
    if (!success) return res.status(404).json({ error: 'Kontakt nem található' });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Kontakt törlés hiba:', error);
    return res.status(500).json({ error: 'Kontakt törlése sikertelen' });
  }
});

// Legacy endpoint for compatibility
router.get('/search', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) return res.status(401).json({ error: 'Nincs aktív fiók' });
    const query = (req.query.q as string) || '';
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string, 10) || 20, 100));
    const contacts = await searchContacts(accountId, query, limit);
    return res.json(contacts);
  } catch (error) {
    logger.error('Kontakt keresés hiba:', error);
    return res.status(500).json({ error: 'Keresés sikertelen' });
  }
});

export default router;
