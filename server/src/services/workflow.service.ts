/**
 * Workflow service — CRUD operations, execution engine, and preset workflows.
 * Step implementations: workflow-steps.ts
 * Types: workflow-types.ts
 * Utils: workflow-utils.ts
 */
import { queryAll, queryOne, execute } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import logger from '../utils/logger.js';

// Re-export types for backward compatibility
export type {
  WorkflowStep,
  Workflow,
  WorkflowRun,
  WorkflowRow,
  WorkflowRunRow,
  EmailRow,
  StepContext,
  StepResult,
} from './workflow-types.js';

import type {
  Workflow,
  WorkflowStep,
  WorkflowRun,
  WorkflowRow,
  WorkflowRunRow,
  EmailRow,
  StepContext,
} from './workflow-types.js';

import {
  normalizeScheduleConfig,
  normalizeWorkflowStep,
  toStorageTriggerType,
  normalizeTriggerType,
  rowToWorkflow,
  rowToWorkflowRun,
} from './workflow-utils.js';

// Re-export step handlers for external use
export {
  executeStep,
  handleFilterStep,
  handleCategorizeStep,
  handleForwardStep,
  handleSummarizeStep,
  handleExtractStep,
  handleGroupStep,
  handleNotifyStep,
  handleSaveReportStep,
  handleConditionStep,
  handleAIAnalyzeStep,
} from './workflow-steps.js';

import { executeStep } from './workflow-steps.js';

// --- CRUD ---

export async function createWorkflow(
  accountId: string,
  name: string,
  description: string | null,
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  steps: WorkflowStep[],
): Promise<Workflow> {
  const id = uuid();
  const now = Date.now();

  await execute(
    `INSERT INTO workflows (id, account_id, name, description, trigger_type, trigger_config, steps, is_active, run_count, last_run_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)`,
    [
      id,
      accountId,
      name,
      description,
      toStorageTriggerType(triggerType),
      JSON.stringify(
        triggerType === 'schedule' ? normalizeScheduleConfig(triggerConfig) : triggerConfig,
      ),
      JSON.stringify(steps.map(normalizeWorkflowStep)),
      now,
      now,
    ],
  );

  return rowToWorkflow({
    id,
    account_id: accountId,
    name,
    description,
    trigger_type: toStorageTriggerType(triggerType),
    trigger_config: JSON.stringify(triggerConfig),
    steps: JSON.stringify(steps),
    is_active: 1,
    run_count: 0,
    last_run_at: null,
    created_at: now,
    updated_at: now,
  });
}

export async function getWorkflows(accountId: string): Promise<Workflow[]> {
  const rows = await queryAll<WorkflowRow>(
    'SELECT * FROM workflows WHERE account_id = ? ORDER BY created_at DESC',
    [accountId],
  );
  return rows.map(rowToWorkflow);
}

export async function getActiveWorkflowsForAccount(accountId: string): Promise<Workflow[]> {
  const rows = await queryAll<WorkflowRow>(
    'SELECT * FROM workflows WHERE account_id = ? AND is_active = 1',
    [accountId],
  );
  return rows.map(rowToWorkflow);
}

export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  const row = await queryOne<WorkflowRow>('SELECT * FROM workflows WHERE id = ?', [id]);
  return row ? rowToWorkflow(row) : undefined;
}

export async function updateWorkflow(
  id: string,
  updates: Partial<
    Pick<Workflow, 'name' | 'description' | 'triggerType' | 'triggerConfig' | 'steps'>
  >,
): Promise<Workflow | undefined> {
  const existing = await queryOne<WorkflowRow>('SELECT * FROM workflows WHERE id = ?', [id]);
  if (!existing) return undefined;

  const now = Date.now();
  const fields: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    params.push(updates.description);
  }
  if (updates.triggerType !== undefined) {
    fields.push('trigger_type = ?');
    params.push(toStorageTriggerType(updates.triggerType));
  }
  if (updates.triggerConfig !== undefined) {
    fields.push('trigger_config = ?');
    params.push(
      JSON.stringify(
        updates.triggerType === 'schedule' ||
          (updates.triggerType === undefined && existing.trigger_type === 'scheduled')
          ? normalizeScheduleConfig(updates.triggerConfig)
          : updates.triggerConfig,
      ),
    );
  }
  if (updates.steps !== undefined) {
    fields.push('steps = ?');
    params.push(JSON.stringify(updates.steps.map(normalizeWorkflowStep)));
  }

  params.push(id);
  await execute(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`, params);

  return await getWorkflow(id);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await execute('DELETE FROM workflows WHERE id = ?', [id]);
}

export async function toggleWorkflow(id: string, isActive: boolean): Promise<void> {
  await execute('UPDATE workflows SET is_active = ?, updated_at = ? WHERE id = ?', [
    isActive ? 1 : 0,
    Date.now(),
    id,
  ]);
}

// --- Scheduled Workflow Processing ---

export async function processScheduledWorkflows(): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();

  const rows = await queryAll<WorkflowRow>(
    'SELECT * FROM workflows WHERE is_active = 1 AND trigger_type IN (?, ?)',
    ['scheduled', 'schedule'],
  );
  const scheduled = rows.map(rowToWorkflow);

  for (const wf of scheduled) {
    const config = normalizeScheduleConfig(wf.triggerConfig) as {
      hour?: number;
      minute?: number;
      days?: number[];
    };
    const targetHour = config.hour ?? 7;
    const targetMinute = config.minute ?? 0;
    const targetDays = config.days ?? [1, 2, 3, 4, 5];

    if (hour === targetHour && minute === targetMinute && targetDays.includes(dayOfWeek)) {
      logger.info(`Executing scheduled workflow: ${wf.name} (${wf.id})`);
      await executeWorkflow(wf.id).catch((err) =>
        logger.error(`Scheduled workflow ${wf.id} failed:`, err),
      );
    }
  }
}

// --- Workflow Execution ---

export async function executeWorkflow(
  workflowId: string,
  options?:
    | string
    | {
        triggerEmailId?: string;
        sourceEmailIds?: string[];
      },
): Promise<WorkflowRun | undefined> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) return undefined;
  const triggerEmailId = typeof options === 'string' ? options : options?.triggerEmailId;
  const sourceEmailIds =
    typeof options === 'string'
      ? []
      : Array.isArray(options?.sourceEmailIds)
        ? options.sourceEmailIds.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        : [];

  const runId = uuid();
  const now = Date.now();

  await execute(
    `INSERT INTO workflow_runs (id, workflow_id, account_id, status, trigger_email_id, steps_completed, result, started_at, completed_at, error)
     VALUES (?, ?, ?, 'running', ?, 0, '{}', ?, NULL, NULL)`,
    [runId, workflowId, workflow.accountId, triggerEmailId ?? null, now],
  );

  let emails: EmailRow[] = [];
  if (sourceEmailIds.length > 0) {
    const placeholders = sourceEmailIds.map(() => '?').join(', ');
    emails = await queryAll<EmailRow>(
      `SELECT * FROM emails WHERE account_id = ? AND id IN (${placeholders}) ORDER BY date DESC`,
      [workflow.accountId, ...sourceEmailIds],
    );
  } else if (triggerEmailId) {
    const email = await queryOne<EmailRow>('SELECT * FROM emails WHERE id = ? AND account_id = ?', [
      triggerEmailId,
      workflow.accountId,
    ]);
    if (email) emails = [email];
  }

  const context: StepContext = {
    accountId: workflow.accountId,
    emails,
    data: {},
    triggerEmailId,
  };

  let stepsCompleted = 0;
  let error: string | null = null;
  const stepResults: Record<string, unknown>[] = [];

  try {
    const MAX_ITERATIONS = 1000;
    let iterations = 0;
    let stepIndex = 0;
    while (stepIndex < workflow.steps.length) {
      if (++iterations > MAX_ITERATIONS) {
        logger.error(`Workflow ${workflow.id}: max iterations exceeded`);
        error = `Max iterations (${MAX_ITERATIONS}) exceeded`;
        break;
      }
      const step = workflow.steps[stepIndex];
      const result = await executeStep(step, context);
      stepResults.push({ step: step.name, type: step.type, ...result });

      if (!result.success) {
        error = result.error ?? `Step "${step.name}" failed`;
        break;
      }

      stepsCompleted++;

      if (result.nextStepIndex !== undefined) {
        stepIndex = result.nextStepIndex;
      } else {
        stepIndex++;
      }
    }

    const status = error ? 'failed' : 'completed';
    const completedAt = Date.now();

    await execute(
      `UPDATE workflow_runs SET status = ?, steps_completed = ?, result = ?, completed_at = ?, error = ? WHERE id = ?`,
      [status, stepsCompleted, JSON.stringify({ steps: stepResults }), completedAt, error, runId],
    );

    await execute(
      `UPDATE workflows SET run_count = run_count + 1, last_run_at = ?, updated_at = ? WHERE id = ?`,
      [completedAt, completedAt, workflowId],
    );

    return getWorkflowRun(runId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Workflow execution error (${workflowId}):`, errMsg);

    await execute(
      `UPDATE workflow_runs SET status = 'failed', steps_completed = ?, result = ?, completed_at = ?, error = ? WHERE id = ?`,
      [stepsCompleted, JSON.stringify({ steps: stepResults }), Date.now(), errMsg, runId],
    );

    return getWorkflowRun(runId);
  }
}

async function getWorkflowRun(runId: string): Promise<WorkflowRun | undefined> {
  const row = await queryOne<WorkflowRunRow>('SELECT * FROM workflow_runs WHERE id = ?', [runId]);
  return row ? rowToWorkflowRun(row) : undefined;
}

export async function getWorkflowRuns(
  workflowId: string,
  limit: number = 20,
): Promise<WorkflowRun[]> {
  const rows = await queryAll<WorkflowRunRow>(
    'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
    [workflowId, limit],
  );
  return rows.map(rowToWorkflowRun);
}

// --- Preset Workflows ---

export async function createDefaultWorkflows(accountId: string): Promise<Workflow[]> {
  const workflows: Workflow[] = [];

  workflows.push(
    await createWorkflow(
      accountId,
      'Napi összefoglaló',
      'Reggel 7:00-kor összefoglalja a tegnapi emaileket',
      'scheduled',
      { hour: 7, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] },
      [
        {
          type: 'filter',
          name: 'Elmúlt 1 nap emailjei',
          config: { field: 'date_age_days', operator: 'lte', value: '1' },
        },
        { type: 'summarize', name: 'Összefoglalás', config: { maxLength: 300 } },
        {
          type: 'notify',
          name: 'Értesítés',
          config: { title: 'Napi összefoglaló', body: 'Tegnapi emailek összefoglalója elkészült' },
        },
      ],
    ),
  );

  workflows.push(
    await createWorkflow(
      accountId,
      'VIP értesítés',
      'VIP feladótól érkező emailnél azonnali push notification',
      'on_receive',
      { checkVip: true },
      [
        {
          type: 'filter',
          name: 'VIP szűrés',
          config: { field: 'from_email', operator: 'in_vip_list', value: '' },
        },
        {
          type: 'condition',
          name: 'Van VIP email?',
          config: { field: 'emailCount', operator: 'gt', value: 0, trueStep: 2, falseStep: 3 },
        },
        {
          type: 'notify',
          name: 'VIP értesítés',
          config: { title: '⭐ VIP email érkezett!', body: 'Új email egy VIP feladótól' },
        },
      ],
    ),
  );

  workflows.push(
    await createWorkflow(
      accountId,
      'Számlák gyűjtő',
      'Számla/invoice tárgyú emailek automatikus kategorizálása és összeg kinyerése',
      'on_receive',
      { subjectMatch: ['számla', 'invoice', 'faktura'] },
      [
        {
          type: 'filter',
          name: 'Számla szűrés',
          config: { field: 'subject', operator: 'contains', value: 'számla' },
        },
        {
          type: 'extract',
          name: 'Adatok kinyerése',
          config: { fields: ['subject', 'from_email', 'from_name', 'date', 'snippet'] },
        },
        { type: 'categorize', name: 'Kategorizálás', config: { categoryId: 'invoices' } },
        { type: 'save_report', name: 'Számla napló', config: { reportName: 'invoices' } },
      ],
    ),
  );

  workflows.push(
    await createWorkflow(
      accountId,
      'Heti riport',
      'Heti statisztika: email mennyiség, top feladók, válaszidők',
      'scheduled',
      { hour: 8, minute: 0, days: [1] },
      [
        {
          type: 'filter',
          name: 'Elmúlt 7 nap emailjei',
          config: { field: 'date_age_days', operator: 'lte', value: '7' },
        },
        { type: 'group', name: 'Feladók csoportosítása', config: { groupBy: 'from_email' } },
        { type: 'summarize', name: 'Statisztika', config: { maxLength: 500 } },
        {
          type: 'save_report',
          name: 'Heti riport mentés',
          config: { reportName: 'weekly_report' },
        },
        {
          type: 'notify',
          name: 'Riport értesítés',
          config: {
            title: '📊 Heti email riport',
            body: 'Az elmúlt hét email statisztikája elkészült',
          },
        },
      ],
    ),
  );

  return workflows;
}
