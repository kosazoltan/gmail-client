/**
 * Workflow type definitions and interfaces.
 * Pure types — no runtime dependencies.
 */

export interface WorkflowStep {
  type:
    | 'filter'
    | 'ai_analyze'
    | 'categorize'
    | 'label'
    | 'forward'
    | 'summarize'
    | 'extract'
    | 'group'
    | 'notify'
    | 'save_report'
    | 'ai_reply'
    | 'condition'
    | 'extract_action_items'
    | 'detect_followup_risk'
    | 'extract_calendar_event'
    | 'create_calendar_event'
    | 'raise_dashboard_alert';
  name?: string;
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

export interface WorkflowRow {
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

export interface WorkflowRunRow {
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

export interface EmailRow {
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
