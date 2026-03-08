import { Router } from 'express';
import { google } from 'googleapis';
import { getOAuth2ClientForAccount } from '../services/auth.service.js';
import logger from '../utils/logger.js';

const router = Router();

// Task listák lekérése
router.get('/lists', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    const response = await tasks.tasklists.list({ maxResults: 100 });

    const lists = (response.data.items || []).map((list) => ({
      id: list.id || '',
      title: list.title || 'Névtelen lista',
      updated: list.updated || null,
    }));

    return res.json({ lists });
  } catch (error) {
    logger.error('Tasks lists error:', error);
    return res.status(500).json({ error: 'Feladat listák lekérése sikertelen' });
  }
});

// Adott lista feladatai
router.get('/list/:listId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { listId } = req.params;
  const showCompleted = req.query.showCompleted !== 'false';
  const showHidden = req.query.showHidden === 'true';

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    const response = await tasks.tasks.list({
      tasklist: listId,
      maxResults: 100,
      showCompleted,
      showHidden,
    });

    const items = (response.data.items || []).map(formatTask);
    return res.json({ tasks: items });
  } catch (error) {
    logger.error('Tasks list items error:', error);
    return res.status(500).json({ error: 'Feladatok lekérése sikertelen' });
  }
});

// Feladat státusz frissítés (complete/uncomplete)
router.patch('/list/:listId/task/:taskId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { listId, taskId } = req.params;
  const { status, title, notes, due } = req.body;

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    const updateData: {
      status?: string;
      title?: string;
      notes?: string;
      due?: string;
      completed?: string | null;
    } = {};

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed = new Date().toISOString();
      } else {
        updateData.completed = null;
      }
    }
    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;
    if (due !== undefined) updateData.due = due;

    const response = await tasks.tasks.patch({
      tasklist: listId,
      task: taskId,
      requestBody: updateData,
    });

    return res.json({ task: response.data ? formatTask(response.data) : null });
  } catch (error) {
    logger.error('Task update error:', error);
    return res.status(500).json({ error: 'Feladat frissítése sikertelen' });
  }
});

// Új feladat létrehozás
router.post('/list/:listId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { listId } = req.params;
  const { title, notes, due } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'A feladat címe kötelező' });
  }

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    const requestBody: { title: string; notes?: string; due?: string } = {
      title: title.trim(),
    };
    if (notes) requestBody.notes = notes;
    if (due) requestBody.due = due;

    const response = await tasks.tasks.insert({
      tasklist: listId,
      requestBody,
    });

    return res.json({ task: response.data ? formatTask(response.data) : null });
  } catch (error) {
    logger.error('Task create error:', error);
    return res.status(500).json({ error: 'Feladat létrehozása sikertelen' });
  }
});

// Feladat törlés
router.delete('/list/:listId/task/:taskId', async (req, res) => {
  const accountId = req.session?.activeAccountId;
  if (!accountId) {
    return res.status(401).json({ error: 'Nincs aktív fiók' });
  }

  const { listId, taskId } = req.params;

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(accountId);
    const tasks = google.tasks({ version: 'v1', auth: oauth2Client });

    await tasks.tasks.delete({
      tasklist: listId,
      task: taskId,
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Task delete error:', error);
    return res.status(500).json({ error: 'Feladat törlése sikertelen' });
  }
});

// Segédfüggvény: Google Task → frontend-barát formátum
function formatTask(task: {
  id?: string | null;
  title?: string | null;
  notes?: string | null;
  status?: string | null;
  due?: string | null;
  completed?: string | null;
  updated?: string | null;
  position?: string | null;
  parent?: string | null;
}) {
  return {
    id: task.id || '',
    title: task.title || '',
    notes: task.notes || null,
    status: task.status || 'needsAction',
    due: task.due || null,
    completed: task.completed || null,
    updated: task.updated || null,
    position: task.position || null,
    parent: task.parent || null,
  };
}

export default router;
