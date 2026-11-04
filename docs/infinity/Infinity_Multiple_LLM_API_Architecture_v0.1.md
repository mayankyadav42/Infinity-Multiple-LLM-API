# Infinity Multiple LLM API — Architecture Specification v0.1

**Status:** Planning baseline after Phase 1 source audit  
**Date:** 3 November 2026  
**Product boundary:** Android control panel + provider/credential management + free-model discovery + quota monitoring + unified API gateway. A separate chat/voice agent application is out of scope for this product version.

## 1. Architecture principles

1. Android is the primary user interface, not the permanent gateway host.
2. The same gateway software should run locally or on a remote server.
3. Provider credentials are stored and used by the gateway that owns them, encrypted at rest.
4. The model catalog is Infinity-owned and independent of the original FreeLLMAPI catalog service.
5. Verified free access is evidence-based. Unknown is not treated as free.
6. Provider-reported quota and Infinity-observed usage are different data classes and must never be presented as the same thing.
7. Provider adapters are modular. A provider can be discovered and catalogued before its API integration is marked production-ready.
8. One provider may expose several capabilities; the registry must not treat every connected service as a chat LLM.

## 2. Deployment model

### A. Local gateway

- Gateway runs on a user-owned PC, home server, mini-PC, NAS or similar always-on local machine.
- Android app connects over the local network using a paired gateway URL.
- Provider keys remain on that local gateway and are encrypted there.
- This avoids requiring Termux, root access or an Android background server process.

### B. Remote gateway

- Gateway runs on a VPS or other user-controlled remote server.
- Android app connects over HTTPS.
- Provider keys remain encrypted on that server.
- Server deployment requires TLS, an explicit hostname allowlist, firewall rules and a protected admin session.

### C. Hybrid control panel

- Android can save more than one gateway connection profile (for example, Home Gateway and Remote Gateway).
- User selects which gateway to manage/connect to.
- Each gateway has its own provider credentials, model catalog cache, usage history and settings.
- Switching the Android app between gateways does not silently copy or synchronize provider secrets or usage history. A deliberate, authenticated migration/export feature can be added later.
- The Android app can display connection status and last synchronization time for each saved gateway.

**Important:** Hybrid means the same product can be used with a local or remote gateway. It does not mean the phone must host a persistent gateway, and it does not imply automatic database replication between gateways.

## 3. Recommended software baseline

### Gateway/backend

- Retain the existing TypeScript + Node.js backend as the starting point.
- Retain Express routing and the provider adapter contract where code passes audit.
- Use SQLite for the initial single-owner deployment, with schema migrations and automated backups.
- Keep gateway services deployment-neutral: no business logic should depend on whether the gateway is local or remote.
- Re-evaluate database choice only if multi-user hosted service becomes an actual scope requirement.

### Android client

- The source archive's current UI is React + Vite; it contains no native Android module.
- Working recommendation: evaluate a React + Capacitor Android shell first, because it allows reuse of the existing TypeScript UI foundations while packaging an installable Android app.
- This would be an Android application with a web-rendered React interface and native bridges where needed; it is not the same as a fully native Jetpack Compose UI.
- Keep the app's gateway API client independent of UI framework so Kotlin/Jetpack Compose remains a viable alternative if the mobile UX or native integration requirements justify it.
- Do not start Android implementation until the mobile screen flow and framework choice are reviewed.

## 4. Logical system components

### Android application

- Gateway connection profiles and pairing
- Overview dashboard
- Provider/account manager
- Credential management and connection tests
- Model explorer and filters
- Quota and usage dashboard
- Discovery inbox and review actions
- Unified API key management
- Notifications
- Simple/Advanced Mode switch and settings

### Gateway services

1. **Provider Registry:** provider identity, endpoints, auth methods, region support and capabilities.
2. **Credential Vault:** encrypted API keys and OAuth tokens, rotation and revocation.
3. **Provider Adapter Runtime:** provider-native API translation, timeouts, validation and streaming.
4. **Model Registry:** canonical model IDs, provider-specific IDs, modalities, capabilities, lifecycle and free-tier evidence.
5. **Discovery Engine:** scheduled catalog checks, official source updates and review candidates.
6. **Free-Tier Verifier:** source/evidence rules and verified/restricted/trial/unknown/paid status.
7. **Quota Collector:** official usage API probes, rate-limit headers, reset information and provider error hints.
8. **Usage Ledger:** requests and tokens observed by Infinity, including actual-versus-estimated provenance.
9. **Router:** provider/model selection, health checks, quota headroom, retries, cooldowns and fallback.
10. **Unified API:** OpenAI-compatible interface initially, with streaming and standard model listing.
11. **Notification Service:** quota warnings, reset information, new model/provider alerts and lifecycle changes.
12. **Admin/API Security:** dashboard sessions, gateway API keys, access scopes, audit trail and rate limits.

## 5. Provider and model registry

### Provider record

Suggested fields:

- `provider_id`, `display_name`, `official_website`, `signup_url`, `console_url`, `docs_url`
- `api_base_urls`, `protocols`, `auth_methods`
- `capabilities`: chat, streaming, tools, vision, embeddings, image, audio, rerank, search
- `supported_regions`, `region_restrictions`, `account_verification_requirements`
- `payment_method_required`, `free_tier_available`, `free_tier_conditions`
- `quota_sources`, `key_validation_support`, `health_check_policy`
- `lifecycle_status`: active, limited, paused, retired, under_review
- `last_verified_at`, `evidence_sources`, `confidence`

### Model record

Suggested fields:

- `model_id` (Infinity canonical identifier), `provider_id`, `provider_model_id`
- `display_name`, `description`, `capabilities`, `modalities`, `context_window`
- `protocol`, `streaming`, `tool_calling`, `vision`, `structured_output`
- `pricing` by input/output or provider-native unit when available
- `free_tier_status`: verified_free, restricted_free, trial_credit, unknown, paid, retired
- `free_tier_conditions`: region, account class, daily/monthly allotment, card requirement and expiry
- `evidence_url`, `evidence_type`, `checked_at`, `confidence`, `last_tested_at`
- `availability_status`: available, degraded, unavailable, unverified

### Automatic registration policy

- Verified recurring free access: auto-add.
- Free but restricted (region, account, rate or model limitations): auto-add with visible restrictions.
- Trial credit only: place in a separate trial category; do not represent as recurring free.
- Missing, contradictory or ambiguous price evidence: Review queue.
- Paid-only: exclude from the free catalog.
- Retired or confirmed unavailable: mark unavailable and notify; preserve history.

A successful `/models` response proves that a model is listed by the provider; it does not by itself prove that the model is free.

## 6. Provider accounts and credentials

Provider accounts must be distinct from credentials because one account may issue multiple API keys and those keys may share a quota pool.

- `ProviderAccount`: provider, user-defined label, region, account metadata, shared quota identity.
- `Credential`: provider account, credential type, encrypted secret/token, scopes, expiry, status, created/updated time, last validation time.
- `CredentialType`: manual API key, OAuth access/refresh token, keyless/anonymous where explicitly supported.
- Never store provider passwords.
- OAuth only uses provider-published flows. Prefer authorization code with PKCE where supported; encrypt refresh tokens and handle revocation/expiry.
- API keys and OAuth tokens stay on the gateway. Android receives masked metadata and performs actions through authenticated gateway APIs.

## 7. Quota and usage data model

Keep two related but separate ledgers.

### Provider-reported quota observations

Fields:

- provider/account/credential and optional model scope
- `metric` and `unit` (requests, tokens, credits, characters, images, seconds, compute units, etc.)
- limit, remaining, used when explicitly supplied
- reset timestamp and reset strategy
- source: official usage API, response header, error response, official documentation, probe
- confidence, observed time, evidence and freshness status

### Infinity-observed usage events

Fields:

- request ID, provider, account, credential, model and endpoint
- request count; input/output/total tokens
- token measurement: provider-reported, gateway-estimated or unavailable
- success/failure, latency and timestamp
- cache/fallback/retry attribution where relevant

### Display rules

- Show provider-reported, header-observed and Infinity-estimated figures separately.
- Show data age and source on every quota balance.
- Do not invent reset times, quotas or unit conversions.
- Where a provider exposes only credits, show credits as credits; do not convert them into tokens unless the provider supplies an authoritative conversion.
- A provider quota API may be polled on a provider-specific schedule; do not poll unsupported endpoints.
- Alert thresholds should use only measurements with adequate confidence.

## 8. Unified API contract

Initial compatibility target:

- `GET /v1/models`
- `POST /v1/chat/completions` (JSON and streaming)
- `POST /v1/embeddings` only for compatible enabled providers/models
- optional later endpoints for image/audio/search after those capability families are in scope

Request routing:

1. Authenticate the Infinity-issued gateway API key.
2. Check key scopes, access and rate limits.
3. Resolve the requested Infinity model identifier or configured alias.
4. Check provider/model status, quota headroom and provider health.
5. Select a usable credential for the correct provider account.
6. Translate request format, call provider adapter and stream/normalize the response.
7. Record usage with actual/estimated provenance and quota observations.
8. Apply fallback only where request semantics permit it; return clear errors when no route is available.

Gateway API keys should support rotation, revocation, optional scopes, per-key limits and last-used information. Provider keys and Infinity gateway keys are different credential classes.

## 9. Security baseline

- Local gateway binds to loopback by default; user explicitly enables LAN access when needed.
- Remote gateway uses HTTPS only, explicit allowed hostnames, firewall rules and secure cookie/session configuration.
- Use gateway-side encryption for provider secrets and OAuth tokens; encryption master key is kept outside the database and backed up separately.
- Android stores only gateway session/pairing secrets using Android Keystore-backed storage.
- Mask secrets in UI and logs; revealing a secret requires re-authentication and explicit user action.
- Use outbound URL allowlists/SSRF protections for any user-configurable endpoints.
- Apply request size, concurrency and per-gateway-key rate limits.
- Audit export/import, backups, database permissions, key rotation and deletion semantics.
- First-run setup must not allow an unauthenticated remote user to claim a fresh gateway.

## 10. Development order

### Phase 1 — complete audit

- Classify every provider adapter by capability and integration maturity.
- Re-check free-tier status and source evidence instead of trusting stale catalog comments.
- Review provider-specific quota APIs, headers, account-pooling and region conditions.
- Review route auth, unified key behavior, SSRF protections, logs, backup and key rotation.

### Phase 2 — product specification

- Finalize provider/model/account/credential/quota entities.
- Define discovery evidence and review rules.
- Define the Android screen map and Simple/Advanced Mode interactions.
- Define gateway pairing and local/remote connection profile behavior.

### Phase 3 — clean architecture and implementation

- Extract/adapt only audited reusable code.
- Replace original catalog sync and licensing dependencies.
- Implement Infinity registry and strict discovery verification.
- Implement quota/account model extensions and OAuth provider framework.
- Build Android client and deployment packaging.

### Phase 4 — validation

- Unit and integration tests for every adapter and quota parser.
- Test free-tier claims against official sources and live API behavior.
- Test local gateway, remote gateway, Android pairing, credential encryption, rotation and restore.
- Test external clients against the unified API including streaming and errors.

## 11. Explicit exclusions for the current product

- No chat/voice assistant interface, conversation history or personal agent memory.
- No TTS/STT conversational experience, realtime voice or audio agent features.
- No multi-tenant SaaS or user billing system.
- No automatic cross-gateway replication of provider secrets or usage data.
- No automatic signup/login scraping or provider password collection.
