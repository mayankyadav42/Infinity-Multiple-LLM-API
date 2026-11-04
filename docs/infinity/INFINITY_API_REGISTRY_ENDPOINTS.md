# Infinity provider/model evidence registry API

All endpoints below are mounted under `/api/infinity/catalog` and require a valid dashboard session. They do not accept the unified inference API key.

## `GET /providers`

Returns Infinity's registered providers, official evidence-host allowlists, provider-level tier classification, discovery setting, and counts of models represented in the evidence ledger. No provider credential is returned.

## `GET /review?limit=100`

Returns model evidence currently awaiting review. `limit` is clamped to 1–250.

## `POST /evidence/evaluate`

Validates and stores model-specific free-tier evidence. Example body:

```json
{
  "providerId": "google",
  "modelId": "provider-model-id",
  "classification": "restricted_free",
  "recurringNoCharge": true,
  "modelSpecific": true,
  "evidenceType": "official_pricing",
  "evidenceUrl": "https://ai.google.dev/gemini-api/docs/pricing",
  "evidenceSummary": "Official pricing page confirms the model is eligible for no-charge API access on the free account tier.",
  "verifiedAt": "2026-11-04T00:00:00.000Z",
  "validUntil": "2026-12-04T00:00:00.000Z",
  "accountTier": "free",
  "regionScope": "supported_regions"
}
```

The example model ID and evidence summary are illustrative; do not submit them as factual evidence without checking the provider's current official documentation.

The evidence host must exactly match a provider-specific official-domain allowlist. For Google, an additional authenticated live check uses an enabled, encrypted-at-rest Google API key to confirm that the model appears in Google's model list and supports `generateContent`. Only then is the model inserted into the existing inference model catalogue. No raw provider key is returned by this endpoint. Providers without a live verification adapter remain un-published until their adapter is implemented. Uncertain evidence remains in `review`; paid-only, retired, and trial-only evidence is rejected from the free catalogue.
