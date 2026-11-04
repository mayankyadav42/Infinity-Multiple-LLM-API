// Add Cloudflare Workers AI as an Infinity discovery source. Model catalogue
// visibility is review-only; it does not prove free-tier entitlement.
import type { Db } from '../types.js';

export function up(db: Db): void {
  db.prepare(`INSERT OR IGNORE INTO infinity_provider_registry (
    provider_id, display_name, api_base_url, documentation_url, pricing_url,
    auth_methods_json, official_domains_json, provider_tier_status, discovery_enabled, region_notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(
    'cloudflare',
    'Cloudflare Workers AI',
    'https://api.cloudflare.com/client/v4',
    'https://developers.cloudflare.com/workers-ai/models/',
    'https://developers.cloudflare.com/workers-ai/platform/pricing/',
    '["api_key"]',
    '["cloudflare.com","developers.cloudflare.com"]',
    'unknown',
    'Authenticated account model catalogue is discovery-only. Workers AI free neuron allocation is account-wide; model visibility is not proof of recurring free eligibility.',
  );
}

export function down(db: Db): void {
  db.prepare("DELETE FROM infinity_provider_registry WHERE provider_id = 'cloudflare'").run();
}
