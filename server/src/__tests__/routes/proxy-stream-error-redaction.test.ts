import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';

const streamChatCompletion = vi.fn();
const fakeProvider = { name: 'fake', chatCompletion: vi.fn(), streamChatCompletion } as any;

vi.mock('../../providers/index.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getProvider: () => fakeProvider,
    resolveProvider: () => fakeProvider,
  };
});

const { createApp } = await import('../../app.js');
const { initDb, getDb, getUnifiedApiKey } = await import('../../db/index.js');
const { encrypt } = await import('../../lib/crypto.js');
const { setRoutingStrategy } = await import('../../services/router.js');

async function post(app: Express, body: unknown, key: string) {
  const server = app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, raw: await response.text() };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function* contentThenError(secret: string) {
  yield { id: 'stream-redaction', object: 'chat.completion.chunk', created: 1, model: 'm', choices: [{ index: 0, delta: { content: 'partial answer' }, finish_reason: null }] };
  yield { error: { message: `upstream rejected Bearer ${secret}; api_key=${secret}` } };
}

describe('Streaming provider error redaction at the gateway boundary', () => {
  let app: Express;
  let key: string;
  const providerSecret = 'gsk_live_stream_error_secret_123456789';

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
    key = getUnifiedApiKey();
    const db = getDb();
    const encrypted = encrypt('synthetic-provider-key');
    db.prepare(`INSERT INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
      VALUES ('groq', 'stream-redaction', ?, ?, ?, 'healthy', 1)`)
      .run(encrypted.encrypted, encrypted.iv, encrypted.authTag);
    setRoutingStrategy('priority');
  });

  beforeEach(() => {
    streamChatCompletion.mockReset();
    getDb().prepare('DELETE FROM requests').run();
    getDb().prepare('DELETE FROM rate_limit_cooldowns').run();
    streamChatCompletion.mockImplementation(() => contentThenError(providerSecret));
  });

  it('redacts credentials from a mid-stream error frame and the persisted request error', async () => {
    const result = await post(app, {
      model: 'groq/compound-mini',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    }, key);

    expect(result.status).toBe(200);
    expect(result.raw).toContain('partial answer');
    expect(result.raw).toContain('stream_error');
    expect(result.raw).not.toContain(providerSecret);
    expect(result.raw).toContain('Bearer [redacted]');

    const rows = getDb().prepare("SELECT error FROM requests WHERE status = 'error'").all() as Array<{ error: string | null }>;
    expect(rows.length).toBe(1);
    expect(rows[0].error).not.toContain(providerSecret);
    expect(rows[0].error).toContain('[redacted]');
  });
});
