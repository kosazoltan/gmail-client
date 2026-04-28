import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AIProvider = 'anthropic' | 'openai';

const PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: AIProvider;
}

export function isAIAvailable(): boolean {
  if (PROVIDER === 'openai') return !!process.env.OPENAI_API_KEY;
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function callAI(
  messages: AIMessage[],
  options?: { maxTokens?: number; timeoutMs?: number; responseFormat?: 'json_object' },
): Promise<AIResponse> {
  const maxTokens = options?.maxTokens ?? 2048;
  const timeoutMs = options?.timeoutMs ?? 60_000;

  if (PROVIDER === 'openai') {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: timeoutMs,
    });
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
      ...(options?.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });
    return {
      text: response.choices[0]?.message?.content ?? '',
      model: MODEL,
      provider: 'openai',
    };
  } else {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: timeoutMs,
    });
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });
    return {
      text: response.content[0]?.type === 'text' ? response.content[0].text : '',
      model: MODEL,
      provider: 'anthropic',
    };
  }
}
