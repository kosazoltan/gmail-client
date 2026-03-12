import { queryAll } from '../db/index.js';
import { getWorkflows, getWorkflow, createWorkflow, executeWorkflow } from './workflow.service.js';
import { getSmartFolders } from './smart-folders.service.js';
import {
  generateWorkflowDraftFromPrompt,
  type WorkflowDraft,
} from './ai-workflow.service.js';


export interface EmailSearchHit {
  id: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
  date: number;
  appLink: string;
}

export interface SearchEmailsArgs {
  query: string;
  limit?: number;
}

export interface RunWorkflowArgs {
  workflowId?: string;
  workflowName?: string;
  triggerEmailId?: string;
  sourceEmailIds?: string[];
  searchQuery?: string;
}

export function buildEmailAppLink(emailId: string): string {
  return `/?emailId=${encodeURIComponent(emailId)}`;
}

export function buildViewPath(view: string): string {
  const normalized = view.trim().toLowerCase();
  if (normalized.includes('workflow')) return '/ai-assistant?tab=workflows';
  if (normalized.includes('smart') || normalized.includes('mappa')) return '/smart-folders';
  if (normalized.includes('dashboard')) return '/dashboard';
  if (normalized.includes('napt')) return '/calendar';
  return '/';
}

export async function searchEmails(
  accountId: string,
  args: SearchEmailsArgs,
): Promise<{ query: string; emails: EmailSearchHit[]; resultCount: number }> {
  const limit = Math.max(1, Math.min(25, Number(args.limit) || 10));
  const query = args.query.trim();
  const term = `%${query}%`;
  const rows = await queryAll<{
    id: string;
    subject: string | null;
    from_email: string | null;
    from_name: string | null;
    snippet: string | null;
    date: number;
  }>(
    `SELECT id, subject, from_email, from_name, snippet, date
     FROM emails
     WHERE account_id = ?
       AND (
         subject LIKE ? COLLATE NOCASE
         OR from_email LIKE ? COLLATE NOCASE
         OR from_name LIKE ? COLLATE NOCASE
         OR snippet LIKE ? COLLATE NOCASE
       )
     ORDER BY date DESC
     LIMIT ?`,
    [accountId, term, term, term, term, limit],
  );

  const emails = rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    fromEmail: row.from_email,
    fromName: row.from_name,
    snippet: row.snippet,
    date: row.date,
    appLink: buildEmailAppLink(row.id),
  }));

  return {
    query,
    emails,
    resultCount: emails.length,
  };
}

export async function listWorkflowsTool(accountId: string) {
  const workflows = await getWorkflows(accountId);
  return workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    triggerType: workflow.triggerType,
    isActive: workflow.isActive,
    stepCount: workflow.steps.length,
  }));
}

export async function listSmartFoldersTool(accountId: string) {
  const folders = await getSmartFolders(accountId);
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    color: null,
    count: folder.emailCount ?? 0,
  }));
}

export async function createWorkflowDraftTool(
  prompt: string,
): Promise<{ workflow: WorkflowDraft; warnings: string[]; source: 'ai' | 'fallback' }> {
  return generateWorkflowDraftFromPrompt(prompt);
}

export async function saveWorkflowTool(accountId: string, workflow: WorkflowDraft) {
  return createWorkflow(
    accountId,
    workflow.name,
    workflow.description ?? null,
    workflow.triggerType,
    workflow.triggerConfig,
    workflow.steps,
  );
}

async function resolveWorkflowId(accountId: string, args: RunWorkflowArgs): Promise<string | null> {
  if (args.workflowId) {
    const workflow = await getWorkflow(args.workflowId);
    return workflow && workflow.accountId === accountId ? workflow.id : null;
  }

  if (!args.workflowName) {
    return null;
  }

  const workflows = await getWorkflows(accountId);
  const normalizedName = args.workflowName.trim().toLowerCase();
  const match = workflows.find((workflow) => workflow.name.trim().toLowerCase().includes(normalizedName));
  return match?.id ?? null;
}

export async function runWorkflowTool(accountId: string, args: RunWorkflowArgs) {
  const workflowId = await resolveWorkflowId(accountId, args);
  if (!workflowId) {
    throw new Error('A futtatandó workflow nem található.');
  }

  let sourceEmailIds = Array.isArray(args.sourceEmailIds)
    ? args.sourceEmailIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  if (sourceEmailIds.length === 0 && args.searchQuery) {
    const search = await searchEmails(accountId, { query: args.searchQuery, limit: 25 });
    sourceEmailIds = search.emails.map((email) => email.id);
  }

  const run = await executeWorkflow(workflowId, {
    triggerEmailId: args.triggerEmailId,
    sourceEmailIds,
  });

  if (!run) {
    throw new Error('A workflow futtatása nem sikerült.');
  }

  return run;
}
