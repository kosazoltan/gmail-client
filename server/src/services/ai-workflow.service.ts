import Anthropic from '@anthropic-ai/sdk';
import type { WorkflowStep } from './workflow.service.js';

export const AGENT_TRIGGER_TYPES = ['new_email', 'schedule', 'manual'] as const;
export const AGENT_STEP_TYPES = [
  'filter',
  'ai_analyze',
  'categorize',
  'label',
  'forward',
  'summarize',
  'extract',
  'notify',
  'group',
  'save_report',
  'ai_reply',
  'condition',
  'extract_action_items',
  'detect_followup_risk',
  'extract_calendar_event',
  'create_calendar_event',
  'raise_dashboard_alert',
] as const;

export interface WorkflowDraft {
  id?: string;
  name: string;
  description: string | null;
  triggerType: (typeof AGENT_TRIGGER_TYPES)[number];
  triggerConfig: Record<string, unknown>;
  steps: WorkflowStep[];
  isActive: boolean;
}

function sanitizeName(name: unknown): string {
  const value = typeof name === 'string' ? name.trim() : '';
  return value.slice(0, 120) || 'AI workflow';
}

function sanitizeDescription(description: unknown): string | null {
  const value = typeof description === 'string' ? description.trim() : '';
  return value ? value.slice(0, 500) : null;
}

function sanitizeTriggerType(triggerType: unknown): WorkflowDraft['triggerType'] {
  return AGENT_TRIGGER_TYPES.includes(triggerType as WorkflowDraft['triggerType'])
    ? (triggerType as WorkflowDraft['triggerType'])
    : 'new_email';
}

function sanitizeTriggerConfig(
  triggerType: WorkflowDraft['triggerType'],
  raw: unknown,
): Record<string, unknown> {
  const config = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  if (triggerType !== 'schedule') {
    return config;
  }

  const hour = Number.isInteger(config.hour) ? Number(config.hour) : 7;
  const minute = Number.isInteger(config.minute) ? Number(config.minute) : 0;
  const days = Array.isArray(config.days)
    ? config.days
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [1, 2, 3, 4, 5];

  return {
    hour: Math.max(0, Math.min(23, hour)),
    minute: Math.max(0, Math.min(59, minute)),
    days: days.length > 0 ? [...new Set(days)] : [1, 2, 3, 4, 5],
  };
}

function defaultConfigForStep(type: WorkflowStep['type']): Record<string, unknown> {
  switch (type) {
    case 'filter':
      return { field: 'subject', operator: 'contains', value: '' };
    case 'notify':
      return { title: 'AI workflow értesítés', body: '' };
    case 'forward':
      return { to: '' };
    case 'label':
      return { label: '' };
    case 'raise_dashboard_alert':
      return { reminderOffsetHours: 2, note: 'AI agent által létrehozott figyelmeztetés' };
    default:
      return {};
  }
}

function sanitizeStep(raw: unknown, index: number): WorkflowStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const step = raw as Record<string, unknown>;
  const rawType = step.type;
  if (!AGENT_STEP_TYPES.includes(rawType as WorkflowStep['type'])) {
    return null;
  }

  const type = rawType as WorkflowStep['type'];
  const config = step.config && typeof step.config === 'object'
    ? { ...defaultConfigForStep(type), ...(step.config as Record<string, unknown>) }
    : defaultConfigForStep(type);

  return {
    type,
    name:
      typeof step.name === 'string' && step.name.trim()
        ? step.name.trim().slice(0, 120)
        : `${index + 1}. ${type}`,
    config,
  };
}

export function validateWorkflowDraft(raw: unknown): { workflow: WorkflowDraft; warnings: string[] } {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const warnings: string[] = [];

  const triggerType = sanitizeTriggerType(input.triggerType);
  if (input.triggerType !== triggerType) {
    warnings.push('Ismeretlen trigger típus miatt new_email trigger került beállításra.');
  }

  const rawSteps = Array.isArray(input.steps) ? input.steps : [];
  const steps = rawSteps
    .map((step, index) => sanitizeStep(step, index))
    .filter((step): step is WorkflowStep => step != null);

  if (steps.length === 0) {
    warnings.push('Nem sikerült érvényes lépést generálni, ezért egy AI elemző lépés került beállításra.');
    steps.push({
      type: 'ai_analyze',
      name: 'AI elemzés',
      config: {},
    });
  }

  const workflow: WorkflowDraft = {
    name: sanitizeName(input.name),
    description: sanitizeDescription(input.description),
    triggerType,
    triggerConfig: sanitizeTriggerConfig(triggerType, input.triggerConfig),
    steps,
    isActive: false,
  };

  return { workflow, warnings };
}

function buildFallbackDraft(prompt: string): WorkflowDraft {
  const normalized = prompt.toLowerCase();

  if (normalized.includes('naptár') || normalized.includes('meeting') || normalized.includes('találkoz')) {
    return {
      name: 'AI naptár workflow',
      description: 'Emailből eseményeket ismer fel és naptárba teszi.',
      triggerType: 'new_email',
      triggerConfig: {},
      steps: [
        { type: 'extract_calendar_event', name: 'Esemény felismerés', config: {} },
        { type: 'create_calendar_event', name: 'Naptárba írás', config: {} },
      ],
      isActive: false,
    };
  }

  if (normalized.includes('follow') || normalized.includes('válasz') || normalized.includes('utánkövet')) {
    return {
      name: 'Follow-up workflow',
      description: 'Kiemeli a válasz nélküli ügyeket és dashboard figyelmeztetést készít.',
      triggerType: 'schedule',
      triggerConfig: { hour: 8, minute: 0, days: [1, 2, 3, 4, 5] },
      steps: [
        { type: 'detect_followup_risk', name: 'Follow-up kockázat', config: {} },
        { type: 'raise_dashboard_alert', name: 'Dashboard figyelmeztetés', config: {} },
      ],
      isActive: false,
    };
  }

  return {
    name: 'AI email workflow',
    description: 'AI által generált alap workflow.',
    triggerType: 'new_email',
    triggerConfig: {},
    steps: [
      { type: 'ai_analyze', name: 'AI elemzés', config: {} },
      { type: 'extract_action_items', name: 'Teendők kinyerése', config: {} },
      { type: 'raise_dashboard_alert', name: 'Dashboard figyelmeztetés', config: {} },
    ],
    isActive: false,
  };
}

export async function generateWorkflowDraftFromPrompt(
  anthropic: Anthropic | null,
  prompt: string,
): Promise<{ workflow: WorkflowDraft; warnings: string[]; source: 'ai' | 'fallback' }> {
  if (!anthropic) {
    return { workflow: buildFallbackDraft(prompt), warnings: [], source: 'fallback' };
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1400,
      messages: [
        {
          role: 'user',
          content: `A feladatod, hogy egy ZMail workflow draftot készíts természetes nyelvű leírásból.

Lehetséges triggerType értékek:
- new_email
- schedule
- manual

Lehetséges step type értékek:
${AGENT_STEP_TYPES.map((step) => `- ${step}`).join('\n')}

Fontos:
- Csak érvényes JSON objektumot adj vissza.
- A workflow legyen szerkeszthető, ne túl hosszú.
- A triggerConfig schedule esetén tartalmazzon hour, minute, days mezőt.
- A steps minden eleme legyen: { "type": "...", "name": "...", "config": {} }

Felhasználói kérés:
${prompt}

Válasz formátum:
{
  "name": "Workflow neve",
  "description": "Rövid leírás",
  "triggerType": "new_email",
  "triggerConfig": {},
  "steps": [
    { "type": "ai_analyze", "name": "AI elemzés", "config": {} }
  ]
}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    const validated = validateWorkflowDraft(parsed);
    return { workflow: validated.workflow, warnings: validated.warnings, source: 'ai' };
  } catch {
    return { workflow: buildFallbackDraft(prompt), warnings: [], source: 'fallback' };
  }
}
