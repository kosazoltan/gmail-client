import Anthropic from '@anthropic-ai/sdk';
import {
  createWorkflowDraftTool,
  listSmartFoldersTool,
  listWorkflowsTool,
  runWorkflowTool,
  saveWorkflowTool,
  searchEmails,
  buildEmailAppLink,
  buildViewPath,
} from './ai-agent-tools.service.js';
import type { WorkflowDraft } from './ai-workflow.service.js';

export type AgentToolName =
  | 'answer'
  | 'searchEmails'
  | 'openEmail'
  | 'listWorkflows'
  | 'createWorkflowDraft'
  | 'saveWorkflow'
  | 'runWorkflow'
  | 'listSmartFolders'
  | 'navigateToView';

export interface PendingAgentAction {
  toolName: 'saveWorkflow' | 'runWorkflow';
  title: string;
  confirmationMessage: string;
  payload: Record<string, unknown>;
}

export interface AgentExecutionResult {
  kind:
    | 'search'
    | 'workflow_draft'
    | 'workflow_saved'
    | 'workflow_run'
    | 'workflows'
    | 'smart_folders'
    | 'navigation'
    | 'email';
  title: string;
  query?: string;
  interpretation?: string;
  emails?: Array<{
    id: string;
    subject: string | null;
    fromEmail: string | null;
    fromName: string | null;
    snippet: string | null;
    date: number;
    appLink: string;
  }>;
  resultCount?: number;
  workflowDraft?: WorkflowDraft;
  workflow?: {
    id?: string;
    name: string;
    triggerType?: string;
    stepCount?: number;
    isActive?: boolean;
  };
  workflowRun?: {
    id: string;
    workflowId: string;
    status: string;
    triggerEmailId: string | null;
    stepsCompleted: number;
  };
  workflows?: Array<{
    id: string;
    name: string;
    triggerType: string;
    isActive: boolean;
    stepCount: number;
  }>;
  smartFolders?: Array<{
    id: string;
    name: string;
    color: string | null;
    count: number;
  }>;
  navigation?: {
    label: string;
    path: string;
  };
  warnings?: string[];
}

interface AgentPlan {
  toolName: AgentToolName;
  args: Record<string, unknown>;
  reply?: string;
}

export interface AgentResponse {
  reply: string;
  result?: AgentExecutionResult;
  pendingAction?: PendingAgentAction;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '');
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createFallbackPlan(message: string): AgentPlan {
  const normalized = message.toLowerCase();

  if (normalized.includes('smart folder') || normalized.includes('okos mappa') || normalized.includes('mappa')) {
    return { toolName: 'listSmartFolders', args: {} };
  }

  if (normalized.includes('workflow') && (normalized.includes('futtasd') || normalized.includes('run'))) {
    return {
      toolName: 'runWorkflow',
      args: { workflowName: message },
    };
  }

  if (normalized.includes('workflow') && (normalized.includes('készíts') || normalized.includes('generál') || normalized.includes('hozz létre'))) {
    return {
      toolName: 'createWorkflowDraft',
      args: { prompt: message },
    };
  }

  if (normalized.includes('workflow') && (normalized.includes('mentsd') || normalized.includes('save'))) {
    return {
      toolName: 'saveWorkflow',
      args: { prompt: message },
    };
  }

  if (normalized.includes('workflow')) {
    return { toolName: 'listWorkflows', args: {} };
  }

  if (normalized.includes('nyisd meg') && normalized.includes('email')) {
    return {
      toolName: 'openEmail',
      args: {},
      reply: 'A konkrét email megnyitásához előbb keresd meg a levelet.',
    };
  }

  if (
    normalized.includes('keresd') ||
    normalized.includes('keress') ||
    normalized.includes('találd') ||
    normalized.includes('mutasd az email') ||
    normalized.includes('emailek')
  ) {
    return { toolName: 'searchEmails', args: { query: message } };
  }

  if (normalized.includes('dashboard') || normalized.includes('inbox') || normalized.includes('calendar')) {
    return { toolName: 'navigateToView', args: { view: message } };
  }

  return { toolName: 'answer', args: {} };
}

export async function planAgentAction(
  anthropic: Anthropic | null,
  message: string,
  emailContext = '',
): Promise<AgentPlan> {
  if (!anthropic) {
    return createFallbackPlan(message);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: `Te a ZMail planner rétege vagy. Válassz pontosan egy toolt a listából, majd adj vissza KIZÁRÓLAG egy JSON objektumot.

Elérhető toolok:
- answer: normál szöveges válasz, ha nincs app-akció
- searchEmails: email keresése; args: { "query": string, "limit"?: number }
- listWorkflows: workflow lista; args: {}
- createWorkflowDraft: workflow draft generálás; args: { "prompt": string }
- saveWorkflow: workflow mentési szándék; args: { "prompt": string }
- runWorkflow: workflow futtatási szándék; args: { "workflowName"?: string, "workflowId"?: string, "searchQuery"?: string }
- listSmartFolders: smart folder lista; args: {}
- navigateToView: app nézet megnyitása; args: { "view": string }

Szabályok:
- Ha a felhasználó csak összefoglalót, elemzést, szöveges segítséget kér, akkor answer.
- Ha appon belüli műveletet kér, NE answer-t adj.
- saveWorkflow és runWorkflow csak akkor legyen, ha a felhasználó ténylegesen mentést vagy futtatást kér.
- createWorkflowDraft akkor legyen, ha workflow létrehozást kér, de nem egyértelmű a közvetlen mentés.
- searchEmails-nél a query legyen rövid, kereshető kifejezés.
- runWorkflow.searchQuery mezőt csak akkor töltsd, ha a felhasználó konkrét emailhalmazon akar futtatni.

Email kontextus:
${emailContext || 'nincs'}

Felhasználói üzenet:
${message}

Válasz JSON:
{
  "toolName": "searchEmails",
  "args": { "query": "deployment hiba" },
  "reply": "Opcionális rövid magyarázat"
}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = extractJsonObject(text);
    if (!parsed || typeof parsed.toolName !== 'string') {
      return createFallbackPlan(message);
    }

    return {
      toolName: parsed.toolName as AgentToolName,
      args: parsed.args && typeof parsed.args === 'object' ? (parsed.args as Record<string, unknown>) : {},
      reply: typeof parsed.reply === 'string' ? parsed.reply : undefined,
    };
  } catch {
    return createFallbackPlan(message);
  }
}

export async function answerWithAi(
  anthropic: Anthropic | null,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  emailContext = '',
): Promise<string> {
  if (!anthropic) {
    return 'Az AI asszisztens jelenleg nem elérhető. Kérem ellenőrizze az ANTHROPIC_API_KEY beállítást.';
  }

  const messages = history.slice(-20);
  const userContent = emailContext ? `${message}\n\n${emailContext}` : message;
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1800,
    system:
      'Te egy magyar nyelvű ZMail asszisztens vagy. Röviden, hasznosan válaszolj. Ha nincs szükség app-akcióra, normál szöveges segítséget adj.',
    messages: [...messages, { role: 'user', content: userContent }],
  });

  return response.content[0].type === 'text'
    ? response.content[0].text
    : 'Nem sikerült választ generálni.';
}

export async function executeAgentPlan(params: {
  accountId: string;
  anthropic: Anthropic | null;
  message: string;
  plan: AgentPlan;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  emailContext?: string;
}): Promise<AgentResponse> {
  const { accountId, anthropic, message, plan, history, emailContext = '' } = params;

  switch (plan.toolName) {
    case 'searchEmails': {
      const query = typeof plan.args.query === 'string' && plan.args.query.trim()
        ? plan.args.query
        : message;
      const search = await searchEmails(accountId, {
        query,
        limit: Number(plan.args.limit) || 10,
      });
      return {
        reply: plan.reply || `${search.resultCount} email találatot találtam a ZMailben.`,
        result: {
          kind: 'search',
          title: 'Email találatok',
          query: search.query,
          emails: search.emails,
          resultCount: search.resultCount,
        },
      };
    }

    case 'listWorkflows': {
      const workflows = await listWorkflowsTool(accountId);
      return {
        reply: plan.reply || `${workflows.length} workflow érhető el.`,
        result: {
          kind: 'workflows',
          title: 'Workflow-k',
          workflows,
        },
      };
    }

    case 'listSmartFolders': {
      const smartFolders = await listSmartFoldersTool(accountId);
      return {
        reply: plan.reply || `${smartFolders.length} smart mappát találtam.`,
        result: {
          kind: 'smart_folders',
          title: 'Smart mappák',
          smartFolders,
        },
      };
    }

    case 'createWorkflowDraft': {
      const prompt = typeof plan.args.prompt === 'string' && plan.args.prompt.trim()
        ? plan.args.prompt
        : message;
      const generated = await createWorkflowDraftTool(anthropic, prompt);
      return {
        reply: plan.reply || 'Készítettem egy workflow draftot, amit a builderben rögtön szerkeszthetsz vagy elmenthetsz.',
        result: {
          kind: 'workflow_draft',
          title: 'Workflow draft',
          workflowDraft: generated.workflow,
          warnings: generated.warnings,
        },
      };
    }

    case 'saveWorkflow': {
      const prompt = typeof plan.args.prompt === 'string' && plan.args.prompt.trim()
        ? plan.args.prompt
        : message;
      const generated = await createWorkflowDraftTool(anthropic, prompt);
      return {
        reply: plan.reply || 'A workflow draft elkészült. Mentés előtt kérek egy megerősítést.',
        result: {
          kind: 'workflow_draft',
          title: 'Mentésre kész workflow draft',
          workflowDraft: generated.workflow,
          warnings: generated.warnings,
        },
        pendingAction: {
          toolName: 'saveWorkflow',
          title: 'Workflow mentése',
          confirmationMessage: 'Biztosan létrehozzam ezt a workflow-t a ZMailben?',
          payload: {
            workflow: generated.workflow,
          },
        },
      };
    }

    case 'runWorkflow': {
      const workflowName = typeof plan.args.workflowName === 'string' ? plan.args.workflowName : message;
      const searchQuery = typeof plan.args.searchQuery === 'string' ? plan.args.searchQuery : undefined;
      return {
        reply: plan.reply || 'A workflow futtatása előtt kérek megerősítést.',
        pendingAction: {
          toolName: 'runWorkflow',
          title: 'Workflow futtatása',
          confirmationMessage: 'Biztosan lefuttassam a kiválasztott workflow-t?',
          payload: {
            workflowName,
            workflowId: typeof plan.args.workflowId === 'string' ? plan.args.workflowId : undefined,
            triggerEmailId: typeof plan.args.triggerEmailId === 'string' ? plan.args.triggerEmailId : undefined,
            searchQuery,
            sourceEmailIds: Array.isArray(plan.args.sourceEmailIds) ? plan.args.sourceEmailIds : undefined,
          },
        },
      };
    }

    case 'navigateToView': {
      const view = typeof plan.args.view === 'string' ? plan.args.view : message;
      const path = buildViewPath(view);
      return {
        reply: plan.reply || 'Megnyithatóvá tettem a kért nézetet.',
        result: {
          kind: 'navigation',
          title: 'Navigáció',
          navigation: {
            label: 'Nézet megnyitása',
            path,
          },
        },
      };
    }

    case 'openEmail': {
      if (typeof plan.args.emailId !== 'string' || !plan.args.emailId.trim()) {
        return {
          reply: 'A konkrét email megnyitásához előbb keresd meg vagy add meg a levelet.',
        };
      }

      return {
        reply: 'Megnyithatod a konkrét emailt.',
        result: {
          kind: 'email',
          title: 'Email megnyitása',
          emails: [
            {
              id: plan.args.emailId,
              subject: null,
              fromEmail: null,
              fromName: null,
              snippet: null,
              date: Date.now(),
              appLink: buildEmailAppLink(plan.args.emailId),
            },
          ],
        },
      };
    }

    case 'answer':
    default: {
      const reply = await answerWithAi(anthropic, message, history, emailContext);
      return { reply };
    }
  }
}

export async function executeConfirmedAction(params: {
  accountId: string;
  pendingAction: PendingAgentAction;
}): Promise<AgentResponse> {
  const { accountId, pendingAction } = params;

  if (pendingAction.toolName === 'saveWorkflow') {
    const workflow = pendingAction.payload.workflow as WorkflowDraft | undefined;
    if (!workflow) {
      throw new Error('Hiányzó workflow payload.');
    }

    const saved = await saveWorkflowTool(accountId, workflow);
    return {
      reply: 'A workflow mentése sikerült.',
      result: {
        kind: 'workflow_saved',
        title: 'Workflow elmentve',
        workflow: {
          id: saved.id,
          name: saved.name,
          triggerType: saved.triggerType,
          stepCount: saved.steps.length,
          isActive: saved.isActive,
        },
      },
    };
  }

  if (pendingAction.toolName === 'runWorkflow') {
    const run = await runWorkflowTool(accountId, pendingAction.payload);
    return {
      reply: 'A workflow futtatása elindult.',
      result: {
        kind: 'workflow_run',
        title: 'Workflow futtatás',
        workflowRun: {
          id: run.id,
          workflowId: run.workflowId,
          status: run.status,
          triggerEmailId: run.triggerEmailId,
          stepsCompleted: run.stepsCompleted,
        },
      },
    };
  }

  throw new Error('Ismeretlen megerősítendő művelet.');
}
