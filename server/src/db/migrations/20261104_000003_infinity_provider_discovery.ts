// Migration: register additional Infinity-owned discovery providers.
// Groq model visibility is review-only. OpenRouter's official model-specific
// pricing catalogue can verify :free routes when both prices are exactly zero.
import type { Db } from '../types.js';

export function up(db: Db): void {
  const insert = db.prepare(`INSERT OR IGNORE INTO infinity_provider_registry (
    provider_id, display_name, api_base_url, documentation_url, pricing_url,
    auth_methods_json, official_domains_json, provider_tier_status, discovery_enabled, region_notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  const providers = [
    ['groq', 'GroqCloud', 'https://api.groq.com/openai/v1',
      'https://console.groq.com/docs/models', 'https://groq.com/pricing',
      '["api_key"]', '["groq.com","console.groq.com","api.groq.com"]', 'restricted_free',
      'Model listing requires an API key. Model-list visibility alone does not prove free-tier eligibility; new models enter Review.'],
    ['openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1',
      'https://openrouter.ai/docs/api-reference/models/list', 'https://openrouter.ai/models',
      '["api_key"]', '["openrouter.ai"]', 'restricted_free',
      'Only model IDs ending :free with zero prompt and completion prices are automatically classified as restricted free; availability and limits may vary.'],
  ] as const;
  for (const row of providers) insert.run(...row);
}

export function down(db: Db): void {
  db.prepare("DELETE FROM infinity_provider_registry WHERE provider_id IN ('groq', 'openrouter')").run();
}
