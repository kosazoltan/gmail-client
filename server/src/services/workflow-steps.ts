/**
 * Workflow step handler implementations.
 * Each step receives context, performs work, and returns StepResult.
 */
import { queryAll, queryOne, execute } from '../db/index.js';
import { sendPushToAccount } from './push.service.js';
import { getOAuth2ClientForAccount } from './auth.service.js';
import { getGmailClient, sendEmail } from './gmail.service.js';
import { extractActionItems } from './email-intelligence.service.js';
import {
  extractAndStoreEventCandidatesForEmail,
  syncEventCandidateToCalendar,
} from './calendar-automation.service.js';
import { upsertDetectedTaskForEmail } from './task-detection.service.js';
import { v4 as uuid } from 'uuid';
import logger from '../utils/logger.js';
import { callAI } from '../ai/provider.js';
import type { WorkflowStep, EmailRow, StepContext, StepResult } from './workflow-types.js';
import { normalizeStepConfigForType } from './workflow-utils.js';

// --- Step dispatcher ---

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
      case 'extract_action_items':
        return await handleExtractActionItemsStep(context.emails, context, step.config);
      case 'detect_followup_risk':
        return await handleDetectFollowUpRiskStep(context.emails, context);
      case 'extract_calendar_event':
        return await handleExtractCalendarEventStep(context.emails, context);
      case 'create_calendar_event':
        return await handleCreateCalendarEventStep(context.data);
      case 'raise_dashboard_alert':
        return await handleRaiseDashboardAlertStep(context.emails, context, step.config);
      default:
        return { success: false, error: `Unknown step type: ${step.type}` };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

// --- Individual Step Handlers ---

export async function handleFilterStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
  context?: StepContext,
): Promise<StepResult> {
  const normalizedConfig = normalizeStepConfigForType('filter', config);
  const { field, operator, value } = normalizedConfig as {
    field?: string;
    operator?: string;
    value?: string;
  };

  if (!field || (!value && operator !== 'in_vip_list')) {
    return { success: true, data: { filtered: emails.length, total: emails.length } };
  }

  let vipEmails: string[] = [];
  if (operator === 'in_vip_list') {
    const vips = await queryAll<{ email: string }>(
      'SELECT email FROM vip_senders WHERE account_id = ?',
      [context?.accountId ?? ''],
    );
    vipEmails = vips.map((v) => v.email.toLowerCase());
  }

  const filtered = emails.filter((email) => {
    const numericFieldValue =
      field === 'date_age_days'
        ? Math.floor((Date.now() - Number(email.date ?? 0)) / (24 * 60 * 60 * 1000))
        : null;
    const fieldValue =
      numericFieldValue ??
      String((email as unknown as Record<string, unknown>)[field] ?? '').toLowerCase();
    const matchValue = typeof value === 'string' ? value.toLowerCase() : '';
    const numericMatchValue = Number(value);

    switch (operator) {
      case 'contains':
        return String(fieldValue).includes(matchValue);
      case 'equals':
        return fieldValue === matchValue;
      case 'starts_with':
        return String(fieldValue).startsWith(matchValue);
      case 'ends_with':
        return String(fieldValue).endsWith(matchValue);
      case 'not_contains':
        return !String(fieldValue).includes(matchValue);
      case 'gt':
        return Number(fieldValue) > numericMatchValue;
      case 'gte':
        return Number(fieldValue) >= numericMatchValue;
      case 'lt':
        return Number(fieldValue) < numericMatchValue;
      case 'lte':
        return Number(fieldValue) <= numericMatchValue;
      case 'in_vip_list':
        return vipEmails.includes(String(fieldValue).toLowerCase());
      default:
        return String(fieldValue).includes(matchValue);
    }
  });

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

  if (emails.length > 0) {
    try {
      const emailSummaries = emails
        .slice(0, 10)
        .map(
          (e) =>
            `From: ${e.from_name ?? ''} <${e.from_email ?? ''}>\nSubject: ${e.subject ?? ''}\nSnippet: ${(e.snippet ?? '').substring(0, 200)}`,
        )
        .join('\n---\n');

      const response = await callAI(
        [
          {
            role: 'user',
            content: `Elemezd az alábbi emaileket. Adj rövid összefoglalót, prioritást, és javasolt teendőket:\n\n${emailSummaries}`,
          },
        ],
        { maxTokens: 1000 },
      );

      return {
        success: true,
        data: { analysisType, emailCount: emails.length, analysis: response.text },
      };
    } catch (err) {
      logger.warn('AI analyze step: AI call failed:', err instanceof Error ? err.message : err);
    }
  }

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

        await sendEmail(gmail, context.accountId, { to, subject, body });
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

  return { success: true, data: { summaryCount: summaries.length, summaries } };
}

export function handleExtractStep(emails: EmailRow[], config: Record<string, unknown>): StepResult {
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

async function handleExtractActionItemsStep(
  emails: EmailRow[],
  context: StepContext,
  config: Record<string, unknown>,
): Promise<StepResult> {
  const workflowOrigin = (config.workflowOrigin as string) || 'workflow';
  const extracted = await Promise.all(
    emails.map((email) => extractActionItems(email.id, { workflowOrigin })),
  );
  context.data.actionItems = extracted.flat();
  return { success: true, data: { extractedActionItems: extracted.flat().length } };
}

async function handleDetectFollowUpRiskStep(
  emails: EmailRow[],
  context: StepContext,
): Promise<StepResult> {
  const detected = await Promise.all(
    emails.map((email) => upsertDetectedTaskForEmail(context.accountId, email.id)),
  );
  context.data.followUpRisks = detected.filter(Boolean);
  return { success: true, data: { detected: detected.filter(Boolean).length } };
}

async function handleExtractCalendarEventStep(
  emails: EmailRow[],
  context: StepContext,
): Promise<StepResult> {
  const candidates = await Promise.all(
    emails.map((email) => extractAndStoreEventCandidatesForEmail(email.id)),
  );
  context.data.eventCandidates = candidates.flat();
  return { success: true, data: { eventCandidates: candidates.flat().length } };
}

async function handleCreateCalendarEventStep(data: Record<string, unknown>): Promise<StepResult> {
  const candidates = (data.eventCandidates as Array<{ id: string }>) || [];
  const createdIds: string[] = [];
  for (const candidate of candidates) {
    const created = await syncEventCandidateToCalendar(candidate.id);
    if (created?.googleEventId) createdIds.push(created.googleEventId);
  }
  return { success: true, data: { createdCalendarEvents: createdIds.length } };
}

async function handleRaiseDashboardAlertStep(
  emails: EmailRow[],
  context: StepContext,
  config: Record<string, unknown>,
): Promise<StepResult> {
  const reminderOffsetHours = Number(config.reminderOffsetHours ?? 2);
  const note = String(config.note ?? 'Workflow által létrehozott AI figyelmeztetés');
  let remindersCreated = 0;
  for (const email of emails) {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM reminders WHERE email_id = ? AND account_id = ? AND is_completed = 0',
      [email.id, context.accountId],
    );
    if (existing) continue;
    await execute(
      `INSERT INTO reminders (id, email_id, account_id, remind_at, note, is_completed, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [
        uuid(),
        email.id,
        context.accountId,
        Date.now() + reminderOffsetHours * 60 * 60 * 1000,
        note,
        Date.now(),
      ],
    );
    remindersCreated++;
  }
  return { success: true, data: { remindersCreated } };
}

export function handleGroupStep(emails: EmailRow[], config: Record<string, unknown>): StepResult {
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
  const normalizedConfig = normalizeStepConfigForType('notify', config);
  const title = (normalizedConfig.title as string) ?? 'Workflow értesítés';
  const body = (normalizedConfig.body as string) ?? `${context.emails.length} email feldolgozva`;

  try {
    await sendPushToAccount(context.accountId, { title, body });
    return { success: true, data: { notified: true, title, body } };
  } catch (err) {
    logger.warn(
      'Push notification failed in workflow step:',
      err instanceof Error ? err.message : err,
    );
    return { success: true, data: { notified: false, reason: 'Push notification failed' } };
  }
}

export async function handleSaveReportStep(
  data: Record<string, unknown>,
  config: Record<string, unknown>,
  context: StepContext,
): Promise<StepResult> {
  const reportName = (config.reportName as string) ?? `report_${Date.now()}`;

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
    [
      uuid(),
      context.accountId,
      `workflow_report_${reportName}`,
      JSON.stringify(reportData),
      Date.now(),
    ],
  );

  return { success: true, data: { reportName, saved: true } };
}

async function handleAIReplyStep(
  emails: EmailRow[],
  config: Record<string, unknown>,
): Promise<StepResult> {
  const template = (config.template as string) ?? '';

  if (emails.length > 0) {
    try {
      const drafts: Array<{
        emailId: string;
        to: string | null;
        subject: string;
        suggestedReply: string;
      }> = [];

      for (const email of emails.slice(0, 5)) {
        const templateInstruction = template ? `\nHasználd ezt a sablont/stílust: ${template}` : '';
        const response = await callAI(
          [
            {
              role: 'user',
              content: `Készíts rövid, professzionális válaszlevelet erre az emailre:\n\nFeladó: ${email.from_name ?? ''}\nTárgy: ${email.subject ?? ''}\nTartalom: ${(email.snippet ?? '').substring(0, 500)}${templateInstruction}\n\nVálasz:`,
            },
          ],
          { maxTokens: 500 },
        );

        drafts.push({
          emailId: email.id,
          to: email.from_email,
          subject: `Re: ${email.subject ?? ''}`,
          suggestedReply: response.text,
        });
      }

      return { success: true, data: { drafts } };
    } catch (err) {
      logger.warn('AI reply step: AI call failed:', err instanceof Error ? err.message : err);
    }
  }

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
