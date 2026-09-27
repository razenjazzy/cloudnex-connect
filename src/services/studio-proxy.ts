import { getRuntime } from './runtime-settings';

export type StudioEngine = 'ollama' | 'flowise';

const MAX_PROMPT = 8000;
const FETCH_MS = 60_000;

const joinPath = (base: URL, path: string): string => {
  const root = base.pathname.replace(/\/+$/, '');
  return `${base.origin}${root}${path}`;
};

const parseHttpBase = (raw: string): URL | null => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
};

export const describeStudio = (env: NodeJS.ProcessEnv = process.env) => {
  const ollamaBase = parseHttpBase(getRuntime('OLLAMA_BASE_URL', env));
  const flowiseBase = parseHttpBase(getRuntime('FLOWISE_BASE_URL', env));
  const chatflowId = getRuntime('FLOWISE_CHATFLOW_ID', env).trim();
  return {
    ollama: {
      configured: Boolean(ollamaBase),
      model: getRuntime('OLLAMA_MODEL', env).trim() || 'llama3.2',
    },
    flowise: {
      configured: Boolean(flowiseBase && chatflowId),
    },
  };
};

const readJson = async (res: Response): Promise<Record<string, unknown>> => {
  const body = await res.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
};

const pickText = (body: Record<string, unknown>, fallbacks: string[]): string => {
  for (const key of fallbacks) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  const message = body.message;
  if (message && typeof message === 'object' && typeof (message as { content?: unknown }).content === 'string') {
    return String((message as { content: string }).content);
  }
  return '';
};

export const runStudioPrompt = async (
  engine: StudioEngine,
  prompt: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; engine: StudioEngine; text: string } | { ok: false; error: string; status: number }> => {
  const text = prompt.trim();
  if (!text) return { ok: false, error: 'Prompt is empty.', status: 400 };
  if (text.length > MAX_PROMPT) return { ok: false, error: `Prompt exceeds ${MAX_PROMPT} characters.`, status: 400 };

  if (engine === 'ollama') {
    const base = parseHttpBase(getRuntime('OLLAMA_BASE_URL', env));
    if (!base) return { ok: false, error: 'OLLAMA_BASE_URL is unset. Point it at your Ollama host (e.g. http://127.0.0.1:11434).', status: 503 };
    const model = getRuntime('OLLAMA_MODEL', env).trim() || 'llama3.2';
    const res = await fetchImpl(joinPath(base, '/api/chat'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'user', content: text }] }),
      signal: AbortSignal.timeout(FETCH_MS),
    }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
    if (res instanceof Error) return { ok: false, error: `Ollama request failed: ${res.message}`, status: 502 };
    const body = await readJson(res);
    if (!res.ok) return { ok: false, error: typeof body.error === 'string' ? body.error : `Ollama HTTP ${res.status}`, status: 502 };
    const out = pickText(body, ['response']);
    if (!out) return { ok: false, error: 'Ollama returned no text.', status: 502 };
    return { ok: true, engine, text: out };
  }

  const base = parseHttpBase(getRuntime('FLOWISE_BASE_URL', env));
  const chatflowId = getRuntime('FLOWISE_CHATFLOW_ID', env).trim();
  if (!base || !chatflowId) {
    return { ok: false, error: 'FLOWISE_BASE_URL and FLOWISE_CHATFLOW_ID are required.', status: 503 };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(chatflowId)) {
    return { ok: false, error: 'FLOWISE_CHATFLOW_ID is invalid.', status: 400 };
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const apiKey = getRuntime('FLOWISE_API_KEY', env).trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await fetchImpl(joinPath(base, `/api/v1/prediction/${chatflowId}`), {
    method: 'POST',
    headers,
    body: JSON.stringify({ question: text }),
    signal: AbortSignal.timeout(FETCH_MS),
  }).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
  if (res instanceof Error) return { ok: false, error: `Flowise request failed: ${res.message}`, status: 502 };
  const body = await readJson(res);
  if (!res.ok) return { ok: false, error: typeof body.message === 'string' ? body.message : `Flowise HTTP ${res.status}`, status: 502 };
  const out = pickText(body, ['text', 'answer', 'output']);
  if (!out) return { ok: false, error: 'Flowise returned no text.', status: 502 };
  return { ok: true, engine, text: out };
};
