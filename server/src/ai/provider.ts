import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AIProvider = 'anthropic' | 'openai';

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const LEGACY_OPENAI_MODELS = new Set(['gpt-4o-mini']);
const LEGACY_ANTHROPIC_MODELS = new Set(['claude-sonnet-4-5-20250929', 'claude-sonnet-4-5']);

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: AIProvider;
}

function configuredProvider(): AIProvider {
  return process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'openai';
}

function hasProviderKey(provider: AIProvider): boolean {
  return provider === 'openai' ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
}

function modelForProvider(provider: AIProvider): string {
  if (provider === 'openai') {
    const configured = process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_OPENAI_MODEL;
    return LEGACY_OPENAI_MODELS.has(configured.trim()) ? DEFAULT_OPENAI_MODEL : configured;
  }
  const configured =
    process.env.ANTHROPIC_MODEL ||
    (configuredProvider() === 'anthropic' ? process.env.AI_MODEL : undefined) ||
    DEFAULT_ANTHROPIC_MODEL;
  return LEGACY_ANTHROPIC_MODELS.has(configured.trim()) ? DEFAULT_ANTHROPIC_MODEL : configured;
}

function orderedAvailableProviders(): AIProvider[] {
  const primary = configuredProvider();
  const secondary: AIProvider = primary === 'openai' ? 'anthropic' : 'openai';
  return [primary, secondary].filter(hasProviderKey);
}

export function getAIProviderStatus(): {
  configuredProvider: AIProvider;
  availableProviders: Array<{ provider: AIProvider; model: string; hasApiKey: boolean }>;
  primaryInvoiceModel: string | null;
} {
  const available = orderedAvailableProviders();
  return {
    configuredProvider: configuredProvider(),
    availableProviders: (['openai', 'anthropic'] as AIProvider[]).map((provider) => ({
      provider,
      model: modelForProvider(provider),
      hasApiKey: hasProviderKey(provider),
    })),
    primaryInvoiceModel:
      available.length > 0 ? `${available[0]}:${modelForProvider(available[0])}` : null,
  };
}

export function isAIAvailable(): boolean {
  return orderedAvailableProviders().length > 0;
}

export function isAIProviderCapacityError(err: unknown): boolean {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;
  const code =
    err && typeof err === 'object' && 'code' in err ? (err as { code?: unknown }).code : undefined;
  const message = err instanceof Error ? err.message : String(err);
  return (
    status === 429 ||
    status === 529 ||
    code === 'insufficient_quota' ||
    /insufficient_quota|quota|rate limit|overloaded|too many requests/i.test(message)
  );
}

function isAIProviderFailoverError(err: unknown): boolean {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;
  return (
    isAIProviderCapacityError(err) ||
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

async function callProvider(
  provider: AIProvider,
  messages: AIMessage[],
  options: { maxTokens: number; timeoutMs: number; responseFormat?: 'json_object' },
): Promise<AIResponse> {
  const model = modelForProvider(provider);

  if (provider === 'openai') {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: options.timeoutMs,
    });
    const response = await openai.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens,
      ...(options.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });
    return {
      text: response.choices[0]?.message?.content ?? '',
      model,
      provider: 'openai',
    };
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: options.timeoutMs,
  });
  const systemMsg = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages.filter((m) => m.role !== 'system');
  const response = await anthropic.messages.create({
    model,
    max_tokens: options.maxTokens,
    ...(systemMsg ? { system: systemMsg } : {}),
    messages: userMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });
  return {
    text: response.content[0]?.type === 'text' ? response.content[0].text : '',
    model,
    provider: 'anthropic',
  };
}

export async function callAI(
  messages: AIMessage[],
  options?: { maxTokens?: number; timeoutMs?: number; responseFormat?: 'json_object' },
): Promise<AIResponse> {
  const maxTokens = options?.maxTokens ?? 2048;
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const providers = orderedAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No AI provider API key configured');
  }

  let lastError: unknown;
  for (const [index, provider] of providers.entries()) {
    try {
      return await callProvider(provider, messages, {
        maxTokens,
        timeoutMs,
        responseFormat: options?.responseFormat,
      });
    } catch (err) {
      lastError = err;
      if (index === providers.length - 1 || !isAIProviderFailoverError(err)) break;
    }
  }

  throw lastError;
}
