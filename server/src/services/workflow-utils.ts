/**
 * Pure utility functions for workflow normalization, parsing, and mapping.
 * No side effects — no DB, no network calls.
 */
import type {
  Workflow,
  WorkflowStep,
  WorkflowRow,
  WorkflowRun,
  WorkflowRunRow,
} from './workflow-types.js';

// --- JSON helpers ---

export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// --- Trigger type normalization ---

export function normalizeTriggerType(triggerType: string): string {
  if (triggerType === 'on_receive') return 'new_email';
  if (triggerType === 'scheduled') return 'schedule';
  return triggerType;
}

export function toStorageTriggerType(triggerType: string): string {
  if (triggerType === 'new_email') return 'on_receive';
  if (triggerType === 'schedule') return 'scheduled';
  return triggerType;
}

// --- Cron / schedule helpers ---

export function parseCronDays(segment?: string): number[] | undefined {
  if (!segment || segment === '*' || segment === '?') return undefined;
  const mapped = segment
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value))
    .map((value) => (value === 7 ? 0 : value))
    .filter((value) => value >= 0 && value <= 6);
  return mapped.length > 0 ? [...new Set(mapped)] : undefined;
}

export function normalizeScheduleConfig(
  triggerConfig: Record<string, unknown>,
): Record<string, unknown> {
  const hour =
    typeof triggerConfig.hour === 'number'
      ? triggerConfig.hour
      : Number.parseInt(String(triggerConfig.hour ?? ''), 10);
  const minute =
    typeof triggerConfig.minute === 'number'
      ? triggerConfig.minute
      : Number.parseInt(String(triggerConfig.minute ?? ''), 10);
  const days = Array.isArray(triggerConfig.days)
    ? triggerConfig.days
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value))
    : undefined;

  if (Number.isInteger(hour) && Number.isInteger(minute)) {
    return {
      hour,
      minute,
      days: days && days.length > 0 ? [...new Set(days)] : [1, 2, 3, 4, 5],
    };
  }

  const cron = typeof triggerConfig.cron === 'string' ? triggerConfig.cron.trim() : '';
  if (cron) {
    const parts = cron.split(/\s+/);
    if (parts.length >= 5) {
      const cronMinute = Number.parseInt(parts[0], 10);
      const cronHour = Number.parseInt(parts[1], 10);
      const cronDays = parseCronDays(parts[4]) ?? [1, 2, 3, 4, 5];
      if (Number.isInteger(cronHour) && Number.isInteger(cronMinute)) {
        return {
          hour: cronHour,
          minute: cronMinute,
          days: cronDays,
        };
      }
    }
  }

  return {
    hour: 7,
    minute: 0,
    days: [1, 2, 3, 4, 5],
  };
}

// --- Step normalization ---

export function normalizeStepConfigForType(
  stepType: WorkflowStep['type'],
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (stepType === 'filter') {
    if (typeof config.field === 'string' && typeof config.value === 'string') {
      return config;
    }
    if (typeof config.sender === 'string' && config.sender.trim()) {
      return {
        field: 'from_email',
        operator: 'contains',
        value: config.sender.trim(),
      };
    }
    if (typeof config.subject === 'string' && config.subject.trim()) {
      return {
        field: 'subject',
        operator: 'contains',
        value: config.subject.trim(),
      };
    }
  }

  if (stepType === 'notify') {
    return {
      title: typeof config.title === 'string' ? config.title : 'Workflow értesítés',
      body:
        typeof config.body === 'string'
          ? config.body
          : typeof config.message === 'string'
            ? config.message
            : undefined,
    };
  }

  return config;
}

export function normalizeWorkflowStep(step: WorkflowStep): WorkflowStep {
  return {
    ...step,
    name: step.name ?? step.type,
    config: normalizeStepConfigForType(step.type, step.config),
  };
}

export function normalizeWorkflowForRuntime(workflow: Workflow): Workflow {
  return {
    ...workflow,
    triggerConfig:
      workflow.triggerType === 'schedule'
        ? normalizeScheduleConfig(workflow.triggerConfig)
        : workflow.triggerConfig,
    steps: workflow.steps.map(normalizeWorkflowStep),
  };
}

// --- Row to model mappers ---

export function rowToWorkflow(row: WorkflowRow): Workflow {
  return normalizeWorkflowForRuntime({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    description: row.description,
    triggerType: normalizeTriggerType(row.trigger_type),
    triggerConfig: safeJsonParse(row.trigger_config, {}),
    steps: safeJsonParse(row.steps, []),
    isActive: row.is_active === 1,
    runCount: row.run_count,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function rowToWorkflowRun(row: WorkflowRunRow): WorkflowRun {
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
