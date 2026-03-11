import { Router } from 'express';
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  executeWorkflow,
  getWorkflowRuns,
} from '../services/workflow.service.js';
import type { WorkflowStep } from '../services/workflow.service.js';
import logger from '../utils/logger.js';

const router = Router();

// GET /api/workflows — list workflows (account szűrés)
router.get('/', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const workflows = await getWorkflows(accountId);
    res.json({ workflows });
  } catch (error) {
    logger.error('Workflow list error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a workflow-kat' });
  }
});

// POST /api/workflows — create workflow
router.post('/', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { name, description, triggerType, triggerConfig, steps } = req.body as {
      name?: string;
      description?: string | null;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      steps?: WorkflowStep[];
    };

    if (!name || !triggerType) {
      return res.status(400).json({ error: 'A name és triggerType megadása kötelező' });
    }

    if (steps && (!Array.isArray(steps) || steps.some(s => !s.type))) {
      return res.status(400).json({ error: 'Invalid steps format' });
    }

    const workflow = await createWorkflow(
      accountId,
      name,
      description ?? null,
      triggerType,
      triggerConfig ?? {},
      steps ?? [],
    );

    res.status(201).json({ workflow });
  } catch (error) {
    logger.error('Workflow create error:', error);
    res.status(500).json({ error: 'Nem sikerült létrehozni a workflow-t' });
  }
});

// PUT /api/workflows/:id — update workflow
router.put('/:id', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    // Verify ownership
    const existing = await getWorkflow(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Workflow nem található' });
    }

    const { name, description, triggerType, triggerConfig, steps, isActive } = req.body as {
      name?: string;
      description?: string | null;
      triggerType?: string;
      triggerConfig?: Record<string, unknown>;
      steps?: WorkflowStep[];
      isActive?: boolean;
    };

    // Handle isActive toggle separately
    if (isActive !== undefined) {
      await toggleWorkflow(id, isActive);
    }

    const updated = await updateWorkflow(id, {
      name,
      description,
      triggerType,
      triggerConfig,
      steps,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Workflow nem található' });
    }

    res.json({ workflow: updated });
  } catch (error) {
    logger.error('Workflow update error:', error);
    res.status(500).json({ error: 'Nem sikerült frissíteni a workflow-t' });
  }
});

// DELETE /api/workflows/:id
router.delete('/:id', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = await getWorkflow(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Workflow nem található' });
    }

    await deleteWorkflow(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Workflow delete error:', error);
    res.status(500).json({ error: 'Nem sikerült törölni a workflow-t' });
  }
});

// POST /api/workflows/:id/run — kézi futtatás
router.post('/:id/run', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = await getWorkflow(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Workflow nem található' });
    }

    const { triggerEmailId } = req.body as { triggerEmailId?: string };

    const run = await executeWorkflow(id, triggerEmailId);
    if (!run) {
      return res.status(500).json({ error: 'Workflow futtatás sikertelen' });
    }

    res.json(run);
  } catch (error) {
    logger.error('Workflow run error:', error);
    res.status(500).json({ error: 'Nem sikerült futtatni a workflow-t' });
  }
});

// GET /api/workflows/:id/runs — futtatási napló
router.get('/:id/runs', async (req, res) => {
  try {
    const accountId = req.session?.activeAccountId;
    if (!accountId) {
      return res.status(401).json({ error: 'Nincs bejelentkezve' });
    }

    const { id } = req.params;

    const existing = await getWorkflow(id);
    if (!existing || existing.accountId !== accountId) {
      return res.status(404).json({ error: 'Workflow nem található' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await getWorkflowRuns(id, limit);

    res.json({ runs });
  } catch (error) {
    logger.error('Workflow runs fetch error:', error);
    res.status(500).json({ error: 'Nem sikerült lekérni a futtatásokat' });
  }
});

export default router;
