import logger from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import {
  searchContacts,
  getAllContacts,
  deleteContact,
  updateContactName,
  extractContactsFromExistingEmails,
  fixAllNamesEncoding,
} from '../services/contacts.service.js';

const router = Router();

// Kontaktok keresése (autocomplete)
router.get('/search', async (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const query = (req.query.q as string) || '';
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 10), 50);

  if (!query || query.length < 1) {
    return res.json([]);
  }

  const contacts = await searchContacts(accountId, query, limit);
  res.json(contacts);
});

// Összes kontakt lekérése
router.get('/', async (req: Request, res: Response) => {
  try {
    const accountId = req.session.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs aktív fiók' });
    }

    const contacts = await getAllContacts(accountId);
    res.json(contacts);
  } catch (error) {
    logger.error('Kontaktok lekérése hiba:', error);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Kontakt törlése
router.delete('/:id', async (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const contactId = req.params.id as string;
  const success = await deleteContact(accountId, contactId);
  if (!success) {
    return res.status(404).json({ error: 'Kontakt nem található' });
  }

  res.json({ success: true });
});

// Kontakt név frissítése
router.patch('/:id', async (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { name } = req.body;
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'Név megadása kötelező' });
  }

  try {
    const contactId = req.params.id as string;
    const contact = await updateContactName(accountId, contactId, name);
    if (!contact) {
      return res.status(404).json({ error: 'Kontakt nem található' });
    }

    res.json(contact);
  } catch (error) {
    logger.error('Kontakt név frissítési hiba:', error);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Meglévő emailekből kontaktok kinyerése (egyszeri migráció)
router.post('/extract', async (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const count = await extractContactsFromExistingEmails(accountId);
    res.json({ success: true, extractedCount: count });
  } catch (error) {
    logger.error('Kontakt kinyerési hiba:', error);
    res.status(500).json({ error: 'Szerverhiba' });
  }
});

// Karakterkódolás javítása (mojibake fix) - kontaktok, sender_groups és emails
router.post('/fix-encoding', async (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const result = await fixAllNamesEncoding(accountId);
    res.json({
      success: true,
      fixed: result,
      message: `Javítva: ${result.contacts} kontakt, ${result.senderGroups} feladó csoport, ${result.emails} email`,
    });
  } catch (error) {
    logger.error('Karakterkódolás javítási hiba:', error);
    res.status(500).json({ error: 'Karakterkódolás javítása sikertelen' });
  }
});

export default router;

