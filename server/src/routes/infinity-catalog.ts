import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { decrypt } from '../lib/crypto.js';
import { registerDiscoveredModels } from '../services/builtin-model-discovery.js';
import { runInfinityGoogleDiscovery } from '../services/infinity-discovery.js';
import { runInfinityCloudflareDiscovery, runInfinityGroqDiscovery, runInfinityOpenRouterDiscovery } from '../services/infinity-provider-discovery.js';
import {
  evaluateInfinityFreeModelEvidence,
  type InfinityFreeModelEvidence,
} from '../services/infinity-free-model-policy.js';

export const infinityCatalogRouter = Router();

const evidenceSchema = z.object({
  providerId: z.string().trim().min(1).max(80),
  modelId: z.string().trim().min(1).max(240),
  classification: z.enum(['verified_free', 'restricted_free', 'trial_only', 'paid_only', 'unknown', 'retired']),
  recurringNoCharge: z.boolean(),
  modelSpecific: z.boolean(),
  evidenceType: z.enum(['official_pricing', 'official_model_catalog', 'official_rate_limits', 'official_api_response', 'manual_review']),
  evidenceUrl: z.string().url().max(2048),
  evidenceSummary: z.string().trim().min(8).max(2000),
  verifiedAt: z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
  accountTier: z.string().trim().max(120).nullable().optional(),
  regionScope: z.string().trim().max(240).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Infinity-specific registry APIs are dashboard-session gated by app.ts.
// Provider credentials are never returned from these routes.
infinityCatalogRouter.get('/providers', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.provider_id, p.display_name, p.api_base_url, p.documentation_url,
      p.pricing_url, p.auth_methods_json, p.official_domains_json, p.provider_tier_status,
      p.discovery_enabled, p.region_notes, p.last_verified_at,
      COUNT(DISTINCT e.model_id) AS evidence_model_count,
      SUM(CASE WHEN e.status = 'review' THEN 1 ELSE 0 END) AS review_count,
      SUM(CASE WHEN e.status = 'verified' THEN 1 ELSE 0 END) AS verified_count,
      SUM(CASE WHEN e.status = 'published' THEN 1 ELSE 0 END) AS published_count
    FROM infinity_provider_registry p
    LEFT JOIN infinity_model_evidence e ON e.provider_id = p.provider_id
    GROUP BY p.provider_id
    ORDER BY p.display_name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;

  res.json({
    providers: rows.map(row => ({
      ...row,
      auth_methods: safeJsonArray(row.auth_methods_json),
      official_evidence_hosts: safeJsonArray(row.official_domains_json),
      discovery_enabled: Boolean(row.discovery_enabled),
    })),
  });
});

infinityCatalogRouter.get('/review', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
  const db = getDb();
  const rows = db.prepare(`
    SELECT e.*, p.display_name AS provider_name
    FROM infinity_model_evidence e
    JOIN infinity_provider_registry p ON p.provider_id = e.provider_id
    WHERE e.status = 'review'
    ORDER BY e.verified_at DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
  res.json({ items: rows.map(parseEvidenceRow) });
});

infinityCatalogRouter.post('/evidence/evaluate', async (req, res) => {
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { message: parsed.error.issues.map(issue => issue.message).join(', ') } });
    return;
  }

  const db = getDb();
  const provider = db.prepare('SELECT provider_id, official_domains_json FROM infinity_provider_registry WHERE provider_id = ?')
    .get(parsed.data.providerId) as { provider_id: string; official_domains_json: string } | undefined;
  if (!provider) {
    res.status(404).json({ error: { message: 'Provider is not registered in the Infinity provider registry' } });
    return;
  }

  const evidence: InfinityFreeModelEvidence = {
    providerId: parsed.data.providerId,
    modelId: parsed.data.modelId,
    classification: parsed.data.classification,
    recurringNoCharge: parsed.data.recurringNoCharge,
    modelSpecific: parsed.data.modelSpecific,
    evidenceType: parsed.data.evidenceType,
    evidenceUrl: parsed.data.evidenceUrl,
    officialEvidenceHosts: safeJsonArray(provider.official_domains_json),
    verifiedAt: parsed.data.verifiedAt,
    validUntil: parsed.data.validUntil,
    accountTier: parsed.data.accountTier,
    regionScope: parsed.data.regionScope,
  };
  let decision = evaluateInfinityFreeModelEvidence(evidence);
  let status: 'review' | 'verified' | 'published' | 'rejected' = decision.action === 'auto_add'
    ? 'verified'
    : decision.action === 'exclude' ? 'rejected' : 'review';
  let catalogueResult: { created: string[]; existing: string[]; tombstoned: string[] } | null = null;

  db.prepare(`
    INSERT INTO infinity_model_evidence (
      provider_id, model_id, classification, recurring_no_charge, model_specific, account_tier,
      region_scope, evidence_type, evidence_url, evidence_summary, verified_at,
      valid_until, status, metadata_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(provider_id, model_id, evidence_url) DO UPDATE SET
      classification = excluded.classification,
      recurring_no_charge = excluded.recurring_no_charge,
      model_specific = excluded.model_specific,
      account_tier = excluded.account_tier,
      region_scope = excluded.region_scope,
      evidence_type = excluded.evidence_type,
      evidence_summary = excluded.evidence_summary,
      verified_at = excluded.verified_at,
      valid_until = excluded.valid_until,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    parsed.data.providerId,
    parsed.data.modelId,
    parsed.data.classification,
    parsed.data.recurringNoCharge ? 1 : 0,
    parsed.data.modelSpecific ? 1 : 0,
    parsed.data.accountTier ?? null,
    parsed.data.regionScope ?? null,
    parsed.data.evidenceType,
    parsed.data.evidenceUrl,
    parsed.data.evidenceSummary,
    parsed.data.verifiedAt,
    parsed.data.validUntil ?? null,
    status,
    JSON.stringify(parsed.data.metadata ?? {}),
  );

  // The first live publication adapter is Google Gemini. We verify that the
  // model is actually listed by Google's authenticated API and supports
  // generateContent before inserting it into the inference catalogue.
  if (decision.action === 'auto_add' && parsed.data.providerId === 'google') {
    const liveCheck = await verifyGoogleModelAvailability(db, parsed.data.modelId);
    if (!liveCheck.available) {
      decision = { action: 'review', reason: liveCheck.reason };
      status = 'review';
      db.prepare(`UPDATE infinity_model_evidence SET status = 'review', updated_at = CURRENT_TIMESTAMP
        WHERE provider_id = ? AND model_id = ? AND evidence_url = ?`)
        .run(parsed.data.providerId, parsed.data.modelId, parsed.data.evidenceUrl);
    } else {
      const metadata = parsed.data.metadata ?? {};
      const contextWindow = typeof metadata.contextWindow === 'number' && Number.isInteger(metadata.contextWindow) && metadata.contextWindow > 0
        ? metadata.contextWindow : undefined;
      const normalizedModelId = normalizeGoogleModelId(parsed.data.modelId);
      catalogueResult = registerDiscoveredModels(db, 'google', [{
        modelId: normalizedModelId,
        contextWindow,
        vision: metadata.supportsVision === true,
      }], { explicit: false });
      // Respect an operator's prior removal. The evidence remains verified,
      // but an automatic discovery pass must not silently resurrect a model
      // the user deliberately tombstoned.
      status = catalogueResult.tombstoned.includes(normalizedModelId) ? 'verified' : 'published';
      // Resolve every outstanding catalogue-only review row for this exact
      // model once stronger pricing evidence and the authenticated API check
      // have passed. Keep all evidence rows for provenance, but avoid leaving a
      // stale duplicate in the user's Review queue.
      db.prepare(`UPDATE infinity_model_evidence SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider_id = ? AND model_id = ? AND status IN ('review', 'verified')`)
        .run(status, parsed.data.providerId, parsed.data.modelId);
    }
  }

  res.status(201).json({
    decision,
    evidenceStatus: status,
    eligibleForVerifiedFreeCatalog: status === 'published',
    catalogueResult,
    note: status === 'published'
      ? 'Evidence passed Infinity policy and the authenticated Google model-list check. The model is present in the inference catalogue.'
      : catalogueResult?.tombstoned.length
        ? 'Evidence is verified, but the model was previously removed by the operator and has not been re-added.'
        : 'This model has not been automatically published to the verified-free catalogue.',
  });
});

// Read the complete Infinity evidence catalogue, including verified and published rows.
infinityCatalogRouter.get('/models', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const allowed = new Set(['review', 'verified', 'published', 'rejected', 'expired']);
  if (status && !allowed.has(status)) {
    res.status(400).json({ error: { message: 'Invalid evidence status' } });
    return;
  }
  const rows = getDb().prepare(`
    SELECT e.*, p.display_name AS provider_name
    FROM infinity_model_evidence e
    JOIN infinity_provider_registry p ON p.provider_id = e.provider_id
    ${status ? 'WHERE e.status = ?' : ''}
    ORDER BY e.updated_at DESC LIMIT 500
  `).all(...(status ? [status] : [])) as Array<Record<string, unknown>>;
  res.json({ items: rows.map(parseEvidenceRow) });
});

infinityCatalogRouter.get('/runs', (_req, res) => {
  const rows = getDb().prepare(`
    SELECT id, provider_id, started_at, completed_at, status, models_seen,
      models_auto_added, models_sent_to_review, error_summary, source_reference
    FROM infinity_discovery_runs ORDER BY id DESC LIMIT 50
  `).all();
  res.json({ runs: rows });
});

// Provider-backed discovery: Google model-list visibility is catalog evidence,
// NOT free-tier evidence. New/unknown models therefore enter Review. Existing
// verified/published evidence is never downgraded by a routine discovery pass.
infinityCatalogRouter.post('/discover/google', async (_req, res) => {
  try {
    const result = await runInfinityGoogleDiscovery(getDb());
    res.json({ ...result, message: 'Discovery completed. Model-list visibility does not prove free access; unverified models were sent to Review.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown discovery failure';
    res.status(502).json({ error: { message } });
  }
});

infinityCatalogRouter.post('/discover/openrouter', async (_req, res) => {
  try {
    const result = await runInfinityOpenRouterDiscovery(getDb());
    res.json({ ...result, message: result.note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenRouter discovery failure';
    res.status(502).json({ error: { message } });
  }
});

infinityCatalogRouter.post('/discover/groq', async (_req, res) => {
  try {
    const result = await runInfinityGroqDiscovery(getDb());
    res.json({ ...result, message: result.note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Groq discovery failure';
    res.status(502).json({ error: { message } });
  }
});

infinityCatalogRouter.post('/discover/cloudflare', async (_req, res) => {
  try {
    const result = await runInfinityCloudflareDiscovery(getDb());
    res.json({ ...result, message: result.note });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Cloudflare discovery failure';
    res.status(502).json({ error: { message } });
  }
});

infinityCatalogRouter.post('/review/:id/dismiss', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: { message: 'Invalid evidence id' } });
    return;
  }
  const info = getDb().prepare(`UPDATE infinity_model_evidence SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'review'`).run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: { message: 'Review item not found or already processed' } });
    return;
  }
  res.json({ success: true, status: 'rejected' });
});

function normalizeGoogleModelId(modelId: string): string {
  return modelId.replace(/^models\//i, '').trim();
}

async function verifyGoogleModelAvailability(
  db: ReturnType<typeof getDb>,
  modelId: string,
): Promise<{ available: true } | { available: false; reason: string }> {
  const keys = db.prepare(`SELECT encrypted_key, iv, auth_tag FROM api_keys
    WHERE platform = 'google' AND enabled = 1 ORDER BY id`).all() as Array<{
      encrypted_key: string; iv: string; auth_tag: string;
    }>;
  if (keys.length === 0) return { available: false, reason: 'google_provider_key_required_for_live_model_verification' };

  const expected = normalizeGoogleModelId(modelId);
  for (const row of keys) {
    let apiKey: string;
    try { apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag); }
    catch { continue; }

    let pageToken: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        return { available: false, reason: 'google_model_list_check_network_or_timeout_failure' };
      }
      if (response.status === 401 || response.status === 403) break;
      if (!response.ok) return { available: false, reason: `google_model_list_check_http_${response.status}` };
      const body = await response.json() as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        nextPageToken?: string;
      };
      const match = (body.models ?? []).find(model =>
        normalizeGoogleModelId(model.name ?? '') === expected
        && (model.supportedGenerationMethods ?? []).includes('generateContent'),
      );
      if (match) return { available: true };
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }
  }
  return { available: false, reason: 'model_not_found_or_generate_content_not_supported_by_google_api' };
}

function safeJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseEvidenceRow(row: Record<string, unknown>): Record<string, unknown> {
  let metadata: Record<string, unknown> = {};
  if (typeof row.metadata_json === 'string') {
    try {
      const parsed: unknown = JSON.parse(row.metadata_json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    } catch { /* malformed legacy metadata remains an empty object */ }
  }
  return { ...row, recurring_no_charge: Boolean(row.recurring_no_charge), model_specific: Boolean(row.model_specific), metadata };
}
