import { queryAll, queryOne, execute, runInTransaction } from '../db/index.js';
import { sendPushToAccount } from './push.service.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { getGmailClient, sendEmail } from './gmail.service.js';
import { v4 as uuid } from 'uuid';
import logger from '../utils/logger.js';

// --- Anthropic client singleton ---

let _anthropicClient: InstanceType<typeof import('@anthropic-ai/sdk').default> | null = null;

async function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropicClient) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    _anthropicClient = new Anthropic();
  }
  return _anthropicClient;
}

// --- Interfaces ---

export interface WorkflowStep {
  type: 'filter' | 'ai_analyze' | 'categorize' | 'label' | 'forward' | 'summarize' | 'extract' | 'group' | 'notify' | 'save_report' | 'ai_reply' | 'condition';
  name: string;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: WorkflowStep[];
  isActive: boolean;
  runCount: number;
  lastRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  accountId: string;
  status: 'running' | 'completed' | 'failed';
  triggerEmailId: string | null;
  stepsCompleted: number;
  result: Record<string, unknown>;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

interface WorkflowRow {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: string;
  steps: string;
  is_active: number;
  run_count: number;
  last_run_at: number | null;
  created_at: number;
  updated_at: number;
}

interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  account_id: string;
  status: string;
  trigger_email_id: string | null;
  steps_completed: number;
  result: string;
  started_at: number;
  completed_at: number | null;
  error: string | null;
}

interface EmailRow {
  id: string;
  account_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  snippet: string | null;
  body: string | null;
  date: number;
  is_read: number;
  is_starred: number;
  labels: string | null;
  category_id: string | null;
}

export interface StepContext {
  accountId: string;
  emails: EmailRow[];
  data: Record<string, unknown>;
  triggerEmailId?: string;
}

export interface StepResult {
  success: boolean;
  data?: unknown;
  nextStepIndex?: number;
  error?: string;
}

// --- Row to model mappers ---

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    triggerConfig: safeJsonParse(row.trigger_config, {}),
    steps: safeJsonParse(row.steps, []),
    isActive: row.is_active === 1,
    runCount: row.run_count,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToWorkflowRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    accountId: row.account_id,
    status: row.status as WorkflowRun['status'],
    triggerEmailId: row.trigger_email_id,
    stepsCompleted: row.steps_completed,
    result: safeJsonParse(row.result, {}),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    error: row.error,
  };
}

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

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
    [id, accountId, name, description, triggerType, JSON.stringify(triggerConfig), JSON.stringify(steps), now, now],
  );

  return {
    id,
    accountId,
    name,
    description,
    triggerType,
    triggerConfig,
    steps,
    isActive: true,
    runCount: 0,
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  };
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
  updates: Partial<Pick<Workflow, 'name' | 'description' | 'triggerType' | 'triggerConfig' | 'steps'>>,
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
    params.push(updates.triggerType);
  }
  if (updates.triggerConfig !== undefined) {
    fields.push('trigger_config = ?');
    params.push(JSON.stringify(updates.triggerConfig));
  }
  if (updates.steps !== undefined) {
    fields.push('steps = ?');
    params.push(JSON.stringify(updates.steps));
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
  const dayOfWeek = now.getDay(); // 0=Sunday

  const rows = await queryAll<WorkflowRow>(
    'SELECT * FROM workflows WHERE is_active = 1 AND trigger_type = ?',
    ['scheduled'],
  );
  const scheduled = rows.map(rowToWorkflow);

  for (const wf of scheduled) {
    const config = wf.triggerConfig as { hour?: number; minute?: number; days?: number[] };
    const targetHour = config.hour ?? 7;
    const targetMinute = config.minute ?? 0;
    const targetDays = config.days ?? [1, 2, 3, 4, 5]; // weekdays by default

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
  triggerEmailId?: string,
): Promise<WorkflowRun | undefined> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) return undefined;

  const runId = uuid();
  const now = Date.now();

  await execute(
    `INSERT INTO workflow_runs (id, workflow_id, account_id, status, trigger_email_id, steps_completed, result, started_at, completed_at, error)
     VALUES (?, ?, ?, 'running', ?, 0, '{}', ?, NULL, NULL)`,
    [runId, workflowId, workflow.accountId, triggerEmailId ?? null, now],
  );

  // Load trigger email(s) as initial context
  let emails: EmailRow[] = [];
  if (triggerEmailId) {
    const email = await queryOne<EmailRow>('SELECT * FROM emails WHERE id = ? AND account_id = ?', [triggerEmailId, workflow.accountId]);
    if (email) emails = [email];
  }

  const context: StepContext = {
    accountId: workflow.accountId,
    emails,
    data: {},
    triggerEmailId: triggerEmailId,
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

      // Condition step can jump to a different step
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

    // Update workflow stats
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

export async function executeStep(step: WorkflowStep, context: StepContext): Promise<StepResult> {
  try {
    switch (step.type) {
      case 'filter':
        return handleFilterStep(context.emails, step.config, context);
      case 'ai_analyze':
        return await handleAIAnalyzeStep(context.emails, step.config);
      case 'categorize':
        return handleCategorizeStep(context.emails, step.config);
      case 'label':
        return handleLabelStep(context.emails, step.config);
      case 'forward':
        return await handleForwardStep(context.emails, step.config, context);
      case 'summarize':
        return handleSummarizeStep(context.emails, step.config);
      case 'extract':
        return handleExtractStep(context.emails, step.config);
      case 'group':
        return handleGroupStep(context.emails, step.config);
      case 'notify':
        return await handleNotifyStep(step.config, context);
      case 'save_report':
        return handleSaveReportStep(context.data, step.config, context);
      case 'ai_reply':
        return await handleAIReplyStep(context.emails, step.config);
      case 'condition':
        return handleConditionStep(context.data, step.config, context);
      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

async function getWorkflowRun(runId: string): Promise<WorkflowRun | undefined> {
  const row = await queryOne<WorkflowRunRow>('SELECT * FROM workflow_runs WHERE id = ?', [runId]);
  return row ? rowToWorkflowRun(row) : undefined;
}

export async function getWorkflowRuns(workflowId: string, limit: number = 20): Promise<WorkflowRun[]> {
  const rows = await queryAll<WorkflowRunRow>(
    'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
    [workflowId, limit],
  );
  return rows.map(rowToWorkflowRun);
}

// --- Step Handlers ---

export async function handleFilterStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
  context?: StepContext,
): Promise<StepResult> {
  const { field, operator, value } = config as {
    field?: string;
    operator?: string;
    value?: string;
  };

  if (!field || !value) {
    return { success: true, data: { filtered: emails.length, total: emails.length } };
  }

  // Pre-fetch VIP list if needed
  let vipEmails: string[] = [];
  if (operator === 'in_vip_list') {
    const vips = await queryAll<{ email: string }>('SELECT email FROM vip_senders WHERE account_id = ?', [context?.accountId ?? '']);
    vipEmails = vips.map(v => v.email.toLowerCase());
  }

  const filtered = emails.filter((email) => {
    const fieldValue = String((email as unknown as Record<string, unknown>)[field] ?? '').toLowerCase();
    const matchValue = value.toLowerCase();

    switch (operator) {
      case 'contains':
        return fieldValue.includes(matchValue);
      case 'equals':
        return fieldValue === matchValue;
      case 'starts_with':
        return fieldValue.startsWith(matchValue);
      case 'ends_with':
        return fieldValue.endsWith(matchValue);
      case 'not_contains':
        return !fieldValue.includes(matchValue);
      case 'in_vip_list':
        return vipEmails.includes(fieldValue.toLowerCase());
      default:
        return fieldValue.includes(matchValue);
    }
  });

  // Update context emails
  if (context) {
    context.emails = filtered;
  }

  return { success: true, data: { filtered: filtered.length, total: emails.length } };
}

export async function handleAIAnalyzeStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): Promise<StepResult> {
  const analysisType = (config.analysisType as string) ?? 'summary';

  // Try AI analysis via Anthropic
  const aiClient = await getAnthropicClient();
  if (aiClient && emails.length > 0) {
    try {
      const client = aiClient;

      const emailSummaries = emails.slice(0, 10).map((e) =>
        `From: ${e.from_name ?? ''} <${e.from_email ?? ''}>\nSubject: ${e.subject ?? ''}\nSnippet: ${(e.snippet ?? '').substring(0, 200)}`,
      ).join('\n---\n');

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Elemezd az alábbi emaileket. Adj rövid összefoglalót, prioritást, és javasolt teendőket:\n\n${emailSummaries}`,
        }],
      });

      const analysis = response.content[0].type === 'text' ? response.content[0].text : '';
      return {
        success: true,
        data: { analysisType, emailCount: emails.length, analysis },
      };
    } catch (err) {
      logger.warn('AI analyze step: Anthropic call failed:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback: basic summaries without AI
  const summaries = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    from: e.from_email,
    snippet: e.snippet?.substring(0, 200),
  }));

  return {
    success: true,
    data: { analysisType, emailCount: emails.length, emails: summaries, aiAvailable: false },
  };
}

export async function handleCategorizeStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): Promise<StepResult> {
  const categoryId = config.categoryId as string | undefined;
  if (!categoryId) {
    return { success: false, error: 'categoryId is required for categorize step' };
  }

  for (const email of emails) {
    await execute('UPDATE emails SET category_id = ? WHERE id = ?', [categoryId, email.id]);
  }

  return { success: true, data: { categorized: emails.length, categoryId } };
}

async function handleLabelStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): Promise<StepResult> {
  const label = config.label as string | undefined;
  if (!label) {
    return { success: false, error: 'label is required for label step' };
  }

  for (const email of emails) {
    let arr: string[] = [];
    try {
      arr = email.labels ? JSON.parse(email.labels) : [];
    } catch {
      arr = [];
    }
    if (!arr.includes(label)) {
      arr.push(label);
    }
    await execute('UPDATE emails SET labels = ? WHERE id = ?', [JSON.stringify(arr), email.id]);
  }

  return { success: true, data: { labeled: emails.length, label } };
}

export async function handleForwardStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
  context?: StepContext,
): Promise<StepResult> {
  const to = config.to as string | undefined;
  if (!to) {
    return { success: false, error: 'to address is required for forward step' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return { success: false, error: `Invalid email: ${to}` };
  }

  if (!context?.accountId) {
    logger.warn('Forward step: no accountId in context, skipping actual send');
    return {
      success: true,
      data: { forwardTo: to, emailCount: emails.length, sent: false, reason: 'no account context' },
    };
  }

  let sentCount = 0;
  const errors: string[] = [];

  try {
    const { oauth2Client } = await getOAuth2ClientForAccount(context.accountId);
    const gmail = getGmailClient(oauth2Client);

    for (const email of emails) {
      try {
        const subject = `Fwd: ${email.subject ?? '(no subject)'}`;
        const body = `---------- Forwarded message ----------<br>From: ${email.from_name ?? ''} &lt;${email.from_email ?? ''}&gt;<br>Subject: ${email.subject ?? ''}<br><br>${email.body ?? email.snippet ?? ''}`;

        await sendEmail(gmail, { to, subject, body });
        sentCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Forward step: failed to send email ${email.id}:`, msg);
        errors.push(`${email.id}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Forward step: OAuth/Gmail init failed for account ${context.accountId}: ${msg}`);
    return {
      success: true,
      data: { forwardTo: to, emailCount: emails.length, sent: false, reason: msg },
    };
  }

  return {
    success: true,
    data: {
      forwardTo: to,
      emailCount: emails.length,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}

export function handleSummarizeStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): StepResult {
  const maxLength = (config.maxLength as number) ?? 500;
  const summaries = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    from: `${e.from_name ?? ''} <${e.from_email ?? ''}>`,
    date: e.date,
    snippet: (e.snippet ?? '').substring(0, maxLength),
  }));

  return {
    success: true,
    data: {
      summaryCount: summaries.length,
      summaries,
    },
  };
}

export function handleExtractStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): StepResult {
  const extractFields = (config.fields as string[]) ?? ['subject', 'from_email', 'date'];
  const extracted = emails.map((email) => {
    const result: Record<string, unknown> = { id: email.id };
    for (const field of extractFields) {
      result[field] = (email as unknown as Record<string, unknown>)[field];
    }
    return result;
  });

  return { success: true, data: { extracted } };
}

export function handleGroupStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): StepResult {
  const groupBy = (config.groupBy as string) ?? 'from_email';
  const groups: Record<string, EmailRow[]> = {};

  for (const email of emails) {
    const key = String((email as unknown as Record<string, unknown>)[groupBy] ?? 'unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(email);
  }

  const groupSummary = Object.entries(groups).map(([key, items]) => ({
    key,
    count: items.length,
    emailIds: items.map((e) => e.id),
  }));

  return { success: true, data: { groupBy, groups: groupSummary } };
}

export async function handleNotifyStep(
  config: Record<string, unknown>,
  context: StepContext,
): Promise<StepResult> {
  const title = (config.title as string) ?? 'Workflow értesítés';
  const body = (config.body as string) ?? `${context.emails.length} email feldolgozva`;

  try {
    await sendPushToAccount(context.accountId, { title, body });
    return { success: true, data: { notified: true, title, body } };
  } catch (err) {
    logger.warn('Push notification failed in workflow step:', err instanceof Error ? err.message : err);
    // Don't fail the workflow just because push failed
    return { success: true, data: { notified: false, reason: 'Push notification failed' } };
  }
}

export async function handleSaveReportStep(
  data: Record<string, unknown>,
  config: Record<string, unknown>,
  context: StepContext,
): Promise<StepResult> {
  const reportName = (config.reportName as string) ?? `report_${Date.now()}`;

  // Save report as a user setting (JSON blob)
  const reportData = {
    name: reportName,
    generatedAt: Date.now(),
    emailCount: context.emails.length,
    data,
  };

  await execute(
    `INSERT INTO user_settings (id, account_id, key, value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [uuid(), context.accountId, `workflow_report_${reportName}`, JSON.stringify(reportData), Date.now()],
  );

  return { success: true, data: { reportName, saved: true } };
}

async function handleAIReplyStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): Promise<StepResult> {
  const template = (config.template as string) ?? '';

  // Try AI reply generation via Anthropic
  const replyClient = await getAnthropicClient();
  if (replyClient && emails.length > 0) {
    try {
      const client = replyClient;

      const drafts: Array<{ emailId: string; to: string | null; subject: string; suggestedReply: string }> = [];

      for (const email of emails.slice(0, 5)) {
        const templateInstruction = template ? `\nHasználd ezt a sablont/stílust: ${template}` : '';
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Készíts rövid, professzionális válaszlevelet erre az emailre:\n\nFeladó: ${email.from_name ?? ''}\nTárgy: ${email.subject ?? ''}\nTartalom: ${(email.snippet ?? '').substring(0, 500)}${templateInstruction}\n\nVálasz:`,
          }],
        });

        const reply = response.content[0].type === 'text' ? response.content[0].text : '';
        drafts.push({
          emailId: email.id,
          to: email.from_email,
          subject: `Re: ${email.subject ?? ''}`,
          suggestedReply: reply,
        });
      }

      return { success: true, data: { drafts } };
    } catch (err) {
      logger.warn('AI reply step: Anthropic call failed:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback: draft stubs without AI content
  const drafts = emails.map((e) => ({
    emailId: e.id,
    to: e.from_email,
    subject: `Re: ${e.subject ?? ''}`,
    templateUsed: template,
    aiAvailable: false,
  }));

  return { success: true, data: { drafts } };
}

export function handleConditionStep(
  data: Record<string, unknown>,
  config: Record<string, unknown>,
  context: StepContext,
): StepResult {
  const { field, operator, value, trueStep, falseStep } = config as {
    field?: string;
    operator?: string;
    value?: unknown;
    trueStep?: number;
    falseStep?: number;
  };

  if (!field) {
    return { success: false, error: 'field is required for condition step' };
  }

  // Check context data or email count
  let actual: unknown;
  if (field === 'emailCount') {
    actual = context.emails.length;
  } else {
    actual = data[field];
  }

  let conditionMet = false;
  switch (operator) {
    case 'equals':
      conditionMet = actual === value;
      break;
    case 'not_equals':
      conditionMet = actual !== value;
      break;
    case 'gt':
      conditionMet = Number(actual) > Number(value);
      break;
    case 'lt':
      conditionMet = Number(actual) < Number(value);
      break;
    case 'gte':
      conditionMet = Number(actual) >= Number(value);
      break;
    case 'lte':
      conditionMet = Number(actual) <= Number(value);
      break;
    case 'exists':
      conditionMet = actual !== undefined && actual !== null;
      break;
    default:
      conditionMet = Boolean(actual);
  }

  const nextIndex = conditionMet ? trueStep : falseStep;

  return {
    success: true,
    data: { conditionMet, field, operator, actual, value },
    nextStepIndex: nextIndex,
  };
}

// --- Preset Workflows ---

export async function createDefaultWorkflows(accountId: string): Promise<Workflow[]> {
  const workflows: Workflow[] = [];

  // 1. Napi összefoglaló — reggel 7:00
  workflows.push(
    await createWorkflow(accountId, 'Napi összefoglaló', 'Reggel 7:00-kor összefoglalja a tegnapi emaileket', 'scheduled', { hour: 7, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] }, [
      { type: 'filter', name: 'Tegnapi emailek', config: { field: 'date', operator: 'gte', value: 'yesterday' } },
      { type: 'summarize', name: 'Összefoglalás', config: { maxLength: 300 } },
      { type: 'notify', name: 'Értesítés', config: { title: 'Napi összefoglaló', body: 'Tegnapi emailek összefoglalója elkészült' } },
    ]),
  );

  // 2. VIP értesítés — on_receive
  workflows.push(
    await createWorkflow(accountId, 'VIP értesítés', 'VIP feladótól érkező emailnél azonnali push notification', 'on_receive', { checkVip: true }, [
      { type: 'filter', name: 'VIP szűrés', config: { field: 'from_email', operator: 'in_vip_list', value: '' } },
      { type: 'condition', name: 'Van VIP email?', config: { field: 'emailCount', operator: 'gt', value: 0, trueStep: 2, falseStep: 3 } },
      { type: 'notify', name: 'VIP értesítés', config: { title: '⭐ VIP email érkezett!', body: 'Új email egy VIP feladótól' } },
    ]),
  );

  // 3. Számlák gyűjtő — on_receive
  workflows.push(
    await createWorkflow(accountId, 'Számlák gyűjtő', 'Számla/invoice tárgyú emailek automatikus kategorizálása és összeg kinyerése', 'on_receive', { subjectMatch: ['számla', 'invoice', 'faktura'] }, [
      { type: 'filter', name: 'Számla szűrés', config: { field: 'subject', operator: 'contains', value: 'számla' } },
      { type: 'extract', name: 'Adatok kinyerése', config: { fields: ['subject', 'from_email', 'from_name', 'date', 'snippet'] } },
      { type: 'categorize', name: 'Kategorizálás', config: { categoryId: 'invoices' } },
      { type: 'save_report', name: 'Számla napló', config: { reportName: 'invoices' } },
    ]),
  );

  // 4. Heti riport — weekly
  workflows.push(
    await createWorkflow(accountId, 'Heti riport', 'Heti statisztika: email mennyiség, top feladók, válaszidők', 'scheduled', { hour: 8, minute: 0, days: [1] }, [
      { type: 'filter', name: 'Heti emailek', config: { field: 'date', operator: 'gte', value: 'last_week' } },
      { type: 'group', name: 'Feladók csoportosítása', config: { groupBy: 'from_email' } },
      { type: 'summarize', name: 'Statisztika', config: { maxLength: 500 } },
      { type: 'save_report', name: 'Heti riport mentés', config: { reportName: 'weekly_report' } },
      { type: 'notify', name: 'Riport értesítés', config: { title: '📊 Heti email riport', body: 'Az elmúlt hét email statisztikája elkészült' } },
    ]),
  );

  return workflows;
}
