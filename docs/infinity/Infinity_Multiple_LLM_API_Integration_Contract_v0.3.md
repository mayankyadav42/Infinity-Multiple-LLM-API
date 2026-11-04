# Infinity Multiple LLM API — Integration Contract v0.3

**Purpose:** Define the stable contract every provider integration must satisfy before it can be enabled in Infinity.

## 1. Design principle

Provider-specific complexity stays inside an adapter. The rest of Infinity works with normalized provider, model, authentication, usage, quota, health and error records. A provider's presence in code does not automatically make it enabled or free.

## 2. Provider adapter contract

Every inference adapter should implement the following logical operations (some providers may explicitly report an operation as unsupported):

| Operation | Required behavior |
|---|---|
| `validateCredential` | Validate the supplied credential without exposing it in logs; return valid/invalid/indeterminate and a safe reason. |
| `listModels` | Return exact upstream model IDs and any provider-supplied metadata. Must distinguish unsupported from empty result. |
| `chat` | Execute a non-streaming chat request and normalize the response. |
| `streamChat` | Stream normalized chunks; support cancellation and upstream disconnect. |
| `capabilities` | Declare supported modalities and API features; unknown values remain unknown, not assumed true. |
| `parseRateLimits` | Parse documented/observed response headers and retry hints into normalized observations. |
| `fetchAccountUsage` | Optional official usage/quota probe. Must identify the source endpoint and units. |
| `healthCheck` | Safe, low-cost check with timeout and no accidental paid model generation where possible. |

Adapters should also declare supported request features: tools/function calling, streaming, JSON/schema mode, vision, audio, embeddings, context length and maximum output tokens. A feature is `supported`, `unsupported`, or `unknown` until tested.

## 3. Normalized error contract

Every adapter maps upstream errors to:

- `category`: authentication, permission, model_not_found, rate_limited, quota_exhausted, billing_required, invalid_request, timeout, unavailable, server_error, unknown;
- `upstream_status` and safe provider error code;
- `retryable` boolean;
- `retry_after_ms` when explicitly supplied or reliably parsed;
- `quota_observation` when the response carries a genuine limit signal;
- `safe_message` suitable for UI and logs.

Do not retry authentication failures, invalid model IDs or billing-required responses as if they were transient. Respect Retry-After and clamp untrusted delays. Do not silently substitute a different model unless the caller explicitly permits fallback.

## 4. Provider capability and trust states

Provider lifecycle state:

- `candidate` — discovered but not reviewed;
- `verified` — required checks passed;
- `active` — user connected and enabled;
- `degraded` — currently failing or partially available;
- `paused` — disabled by user or policy;
- `retired` — provider endpoint/service discontinued.

Free-tier state is independent:

- `verified_recurring_free`;
- `verified_restricted_free`;
- `trial_or_promo`;
- `paid`;
- `unknown`;
- `retired_or_discontinued`.

A provider can be active but paid, or verified-free but not yet connected. Do not collapse these states into one `is_free` boolean.

## 5. Model discovery and review pipeline

1. Discover a provider/model from an official source or a configured catalog source.
2. Normalize provider identity and exact model ID.
3. Deduplicate by provider ID + upstream model ID + endpoint/protocol scope.
4. Collect evidence for API availability, pricing/free tier, restrictions and region.
5. Run safe metadata/health checks where possible; avoid generation calls that could incur charges.
6. Classify free status and confidence.
7. Auto-register only verified recurring-free or verified restricted-free models according to Infinity policy.
8. Put unknown, trial-only, conflicting or potentially paid entries into Review.
9. Reverify on schedule and on provider/model change events.
10. Mark retired models unavailable while retaining historical usage records.

A model listing endpoint alone is not sufficient evidence of free access. A zero price in a catalog is not sufficient if the provider requires paid credits or billing activation.

## 6. Quota data contract

Each quota observation must include:

- provider ID and credential/account scope;
- quota pool ID (account-wide, key-wide, model-specific, endpoint-specific);
- metric and unit (`requests`, `tokens`, `credits`, `characters`, `images`, etc.);
- limit and remaining values, each nullable;
- reset timestamp and reset strategy, each nullable/unknown when not exposed;
- source (`official_api`, `response_header`, `error_response`, `gateway_counter`, `documentation`, `manual`);
- confidence and freshness timestamp;
- evidence endpoint or documentation reference;
- notes describing whether the observation is account-wide or only applies to one request/model.

Never combine unlike units. Never sum shared-pool limits across models. Gateway counters must be labeled as Infinity-observed usage and may not represent calls made outside Infinity.

## 7. Authentication contract

Supported credential types:

- API key / bearer token;
- OAuth access + refresh token, only for providers with official supported OAuth;
- keyless/anonymous access where explicitly permitted.

For OAuth, use authorization code flow with PKCE where appropriate, unpredictable `state`, exact redirect URI matching, least-privilege scopes, encrypted token storage, refresh-token rotation handling and a disconnect/revoke path. Never collect provider passwords.

Credential records must contain metadata and encrypted secret material separately. Secrets must never appear in API responses, logs, analytics, crash reports or exported diagnostics. Encryption keys must not be committed to GitHub. Remote deployments require TLS and server-side secret protection; Android local credentials should use Android Keystore-backed protection.

## 8. Minimum adapter conformance test suite

Before an adapter is marked verified:

1. valid credential accepted;
2. invalid credential rejected safely;
3. model list parsed without inventing model IDs;
4. one low-cost/safe completion tested where possible;
5. streaming tested where supported;
6. client cancellation propagates upstream;
7. timeout behavior tested;
8. 401/403/404/429/5xx normalized correctly;
9. Retry-After parsing tested;
10. quota headers parsed only when documented or observed;
11. tool calling / vision / JSON mode tested only when declared;
12. logs and error payloads checked for credential leakage.

## 9. Suggested initial engineering order

1. Stabilize the shared adapter interface and normalized error contract.
2. Implement provider registry metadata and lifecycle states.
3. Port the OpenAI-compatible adapter and a small representative set of dedicated adapters.
4. Build provider credential vault and authentication records.
5. Port quota observations and show source/confidence/freshness.
6. Build discovery evidence and review queue.
7. Add provider integrations incrementally based on user value and verified free access.

## 10. Out of scope for the first release

- Building a general conversational agent or voice assistant.
- Search, scraping, image generation, TTS and other non-LLM tool integrations unless required for provider management itself.
- Automatically creating provider accounts or bypassing provider signup/verification.
- Claiming exhaustive discovery of every provider worldwide.
- Routing to paid models by default or spending trial credits without explicit user control.
