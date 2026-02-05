import { Router, Request, Response } from 'express';
import {
  searchContacts,
  getAllContacts,
  deleteContact,
  updateContactName,
  extractContactsFromExistingEmails,
  fixAllNamesEncoding
} from '../services/contacts.service.js';

const router = Router();

// Kontaktok keresése (autocomplete)
router.get('/search', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const query = (req.query.q as string) || '';
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 10), 50);

  if (!query || query.length < 1) {
    return res.json([]);
  }

  const contacts = searchContacts(accountId, query, limit);
  res.json(contacts);
});

// Összes kontakt lekérése
router.get('/', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const contacts = getAllContacts(accountId);
  res.json(contacts);
});

// Kontakt törlése
router.delete('/:id', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const contactId = req.params.id as string;
  const success = deleteContact(accountId, contactId);
  if (!success) {
    return res.status(404).json({ error: 'Kontakt nem található' });
  }

  res.json({ success: true });
});

// Kontakt név frissítése
router.patch('/:id', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { name } = req.body;
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'Név megadása kötelező' });
  }

  const contactId = req.params.id as string;
  const contact = updateContactName(accountId, contactId, name);
  if (!contact) {
    return res.status(404).json({ error: 'Kontakt nem található' });
  }

  res.json(contact);
});

// Meglévő emailekből kontaktok kinyerése (egyszeri migráció)
router.post('/extract', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const count = extractContactsFromExistingEmails(accountId);
  res.json({ success: true, extractedCount: count });
});

// Karakterkódolás javítása (mojibake fix) - kontaktok, sender_groups és emails
router.post('/fix-encoding', (req: Request, res: Response) => {
  const accountId = req.session.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const result = fixAllNamesEncoding(accountId);
    res.json({
      success: true,
      fixed: result,
      message: `Javítva: ${result.contacts} kontakt, ${result.senderGroups} feladó csoport, ${result.emails} email`
    });
  } catch (error) {
    console.error('Karakterkódolás javítási hiba:', error);
    res.status(500).json({ error: 'Karakterkódolás javítása sikertelen' });
  }
});

export default router;
