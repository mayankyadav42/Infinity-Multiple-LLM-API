# Google Gemini vertical slice — implementation and validation

## Existing inherited implementation

The current source already contains the following pieces:

- Provider adapter: `server/src/providers/google.ts`
- Provider registration: `server/src/providers/index.ts`
- Provider key management: `server/src/routes/keys.ts`
- Provider quota observations: `server/src/services/provider-quota.ts`
- Unified OpenAI-compatible inference route: `server/src/routes/proxy.ts`
- Model listing: `server/src/routes/models.ts` and the unified `/v1/models` route
- Encrypted provider key storage: `server/src/lib/crypto.ts`

The key-management API is mounted at `/api/keys` behind dashboard-session authentication. Add a Google key using the dashboard's Providers/Keys UI or the authenticated `POST /api/keys` route with `{ "platform": "google", "key": "<user-owned-key>", "label": "Gemini" }`. The backend encrypts the key before storing it and returns only a masked representation.

The unified inference API is `/v1/chat/completions`. It uses the Infinity/instance API key, not the raw Google key. The provider adapter translates the OpenAI-compatible request into Gemini's native wire format.

## Infinity-specific publication gate

The new `infinity-free-model-policy.ts` module deliberately separates provider model discovery from free-tier eligibility. A discovered model is not automatically publishable until evidence includes:

- a model-specific official HTTPS evidence URL;
- recurring no-charge access (trial credits do not qualify);
- current verification and non-expired validity;
- the applicable account tier; and
- region scope.

The database migration `20261104_000001_infinity_model_evidence.ts` creates the provider registry, evidence ledger, and discovery-run tables. Google is seeded as a restricted-free provider, but no model is seeded as verified free. This is intentional: model-specific free eligibility must be established before publication.

## Manual end-to-end validation (requires a user-owned Gemini API key)

1. Start the backend and complete first-run dashboard setup.
2. Add a Google Gemini API key through the authenticated dashboard.
3. Confirm the key appears masked in the provider list. Never use the reveal endpoint for routine testing.
4. Wait for the provider health/model discovery process or use the dashboard's model-fetch action where available.
5. Confirm a discovered model is visible, but do not label it free solely because the API lists it.
6. Add model-specific official free-tier evidence to the Infinity evidence ledger and evaluate it through the publication policy.
7. Only a current `auto_add` decision may proceed to the verified-free catalogue publication workflow. Unknown, trial-only, stale, paid-only, or region-ambiguous evidence must not be auto-published.
8. Create/use an Infinity unified API key and send a small non-streaming request to `/v1/chat/completions` using the selected Gemini model.
9. Verify request success, token usage where returned by Gemini, quota/rate-limit observations, and request attribution in the dashboard.
10. Repeat with an intentionally invalid key or unavailable model in a test environment to verify safe error reporting and no credential leakage.

## Current limitation

The evidence ledger is wired to a Google-specific live model-list check and the existing model catalogue insertion path. The authenticated Android Review/Provider screens are not yet connected. Live inference remains unverified until tested with a user-provided key in a network-enabled environment. Other providers still need their own authenticated model-list verification adapters before their evidence can trigger automatic publication.
