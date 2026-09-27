import { describe, expect, it, vi } from 'vitest';
import { describeStudio, runStudioPrompt } from '../src/services/studio-proxy';

describe('studio proxy', () => {
  it('fails closed when Ollama is unset', async () => {
    const status = describeStudio({});
    expect(status.ollama.configured).toBe(false);
    const result = await runStudioPrompt('ollama', 'hello', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it('posts the prompt to Ollama /api/chat on the configured origin only', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://127.0.0.1:11434/api/chat');
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('llama3.2');
      expect(body.messages[0].content).toBe('NAV HOME meaning');
      return new Response(JSON.stringify({ message: { content: 'Home menu' } }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await runStudioPrompt('ollama', 'NAV HOME meaning', {
      OLLAMA_BASE_URL: 'http://127.0.0.1:11434/',
    }, fetchImpl);
    expect(result).toEqual({ ok: true, engine: 'ollama', text: 'Home menu' });
  });

  it('posts Flowise prediction with the env chatflow id', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://127.0.0.1:3000/api/v1/prediction/flow-1');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer k');
      return new Response(JSON.stringify({ text: 'ok' }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await runStudioPrompt('flowise', 'hello', {
      FLOWISE_BASE_URL: 'http://127.0.0.1:3000',
      FLOWISE_CHATFLOW_ID: 'flow-1',
      FLOWISE_API_KEY: 'k',
    }, fetchImpl);
    expect(result).toEqual({ ok: true, engine: 'flowise', text: 'ok' });
  });
});
