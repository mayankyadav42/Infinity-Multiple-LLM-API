import type { Db } from '../db/types.js';
import { decrypt } from '../lib/crypto.js';
import { registerDiscoveredModels } from './builtin-model-discovery.js';
import { evaluateInfinityFreeModelEvidence } from './infinity-free-model-policy.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_MODELS_DOCS = 'https://openrouter.ai/docs/api-reference/models/list';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
const GROQ_MODELS_DOCS = 'https://console.groq.com/docs/models';
const CLOUDFLARE_MODELS_DOCS = 'https://developers.cloudflare.com/workers-ai/models/';
const EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000;

type ProviderId = 'openrouter' | 'groq' | 'cloudflare';

export interface ProviderDiscoveryResult {
  runId: number;
  providerId: ProviderId;
  modelsSeen: number;
  modelsAutoAdded: number;
  modelsSentToReview: number;
  note: string;
}

interface ProviderKeyRow {
  encrypted_key: string;
  iv: string;
  auth_tag: string;
}

interface OpenRouterModel {
  id?: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: { input_modalities?: string[] };
}

interface GroqModel {
  id?: string;
  context_window?: number;
  active?: boolean;
}

interface CloudflareModel {
  name?: string;
  id?: string;
  description?: string;
  task?: string;
  properties?: { context_length?: number };
}

function beginRun(db: Db, providerId: ProviderId): number {
  const result = db.prepare(`INSERT INTO infinity_discovery_runs (provider_id, started_at, status)
    VALUES (?, ?, 'running')`).run(providerId, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

function finishRun(
  db: Db,
  runId: number,
  values: { status: 'succeeded' | 'partial' | 'failed'; seen?: number; added?: number; review?: number; source: string; error?: string },
): void {
  db.prepare(`UPDATE infinity_discovery_runs SET completed_at = ?, status = ?, models_seen = ?,
    models_auto_added = ?, models_sent_to_review = ?, source_reference = ?, error_summary = ? WHERE id = ?`)
    .run(new Date().toISOString(), values.status, values.seen ?? 0, values.added ?? 0,
      values.review ?? 0, values.source, values.error?.slice(0, 500) ?? null, runId);
}

function isDiscoveryEnabled(db: Db, providerId: ProviderId): boolean {
  const row = db.prepare('SELECT discovery_enabled FROM infinity_provider_registry WHERE provider_id = ?').get(providerId) as { discovery_enabled: number } | undefined;
  return row?.discovery_enabled === 1;
}

function enabledKeys(db: Db, providerId: ProviderId): ProviderKeyRow[] {
  return db.prepare(`SELECT encrypted_key, iv, auth_tag FROM api_keys
    WHERE platform = ? AND enabled = 1 ORDER BY id`).all(providerId) as ProviderKeyRow[];
}

function decryptFirstUsableKey(rows: ProviderKeyRow[]): string | null {
  for (const row of rows) {
    try { return decrypt(row.encrypted_key, row.iv, row.auth_tag); } catch { /* try next key */ }
  }
  return null;
}

function insertReviewCandidate(db: Db, input: {
  providerId: ProviderId;
  modelId: string;
  evidenceUrl: string;
  evidenceType: 'official_model_catalog' | 'official_api_response';
  summary: string;
  metadata: Record<string, unknown>;
}): boolean {
  const result = db.prepare(`INSERT OR IGNORE INTO infinity_model_evidence (
    provider_id, model_id, classification, recurring_no_charge, model_specific,
    account_tier, region_scope, evidence_type, evidence_url, evidence_summary,
    verified_at, status, metadata_json, updated_at
  ) VALUES (?, ?, 'unknown', 0, 1, 'not established', 'not established', ?, ?, ?, ?, 'review', ?, CURRENT_TIMESTAMP)`)
    .run(input.providerId, input.modelId, input.evidenceType, input.evidenceUrl,
      input.summary, new Date().toISOString(), JSON.stringify(input.metadata));
  return result.changes > 0;
}

/**
 * OpenRouter publishes model-specific pricing in its official model catalogue.
 * Only IDs explicitly suffixed :free AND carrying zero prompt/completion prices
 * are eligible for automatic publication. Everything else is left out of the
 * free catalogue; this adapter never infers free access from model visibility.
 */
export async function runInfinityOpenRouterDiscovery(db: Db): Promise<ProviderDiscoveryResult> {
  const runId = beginRun(db, 'openrouter');
  try {
    if (!isDiscoveryEnabled(db, 'openrouter')) throw new Error('OpenRouter discovery is disabled in the Infinity provider registry.');
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { 'User-Agent': 'Infinity-Multiple-LLM-API/0.5' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`OpenRouter model catalogue returned HTTP ${response.status}.`);
    const body = await response.json() as { data?: OpenRouterModel[] };
    const models = Array.isArray(body.data) ? body.data : [];
    if (models.length === 0) throw new Error('OpenRouter returned an empty or unrecognized model catalogue.');

    let added = 0;
    let review = 0;
    const qualifyingFreeIds = new Set<string>();
    const now = new Date();
    const verifiedAt = now.toISOString();
    const validUntil = new Date(now.getTime() + EVIDENCE_TTL_MS).toISOString();
    const provider = db.prepare(`SELECT official_domains_json FROM infinity_provider_registry WHERE provider_id = 'openrouter'`)
      .get() as { official_domains_json: string } | undefined;
    const officialDomains = provider ? JSON.parse(provider.official_domains_json) as string[] : [];

    for (const model of models) {
      const modelId = model.id?.trim() ?? '';
      if (!modelId || !modelId.endsWith(':free')) continue;
      const promptPrice = Number(model.pricing?.prompt);
      const completionPrice = Number(model.pricing?.completion);
      const zeroPriced = Number.isFinite(promptPrice) && Number.isFinite(completionPrice)
        && promptPrice === 0 && completionPrice === 0;
      if (!zeroPriced) {
        if (insertReviewCandidate(db, {
          providerId: 'openrouter', modelId, evidenceUrl: OPENROUTER_MODELS_URL,
          evidenceType: 'official_api_response',
          summary: `OpenRouter labels ${modelId} as a free route, but its current pricing fields did not both resolve to zero. Manual review is required.`,
          metadata: { pricing: model.pricing ?? null, contextLength: model.context_length ?? null },
        })) review += 1;
        continue;
      }

      qualifyingFreeIds.add(modelId);
      const evidence = {
        providerId: 'openrouter', modelId, classification: 'restricted_free' as const,
        recurringNoCharge: true, modelSpecific: true,
        evidenceType: 'official_api_response' as const,
        evidenceUrl: OPENROUTER_MODELS_URL, officialEvidenceHosts: officialDomains,
        verifiedAt, validUntil, accountTier: 'OpenRouter account using a :free model route',
        regionScope: 'Subject to upstream model availability and regional access restrictions',
      };
      const decision = evaluateInfinityFreeModelEvidence(evidence, now);
      if (decision.action !== 'auto_add') {
        if (insertReviewCandidate(db, {
          providerId: 'openrouter', modelId, evidenceUrl: OPENROUTER_MODELS_URL,
          evidenceType: 'official_api_response',
          summary: `OpenRouter returned a :free model route, but Infinity's evidence policy requires review: ${decision.reason}.`,
          metadata: { pricing: model.pricing, contextLength: model.context_length ?? null },
        })) review += 1;
        continue;
      }

      const info = db.prepare(`INSERT INTO infinity_model_evidence (
        provider_id, model_id, classification, recurring_no_charge, model_specific,
        account_tier, region_scope, evidence_type, evidence_url, evidence_summary,
        verified_at, valid_until, status, metadata_json, updated_at
      ) VALUES ('openrouter', ?, 'restricted_free', 1, 1, ?, ?, 'official_api_response', ?, ?, ?, ?, 'verified', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider_id, model_id, evidence_url) DO UPDATE SET
        classification = excluded.classification, recurring_no_charge = 1, model_specific = 1,
        account_tier = excluded.account_tier, region_scope = excluded.region_scope,
        evidence_summary = excluded.evidence_summary, verified_at = excluded.verified_at,
        valid_until = excluded.valid_until,
        status = CASE WHEN infinity_model_evidence.status = 'rejected' THEN 'rejected' ELSE 'verified' END,
        metadata_json = excluded.metadata_json, updated_at = CURRENT_TIMESTAMP`)
        .run(modelId, evidence.accountTier, evidence.regionScope, OPENROUTER_MODELS_URL,
          `OpenRouter's official model catalogue identifies ${modelId} as a :free route and reports zero prompt and completion prices. Availability and upstream rate limits may vary.`,
          verifiedAt, validUntil, JSON.stringify({ pricing: model.pricing, contextLength: model.context_length ?? null }));
      if (info.changes === 0) continue;
      const currentEvidence = db.prepare(`SELECT status FROM infinity_model_evidence
        WHERE provider_id = 'openrouter' AND model_id = ? AND evidence_url = ?`).get(modelId, OPENROUTER_MODELS_URL) as { status: string } | undefined;
      if (currentEvidence?.status === 'rejected') continue;

      const catalogue = registerDiscoveredModels(db, 'openrouter', [{
        modelId,
        contextWindow: Number.isInteger(model.context_length) && (model.context_length ?? 0) > 0 ? model.context_length : undefined,
        vision: (model.architecture?.input_modalities ?? []).includes('image'),
      }], { explicit: false });
      const catalogueRow = db.prepare(`SELECT enabled FROM models WHERE platform = 'openrouter' AND model_id = ?`)
        .get(modelId) as { enabled: number } | undefined;
      const published = !catalogue.tombstoned.includes(modelId) && catalogueRow?.enabled === 1;
      db.prepare(`UPDATE infinity_model_evidence SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider_id = 'openrouter' AND model_id = ? AND evidence_url = ? AND status != 'rejected'`)
        .run(published ? 'published' : 'verified', modelId, OPENROUTER_MODELS_URL);
      if (published && (catalogue.created.includes(modelId) || catalogue.existing.includes(modelId))) added += 1;
    }

    // Fail closed: if a previously published free route disappears or its
    // current pricing no longer qualifies, expire its evidence and disable the
    // corresponding inference model so it cannot silently become billable.
    const previouslyPublished = db.prepare(`SELECT model_id FROM infinity_model_evidence
      WHERE provider_id = 'openrouter' AND status = 'published'`).all() as Array<{ model_id: string }>;
    const disableModel = db.prepare(`UPDATE models SET enabled = 0 WHERE platform = 'openrouter' AND model_id = ?`);
    const expireEvidence = db.prepare(`UPDATE infinity_model_evidence SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = 'openrouter' AND model_id = ? AND status = 'published'`);
    for (const prior of previouslyPublished) {
      if (qualifyingFreeIds.has(prior.model_id)) continue;
      expireEvidence.run(prior.model_id);
      disableModel.run(prior.model_id);
    }

    finishRun(db, runId, { status: 'succeeded', seen: models.length, added, review,
      source: 'OpenRouter official /api/v1/models catalogue (model-specific pricing)' });
    return { runId, providerId: 'openrouter', modelsSeen: models.length, modelsAutoAdded: added,
      modelsSentToReview: review, note: 'Only :free models with zero prompt and completion prices are automatically published.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenRouter discovery failure';
    finishRun(db, runId, { status: 'failed', source: OPENROUTER_MODELS_URL, error: message });
    throw error;
  }
}

/** Groq's model-list endpoint establishes model visibility, not free-tier
 * eligibility. Therefore every previously unknown model is routed to Review. */
export async function runInfinityGroqDiscovery(db: Db): Promise<ProviderDiscoveryResult> {
  const runId = beginRun(db, 'groq');
  try {
    if (!isDiscoveryEnabled(db, 'groq')) throw new Error('Groq discovery is disabled in the Infinity provider registry.');
    const apiKey = decryptFirstUsableKey(enabledKeys(db, 'groq'));
    if (!apiKey) throw new Error('Connect an enabled Groq API key before discovery.');
    const response = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Groq model catalogue returned HTTP ${response.status}.`);
    const body = await response.json() as { data?: GroqModel[] };
    const models = Array.isArray(body.data) ? body.data : [];
    if (models.length === 0) throw new Error('Groq returned an empty or unrecognized model catalogue.');

    let review = 0;
    const transaction = db.transaction(() => {
      for (const model of models) {
        const modelId = model.id?.trim() ?? '';
        if (!modelId || model.active === false) continue;
        if (insertReviewCandidate(db, {
          providerId: 'groq', modelId, evidenceUrl: GROQ_MODELS_URL,
          evidenceType: 'official_model_catalog',
          summary: `Groq's authenticated model endpoint lists ${modelId}. This proves model availability only; the account's free-tier eligibility and recurring no-charge terms still require verification.`,
          metadata: { contextWindow: model.context_window ?? null, active: model.active ?? null },
        })) review += 1;
      }
    });
    transaction();
    finishRun(db, runId, { status: 'succeeded', seen: models.length, review,
      source: 'Groq authenticated OpenAI-compatible /models endpoint' });
    return { runId, providerId: 'groq', modelsSeen: models.length, modelsAutoAdded: 0,
      modelsSentToReview: review, note: 'Groq model-list visibility does not prove recurring free access; candidates are sent to Review.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Groq discovery failure';
    finishRun(db, runId, { status: 'failed', source: GROQ_MODELS_URL, error: message });
    throw error;
  }
}


/** Cloudflare account model search is a catalogue endpoint, not proof of a
 * recurring no-charge entitlement. Every discovered model therefore enters
 * Review; the account's Workers AI neuron allowance is tracked separately. */
export async function runInfinityCloudflareDiscovery(db: Db): Promise<ProviderDiscoveryResult> {
  const runId = beginRun(db, 'cloudflare');
  try {
    if (!isDiscoveryEnabled(db, 'cloudflare')) throw new Error('Cloudflare discovery is disabled in the Infinity provider registry.');
    const rows = enabledKeys(db, 'cloudflare');
    let models: CloudflareModel[] = [];
    let lastError = 'No enabled Cloudflare key could list Workers AI models.';
    for (const row of rows) {
      let secret: string;
      try { secret = decrypt(row.encrypted_key, row.iv, row.auth_tag); } catch { continue; }
      const separator = secret.indexOf(':');
      if (separator <= 0 || separator === secret.length - 1) {
        lastError = 'Cloudflare key must use the account_id:api_token format.';
        continue;
      }
      const accountId = secret.slice(0, separator).trim();
      const apiToken = secret.slice(separator + 1).trim();
      if (!/^[a-f0-9]{32}$/i.test(accountId)) {
        lastError = 'Cloudflare account ID in the saved key is not a 32-character hexadecimal ID.';
        continue;
      }
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        lastError = `Cloudflare Workers AI model search returned HTTP ${response.status}.`;
        continue;
      }
      const body = await response.json() as { success?: boolean; result?: CloudflareModel[] };
      if (body.success === false || !Array.isArray(body.result)) {
        lastError = 'Cloudflare returned an unrecognized Workers AI model catalogue response.';
        continue;
      }
      models = body.result;
      break;
    }
    if (models.length === 0) throw new Error(lastError);

    let review = 0;
    const transaction = db.transaction(() => {
      for (const model of models) {
        const modelId = (model.name ?? model.id ?? '').trim();
        if (!modelId) continue;
        if (insertReviewCandidate(db, {
          providerId: 'cloudflare', modelId, evidenceUrl: CLOUDFLARE_MODELS_DOCS,
          evidenceType: 'official_model_catalog',
          summary: `Cloudflare's authenticated Workers AI catalogue lists ${modelId}. Catalogue visibility does not establish the account's recurring free allowance or regional availability; verify the current Workers AI pricing and account entitlement before publication.`,
          metadata: { task: model.task ?? null, contextLength: model.properties?.context_length ?? null, description: model.description ?? null },
        })) review += 1;
      }
    });
    transaction();
    finishRun(db, runId, { status: 'succeeded', seen: models.length, review,
      source: 'Cloudflare authenticated Workers AI account models/search endpoint' });
    return { runId, providerId: 'cloudflare', modelsSeen: models.length, modelsAutoAdded: 0,
      modelsSentToReview: review, note: 'Cloudflare model visibility does not prove free-tier eligibility; all new candidates enter Review. Workers AI neuron quota is account-wide and tracked separately.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Cloudflare discovery failure';
    finishRun(db, runId, { status: 'failed', source: CLOUDFLARE_MODELS_DOCS, error: message });
    throw error;
  }
}

export async function runInfinityProviderDiscovery(db: Db): Promise<ProviderDiscoveryResult[]> {
  const results: ProviderDiscoveryResult[] = [];
  for (const discover of [runInfinityOpenRouterDiscovery, runInfinityGroqDiscovery, runInfinityCloudflareDiscovery]) {
    try { results.push(await discover(db)); }
    catch (error) {
      console.warn(`[infinity-discovery] provider pass failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  return results;
}
