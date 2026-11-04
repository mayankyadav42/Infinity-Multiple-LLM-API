import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, initDb } from '../../db/index.js';
import { encrypt } from '../../lib/crypto.js';
import {
  runInfinityCloudflareDiscovery,
  runInfinityGroqDiscovery,
  runInfinityOpenRouterDiscovery,
} from '../../services/infinity-provider-discovery.js';

const realFetch = globalThis.fetch;

function stubJson(body: unknown, status = 200) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch;
}

function addKey(platform: string, secret = 'sk-test'): void {
  const { encrypted, iv, authTag } = encrypt(secret);
  getDb().prepare(`INSERT INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
    VALUES (?, '', ?, ?, ?, 'healthy', 1)`).run(platform, encrypted, iv, authTag);
}

describe('Infinity provider discovery', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('publishes only OpenRouter :free models with zero prompt and completion prices', async () => {
    stubJson({ data: [
      { id: 'vendor/free-chat:free', context_length: 32000, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'] } },
      { id: 'vendor/paid-chat', context_length: 32000, pricing: { prompt: '0.000001', completion: '0.000002' } },
      { id: 'vendor/suspicious:free', pricing: { prompt: '0', completion: '0.000001' } },
    ] });

    const result = await runInfinityOpenRouterDiscovery(getDb());
    expect(result.modelsAutoAdded).toBe(1);
    expect(result.modelsSentToReview).toBe(1);
    expect(getDb().prepare(`SELECT enabled FROM models WHERE platform = 'openrouter' AND model_id = 'vendor/free-chat:free'`).get()).toEqual({ enabled: 1 });
    expect(getDb().prepare(`SELECT status, classification FROM infinity_model_evidence WHERE provider_id = 'openrouter' AND model_id = 'vendor/free-chat:free'`).get())
      .toEqual({ status: 'published', classification: 'restricted_free' });
    expect(getDb().prepare(`SELECT status FROM infinity_model_evidence WHERE provider_id = 'openrouter' AND model_id = 'vendor/suspicious:free'`).get())
      .toEqual({ status: 'review' });
    expect(getDb().prepare(`SELECT COUNT(*) AS count FROM models WHERE platform = 'openrouter' AND model_id = 'vendor/paid-chat'`).get())
      .toEqual({ count: 0 });
  });

  it('disables a previously published OpenRouter model when it is no longer a zero-priced free route', async () => {
    stubJson({ data: [
      { id: 'vendor/former-free:free', context_length: 8000, pricing: { prompt: '0', completion: '0' } },
    ] });
    await runInfinityOpenRouterDiscovery(getDb());

    stubJson({ data: [
      { id: 'vendor/former-free:free', context_length: 8000, pricing: { prompt: '0.00001', completion: '0.00001' } },
    ] });
    await runInfinityOpenRouterDiscovery(getDb());

    expect(getDb().prepare(`SELECT enabled FROM models WHERE platform = 'openrouter' AND model_id = 'vendor/former-free:free'`).get())
      .toEqual({ enabled: 0 });
    expect(getDb().prepare(`SELECT status FROM infinity_model_evidence WHERE provider_id = 'openrouter' AND model_id = 'vendor/former-free:free'`).get())
      .toEqual({ status: 'expired' });
  });

  it('sends Cloudflare Workers AI catalogue candidates to Review without claiming free eligibility', async () => {
    addKey('cloudflare', `${'a'.repeat(32)}:cf-test-token`);
    stubJson({ success: true, result: [
      { name: '@cf/meta/llama-3.1-8b-instruct', task: 'Text Generation', properties: { context_length: 131072 } },
    ] });

    const result = await runInfinityCloudflareDiscovery(getDb());
    expect(result.modelsAutoAdded).toBe(0);
    expect(result.modelsSentToReview).toBe(1);
    expect(getDb().prepare(`SELECT status, classification FROM infinity_model_evidence WHERE provider_id = 'cloudflare' AND model_id = '@cf/meta/llama-3.1-8b-instruct'`).get())
      .toEqual({ status: 'review', classification: 'unknown' });
    expect(getDb().prepare(`SELECT COUNT(*) AS count FROM models WHERE platform = 'cloudflare' AND model_id = '@cf/meta/llama-3.1-8b-instruct'`).get())
      .toEqual({ count: 0 });
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/accounts/');
  });

  it('sends Groq model-list candidates to Review and never auto-publishes them', async () => {
    addKey('groq');
    stubJson({ data: [{ id: 'llama-3.3-70b-versatile', context_window: 128000, active: true }] });

    const result = await runInfinityGroqDiscovery(getDb());
    expect(result.modelsAutoAdded).toBe(0);
    expect(result.modelsSentToReview).toBe(1);
    expect(getDb().prepare(`SELECT status, classification FROM infinity_model_evidence WHERE provider_id = 'groq' AND model_id = 'llama-3.3-70b-versatile'`).get())
      .toEqual({ status: 'review', classification: 'unknown' });
    expect(getDb().prepare(`SELECT COUNT(*) AS count FROM models WHERE platform = 'groq' AND model_id = 'llama-3.3-70b-versatile'`).get())
      .toEqual({ count: 0 });
  });
});
