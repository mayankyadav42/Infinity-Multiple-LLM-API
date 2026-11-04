// Migration: Infinity-owned provider/model free-tier evidence registry
// Created: 2026-11-04
//
// DOWN: reversible (drops Infinity-specific registry tables)
//
// A provider's model-list endpoint is not proof of free API access. This
// registry stores provider metadata separately from model-specific evidence.
// Only current, model-specific, recurring no-charge evidence may be published
// automatically by the Infinity free-catalog policy.

import type { Db } from '../types.js';

export function up(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS infinity_provider_registry (
      provider_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      api_base_url TEXT,
      documentation_url TEXT NOT NULL,
      pricing_url TEXT,
      official_domains_json TEXT NOT NULL DEFAULT '[]',
      auth_methods_json TEXT NOT NULL DEFAULT '["api_key"]',
      provider_tier_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (provider_tier_status IN ('verified_free', 'restricted_free', 'trial_only', 'paid_only', 'unknown')),
      discovery_enabled INTEGER NOT NULL DEFAULT 1 CHECK (discovery_enabled IN (0, 1)),
      region_notes TEXT,
      last_verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS infinity_model_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL REFERENCES infinity_provider_registry(provider_id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      classification TEXT NOT NULL
        CHECK (classification IN ('verified_free', 'restricted_free', 'trial_only', 'paid_only', 'unknown', 'retired')),
      recurring_no_charge INTEGER NOT NULL DEFAULT 0 CHECK (recurring_no_charge IN (0, 1)),
      account_tier TEXT,
      region_scope TEXT,
      evidence_type TEXT NOT NULL
        CHECK (evidence_type IN ('official_pricing', 'official_model_catalog', 'official_rate_limits', 'official_api_response', 'manual_review')),
      evidence_url TEXT NOT NULL,
      evidence_summary TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      valid_until TEXT,
      status TEXT NOT NULL DEFAULT 'review'
        CHECK (status IN ('review', 'verified', 'published', 'rejected', 'expired')),
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider_id, model_id, evidence_url)
    );

    CREATE INDEX IF NOT EXISTS idx_infinity_model_evidence_lookup
      ON infinity_model_evidence(provider_id, model_id, status, valid_until);

    CREATE TABLE IF NOT EXISTS infinity_discovery_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL REFERENCES infinity_provider_registry(provider_id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
      models_seen INTEGER NOT NULL DEFAULT 0,
      models_auto_added INTEGER NOT NULL DEFAULT 0,
      models_sent_to_review INTEGER NOT NULL DEFAULT 0,
      error_summary TEXT,
      source_reference TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_infinity_discovery_runs_provider_time
      ON infinity_discovery_runs(provider_id, started_at DESC);

    INSERT OR IGNORE INTO infinity_provider_registry (
      provider_id, display_name, api_base_url, documentation_url, pricing_url,
      auth_methods_json, official_domains_json, provider_tier_status, discovery_enabled, region_notes
    ) VALUES (
      'google', 'Google Gemini Developer API',
      'https://generativelanguage.googleapis.com/v1beta',
      'https://ai.google.dev/gemini-api/docs',
      'https://ai.google.dev/gemini-api/docs/pricing',
      '["api_key"]', '["ai.google.dev","generativelanguage.googleapis.com","cloud.google.com"]', 'restricted_free', 1,
      'Free-tier availability is model-, account-, and region-dependent. Verify each model; provider-level status does not authorize automatic publication.'
    );
  `);
}

export function down(db: Db): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_infinity_discovery_runs_provider_time;
    DROP TABLE IF EXISTS infinity_discovery_runs;
    DROP INDEX IF EXISTS idx_infinity_model_evidence_lookup;
    DROP TABLE IF EXISTS infinity_model_evidence;
    DROP TABLE IF EXISTS infinity_provider_registry;
  `);
}
