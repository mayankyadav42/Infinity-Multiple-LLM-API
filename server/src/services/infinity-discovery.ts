import type { Db } from '../db/types.js';
import { decrypt } from '../lib/crypto.js';
import { runInfinityProviderDiscovery } from './infinity-provider-discovery.js';

const GOOGLE_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GOOGLE_MODELS_DOCS = 'https://ai.google.dev/gemini-api/docs/models';
const MAX_PAGES = 10;
const PAGE_SIZE = 1000;

export interface InfinityDiscoveryResult {
  runId: number;
  providerId: 'google';
  modelsSeen: number;
  modelsSentToReview: number;
  modelsAutoAdded: 0;
}

/**
 * Discover Google model identifiers using the user's own API key. This is
 * deliberately a candidate-discovery pass, not a free-tier verifier: models
 * absent from the evidence registry are queued for review, never published.
 */
export async function runInfinityGoogleDiscovery(db: Db): Promise<InfinityDiscoveryResult> {
  const startedAt = new Date().toISOString();
  const run = db.prepare(`INSERT INTO infinity_discovery_runs (provider_id, started_at, status)
    VALUES ('google', ?, 'running')`).run(startedAt);
  const runId = Number(run.lastInsertRowid);

  try {
    const keys = db.prepare(`SELECT encrypted_key, iv, auth_tag FROM api_keys
      WHERE platform = 'google' AND enabled = 1 ORDER BY id`).all() as Array<{
        encrypted_key: string; iv: string; auth_tag: string;
      }>;
    if (keys.length === 0) throw new Error('Connect an enabled Google Gemini API key before discovery.');

    let discovered: Array<{ name?: string; supportedGenerationMethods?: string[] }> = [];
    let lastError = 'No enabled Google key could list models.';
    for (const row of keys) {
      let apiKey: string;
      try { apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag); } catch { continue; }
      let pageToken: string | undefined;
      const current: typeof discovered = [];
      let failed = false;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const url = new URL(GOOGLE_MODELS_URL);
        url.searchParams.set('pageSize', String(PAGE_SIZE));
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        let response: Response;
        try {
          response = await fetch(url, {
            headers: { 'x-goog-api-key': apiKey },
            signal: AbortSignal.timeout(12_000),
          });
        } catch {
          lastError = 'Google model discovery network or timeout failure.';
          failed = true;
          break;
        }
        if (!response.ok) {
          lastError = `Google model discovery returned HTTP ${response.status}.`;
          failed = true;
          break;
        }
        const body = await response.json() as { models?: typeof discovered; nextPageToken?: string };
        current.push(...(body.models ?? []));
        pageToken = body.nextPageToken;
        if (!pageToken) break;
      }
      if (!failed && current.length > 0) { discovered = current; break; }
    }
    if (discovered.length === 0) throw new Error(lastError);

    const eligible = discovered.filter(model =>
      (model.supportedGenerationMethods ?? []).includes('generateContent'),
    );
    let sentToReview = 0;
    const insert = db.prepare(`INSERT OR IGNORE INTO infinity_model_evidence (
      provider_id, model_id, classification, recurring_no_charge, model_specific,
      account_tier, region_scope, evidence_type, evidence_url, evidence_summary,
      verified_at, status, metadata_json, updated_at
    ) VALUES ('google', ?, 'unknown', 0, 0, 'not established', 'not established',
      'official_model_catalog', ?, ?, ?, 'review', ?, CURRENT_TIMESTAMP)`);

    const addCandidates = db.transaction(() => {
      for (const model of eligible) {
        const modelId = (model.name ?? '').replace(/^models\//i, '').trim();
        if (!modelId) continue;
        const trusted = db.prepare(`SELECT 1 FROM infinity_model_evidence
          WHERE provider_id = 'google' AND model_id = ? AND status IN ('verified', 'published') LIMIT 1`)
          .get(modelId);
        if (trusted) continue;
        const info = insert.run(
          modelId,
          GOOGLE_MODELS_DOCS,
          `Google lists ${modelId} and supports generateContent. This confirms API visibility only; recurring free-tier eligibility, account tier and region still require evidence.`,
          new Date().toISOString(),
          JSON.stringify({ supportedGenerationMethods: model.supportedGenerationMethods ?? [] }),
        );
        if (info.changes > 0) sentToReview += 1;
      }
    });
    addCandidates();

    db.prepare(`UPDATE infinity_discovery_runs SET completed_at = ?, status = 'succeeded',
      models_seen = ?, models_sent_to_review = ?, source_reference = ? WHERE id = ?`)
      .run(new Date().toISOString(), eligible.length, sentToReview,
        'Google Generative Language API models.list', runId);

    return { runId, providerId: 'google', modelsSeen: eligible.length,
      modelsSentToReview: sentToReview, modelsAutoAdded: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown discovery failure';
    db.prepare(`UPDATE infinity_discovery_runs SET completed_at = ?, status = 'failed', error_summary = ? WHERE id = ?`)
      .run(new Date().toISOString(), message.slice(0, 500), runId);
    throw error;
  }
}

let scheduledRunActive = false;
export function startInfinityDiscoveryScheduler(db: Db, scheduler: {
  every(ms: number, fn: () => void | Promise<void>, opts?: { name?: string }): () => void;
  after(ms: number, fn: () => void | Promise<void>): () => void;
}): () => void {
  const run = async () => {
    if (scheduledRunActive) return;
    scheduledRunActive = true;
    try {
      try {
        const google = await runInfinityGoogleDiscovery(db);
        console.log(`[infinity-discovery] Google: ${google.modelsSeen} models scanned, ${google.modelsSentToReview} queued for review`);
      } catch (error) {
        console.warn(`[infinity-discovery] Google discovery skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
      const additional = await runInfinityProviderDiscovery(db);
      for (const result of additional) {
        console.log(`[infinity-discovery] ${result.providerId}: ${result.modelsSeen} models scanned, ${result.modelsAutoAdded} auto-added, ${result.modelsSentToReview} queued for review`);
      }
    } catch (error) {
      console.warn(`[infinity-discovery] additional scheduled discovery skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      scheduledRunActive = false;
    }
  };
  const cancelBoot = scheduler.after(60_000, run);
  const cancelInterval = scheduler.every(24 * 60 * 60 * 1000, run, { name: 'infinity-provider-discovery' });
  return () => { cancelBoot(); cancelInterval(); };
}
