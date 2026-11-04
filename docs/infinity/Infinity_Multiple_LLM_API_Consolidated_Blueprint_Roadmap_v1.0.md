# Infinity Multiple LLM API — Consolidated Product Blueprint & Implementation Roadmap v1.0

**Date:** 3 November 2026  
**Status:** Consolidated planning baseline; implementation has not started  
**Source foundation:** User-provided `freellmapi` archive (MIT-licensed)  
**Purpose:** Consolidate approved product decisions and prior audit/specification documents into one implementation-ready plan.

---

## 1. Product definition

**Infinity Multiple LLM API** is an Android-managed API-key and free-model access management system. It connects a user's accounts with multiple LLM providers, maintains an independently verified model catalog, monitors provider quotas and Infinity-observed usage, and exposes a unified API gateway for external agents, developer tools and applications.

The Android app is the primary control panel. The gateway can run on a user-controlled local computer/server or on a remote VPS. The same gateway software and API contract should support both deployment modes.

### Explicit product boundary

Included:
- Provider discovery, account connection and credential management.
- Manual API-key entry and official OAuth where the provider supports it.
- Free-model catalog, model capabilities and availability status.
- Automatic discovery and verification workflow.
- Token/request usage, provider quotas, rate limits and reset information.
- Unified OpenAI-compatible API endpoint and Infinity client keys.
- Android control panel, gateway pairing, settings, notifications and security.

Not included in this product version:
- A general-purpose conversational chat application.
- Voice chat, speech-to-text, text-to-speech or real-time voice assistant UI.
- A multi-tenant hosted SaaS service.
- Hosting or operating third-party models on Infinity infrastructure.
- Circumventing provider limits, billing, geographic restrictions or access controls.

The separate agent/chat application may use the unified API later, but remains a separate product.

## 2. Approved product decisions

| Area | Approved decision |
|---|---|
| Product name | Infinity Multiple LLM API |
| Main interface | Android app |
| Deployment | Hybrid: local gateway or remote server, managed by Android |
| Local gateway host | User-owned PC, mini-PC, home server, NAS or similar always-on host; not a permanently running Android/Termux process |
| Provider authentication | Manual API keys and official OAuth where supported |
| Credential storage | Encrypted at the gateway that owns the provider connection |
| Quota monitoring | Both token-based and request-based information |
| Quota truth model | Provider-reported quota, observed response/rate-limit data and Infinity-estimated usage are labelled separately |
| Model discovery | Automatic discovery |
| Discovery policy | Automatically register verified free models; place uncertain or potentially paid models in Review |
| Paid/trial classification | Trial credits and paid-only access are not labelled as a verified free API tier |
| Dashboard modes | Simple by default; Advanced adds controls without removing basic functionality |
| Mode transition | Visible, smooth transition; entering Advanced expands from the Advanced control across the screen; returning to Simple is a graceful simplification |
| Source reuse | Reuse suitable MIT-licensed backend/provider logic after audit; retain license and copyright notices |
| Repository changes | No GitHub upload or source replacement until planning, audit and implementation preparation are complete |

These decisions are settled. Do not ask the user to reconfirm them unless a new technical constraint makes a change unavoidable.

## 3. Core user journey

1. Install and open the Android control panel.
2. Pair it with an existing local or remote Infinity gateway, or follow the documented gateway installation process.
3. Create/unlock the gateway's single-owner administrative account.
4. Open Providers and choose a provider.
5. Follow the provider's official signup/developer-console link, obtain an API key or complete official OAuth.
6. Send the credential securely to the selected gateway; encrypt it at rest and never return its plaintext to the app after submission.
7. Validate the connection and retrieve provider models/capabilities where supported.
8. The discovery engine compares catalog data with free-tier evidence. Verified free models are registered automatically; ambiguous candidates enter Review.
9. Quota and usage views show official provider data, observed rate limits and Infinity-side estimates as separate measures.
10. Create an Infinity API key and configure an external client with the gateway URL, key and model ID.
11. The gateway authenticates the request, selects the requested provider/model, routes it, records usage and returns a normalized response.

## 4. System architecture

### 4.1 Logical components

- **Android Control Panel:** gateway profiles, dashboard, provider setup, catalog, usage, discovery/review, API access and settings.
- **Gateway API:** authenticated administration API and separate inference API.
- **Provider Adapter Layer:** provider-specific authentication, model listing, inference, streaming, error normalization, rate-limit parsing and optional account-usage probes.
- **Provider Registry:** provider identity, integration status, capabilities, official links, region/eligibility notes and adapter metadata.
- **Model Registry:** normalized model identifiers, provider IDs, capabilities, free-tier classification, evidence, status and verification timestamp.
- **Discovery Engine:** scheduled source checks, provider catalog polling, official release/changelog sources, deduplication, classification and review queue.
- **Quota Engine:** account/key/model/endpoint quota pools, observations, reset windows and confidence/source labels.
- **Usage Ledger:** gateway-observed request/token counts and API-key attribution.
- **Credential Vault:** encrypted provider credentials and encryption-key version metadata.
- **Notification Engine:** new verified models, review candidates, provider/model changes, quota warnings and connection failures.
- **Database/Repository Layer:** gateway-local persistence and migrations.

### 4.2 Deployment modes

**Local mode:** Gateway runs on a user-owned always-on computer or server. Android connects over a trusted LAN or secure remote access path. Do not require Android background execution to keep the gateway alive.

**Remote mode:** Gateway runs on a user-controlled VPS/server, exposed through HTTPS with firewall restrictions, hostname validation, secure admin authentication and encrypted storage.

**Hybrid control:** Android stores multiple gateway connection profiles and lets the user switch the active target. Each gateway owns its own provider keys, database, usage history and model cache. There is no silent replication or secret synchronization between gateways.

### 4.3 Authentication boundaries

Keep two separate security domains:

- **Administrative access:** Android/web dashboard session, device-labelled sessions, revocation and scoped administrative operations.
- **Inference access:** separate Infinity API keys used by external agents/tools against the `/v1`-style endpoint.

Never use a dashboard session token as an inference key or expose administrative endpoints to external clients.

## 5. Provider and model lifecycle

### 5.1 Provider lifecycle

`candidate → verified → connected/active → degraded → disabled/retired`

The exact lifecycle may use separate integration-verification and user-connection fields rather than one overloaded status. Discovery of a provider does not mean the user has connected an account.

### 5.2 Model lifecycle and free-tier classification

Each model has at least two independent dimensions:

**Availability state:** discovered, verified, active, degraded, unavailable, retired.

**Access/pricing class:** verified_free_api, restricted_free_api, trial_credits, paid, unknown, region_limited, invitation_required.

Rules:
- A model endpoint appearing in a provider catalog is not proof of free API access.
- “Free website chat” is not proof of free API access.
- Trial credits are not a permanent free tier.
- Region, account type, verification requirements and fair-use restrictions must be recorded where known.
- Verified free models can be automatically added to the usable free catalog.
- Unknown, conflicting or potentially paid models enter Review and cannot be silently routed as free.
- Evidence must have source URL/reference, observation time, evidence type, confidence, and expiry/recheck policy.
- Retired models remain in history but are excluded from normal selectable/routeable lists.

### 5.3 Discovery sources

Use official provider model APIs, official pricing/free-tier documentation, provider changelogs/blogs, official GitHub repositories/releases and provider announcements. Third-party catalogs can be discovery hints but are not sufficient by themselves to certify free access.

Discovery must be rate-limited, respect source terms, deduplicate model IDs and retain provenance. No credential scraping or automated account creation.

## 6. Quota and usage truth model

Every displayed metric must identify its source and time.

| Data class | Meaning | UI label |
|---|---|---|
| Official account usage/quota | Provider's documented account/usage endpoint | Provider reported |
| Response/rate-limit headers | Limit/remaining/reset signals observed on actual requests | Observed from API |
| Infinity request count | Requests routed through this gateway | Counted by Infinity |
| Infinity token estimate/count | Token usage reported by provider or estimated by Infinity tokenizer | Provider-reported tokens / Infinity estimate |
| User-entered limit | Manually supplied limit/reset information | User supplied |

Requirements:
- Track both requests and tokens where possible.
- Support account-wide, key-wide, model-specific and endpoint-specific quota pools.
- Support rolling windows and calendar reset windows.
- Preserve units and raw provider metadata alongside normalized values.
- Never infer a reset time when the provider does not expose one.
- Mark stale observations and display last-updated time.
- Distinguish provider-side usage outside Infinity from Infinity-only usage; do not claim to know external usage unless the provider reports it.
- Avoid sending unnecessary probe requests that may consume paid quota.

## 7. Unified API gateway contract

Initial compatibility target: OpenAI-compatible chat completions, including streaming where the provider adapter supports it.

Core responsibilities:
- Authenticate Infinity API keys separately from admin sessions.
- Resolve requested model IDs against the Infinity registry.
- Validate requested features against adapter/model capabilities.
- Route only to connected and eligible provider accounts.
- Respect provider rate limits, cooldowns, Retry-After and quota exhaustion.
- Normalize provider errors without hiding the upstream cause.
- Support explicit fallback policy; never silently change the requested model unless the client allows fallback.
- Record request metadata, usage, latency, provider/model outcome and safe error information.
- Redact credentials and sensitive prompt/response data from logs by default.

The gateway does not add quota, bypass provider limits, or guarantee identical feature support across all models. Unsupported features must be surfaced clearly.

## 8. Security baseline

- AES-256-GCM or a reviewed equivalent for provider credentials at rest; version encryption metadata for rotation.
- Production encryption master key supplied outside the repository and outside ordinary database backups; document secure backup/recovery.
- TLS for remote gateway and secure pairing; no plaintext remote administration.
- Android Keystore-backed storage for gateway session/pairing secrets.
- Provider key plaintext exists only transiently during submission/use and is never returned in API responses.
- Redact secrets from logs, traces, crash reports, exports and diagnostic bundles.
- Device-labelled admin sessions with last-seen metadata and per-device revocation.
- Separate admin and inference API authentication and authorization.
- Secure defaults for host binding, allowed hosts, CORS, rate limits and firewall guidance.
- Validate input, enforce request/body/time limits and protect against SSRF when accepting provider/source URLs.
- Never commit `.env`, provider keys, encryption keys, production databases or user backups.
- Initial release is single-owner per gateway; do not expose it as a multi-tenant SaaS without a separate security design.

## 9. Android application information architecture

Primary bottom navigation:
1. **Overview:** selected gateway health, provider/model summaries, alerts and quick actions.
2. **Providers:** provider list, connection state, add key/OAuth flow, credential status and provider details.
3. **Models:** searchable catalog, filters, model detail, Discovery Center and Review queue.
4. **Usage:** request/token history, quota pools, reset windows, provider observations and estimates.
5. **Gateway:** endpoint, status, Infinity API keys, compatible-client instructions and logs/diagnostics.

Global controls: active gateway selector/status, notifications, settings and Simple/Advanced mode toggle.

Simple Mode must retain every essential workflow. Advanced Mode adds adapter diagnostics, raw quota observations, routing policies, detailed logs, discovery-source controls, feature compatibility and technical settings. The animated transition must not delay access to controls or harm accessibility/reduced-motion preferences.

## 10. Source reuse strategy

The supplied FreeLLMAPI source is an MIT-licensed monorepo with Node/Express backend, React/Vite client, shared types, CLI and Electron desktop code. The archive has no native Android module and no existing Capacitor setup in the inspected manifests.

### Reuse after review
- Provider adapter framework and suitable provider-specific adapters.
- Existing unified inference routing and OpenAI-compatible proxy logic.
- Credential encryption implementation after key-management review.
- Quota/rate-limit observation primitives.
- Health checks, cooldowns, error normalization and tests.
- Suitable API types, client patterns and selected visual components.

### Modify substantially
- Provider registry and provider classification.
- Model discovery, free-tier verification and review workflow.
- Catalog synchronization: remove dependency on the original hosted catalog/licensing service and establish an Infinity-owned registry.
- Quota/account usage mapping and source-confidence model.
- Admin authentication/session lifecycle for Android device pairing and revocation.
- Host/allowed-host/CORS/network security defaults.
- Database schema and migration strategy to match Infinity's product model.

### Exclude from current product scope unless later approved
- Conversational agent/chat UI, voice UI and speech pipelines.
- Electron desktop product as a release target.
- Unrelated search, scraping, image/video/audio generation or other non-LLM services from the user-facing provider catalog. Keep them out of the LLM provider taxonomy even if source code is retained for future work.

### Licensing
Preserve the original MIT license and all applicable copyright notices for reused files. Add clear attribution for modified/retained upstream components and maintain a dependency/license inventory. Do not remove original notices.

## 11. Android implementation decision gate

Do not choose a framework solely because the original client uses React.

Run a limited proof of concept on a physical Android device:
- Candidate A: React + Capacitor with a purpose-built mobile UI.
- Candidate B: Kotlin + Jetpack Compose using the same gateway API.

Evaluate the same journeys: gateway pairing, provider connection, model catalog filtering, quota dashboard, secure session persistence, push/local notifications, offline/error states, accessibility and mode transition animation.

Score each against implementation effort, native feel, secure storage, notification/background support, maintainability, reuse and testing results. Record the decision and rationale before full Android implementation.

## 12. Implementation roadmap and release gates

### Phase 0 — Planning baseline (current)
**Deliverables:** consolidated blueprint, previous audits/specifications, source reuse map, acceptance criteria.  
**Exit gate:** scope and approved decisions are internally consistent; no unresolved architecture contradictions.

### Phase 1 — Repository baseline and build reproducibility
- Preserve pristine upstream archive/tag and license.
- Create a clean working branch/fork for Infinity only after approval.
- Reproduce install, build, lint and test from a clean environment.
- Record dependency inventory, Node version and known failing tests.
- Add secret scanning and `.env.example`; verify no secrets in commits.

**Exit gate:** reproducible baseline with a documented list of existing failures.

### Phase 2 — Core backend and security foundation
- Apply reviewed database migrations.
- Implement encryption-key versioning and credential vault boundaries.
- Harden host binding, allowed hosts, CORS, TLS deployment guidance and request limits.
- Extend admin sessions for device labels, last-seen and revocation.
- Preserve separate inference API key auth.

**Exit gate:** security tests pass; provider secrets never appear in logs or API responses; Android can pair securely.

### Phase 3 — Provider integration foundation
- Define adapter interface and conformance tests.
- Select a small initial provider cohort based on current official docs, API access and India/account eligibility checks.
- Implement manual key entry first; add OAuth only for providers with official supported flows.
- Validate, list models, make test inference, parse errors and rate-limit headers.

**Exit gate:** each initial provider passes adapter conformance tests and safe connection tests.

### Phase 4 — Model registry and discovery
- Implement Infinity-owned provider/model registry.
- Add official discovery sources, scheduled checks, evidence storage and deduplication.
- Add free-tier classification, Review queue and model retirement/change history.
- Add verification expiry and recheck policy.

**Exit gate:** tests prove that ambiguous or trial-only models cannot be auto-classified as verified free.

### Phase 5 — Quota and usage system
- Normalize official quota endpoints where documented.
- Parse response headers and retry/reset metadata.
- Count gateway requests and provider-reported or estimated tokens.
- Support shared/account/key/model quota pools and stale-data handling.

**Exit gate:** UI/API distinguishes official, observed, estimated and user-entered values; unknown reset stays unknown.

### Phase 6 — Unified API gateway MVP
- Implement OpenAI-compatible non-streaming and streaming path where supported.
- Add model resolution, provider routing, safe retries, cooldowns and explicit fallback policy.
- Add Infinity API key creation/revocation and usage attribution.
- Publish client setup examples.

**Exit gate:** external test client can call a connected provider through one Infinity endpoint and key; error/usage accounting is correct.

### Phase 7 — Android control panel MVP
- Complete Android framework POC decision.
- Implement gateway profiles/pairing and secure session storage.
- Build Overview, Providers, Models, Usage and Gateway screens.
- Add notifications, loading/error/empty/offline states and Simple/Advanced mode.

**Exit gate:** core user journey can be completed on a physical Android device with local and remote gateway targets.

### Phase 8 — Integration, hardening and release candidate
- End-to-end tests across providers, discovery, quotas and gateway routing.
- Backup/restore and encryption-key recovery tests.
- Load, rate-limit, failure and network interruption tests.
- Android accessibility, performance, permissions and release signing.
- Documentation, support diagnostics and release checklist.

**Exit gate:** no critical/high security issues; release criteria and known limitations documented.

### Phase 9 — Repository handoff and GitHub publication
- Clean repository structure and commit history.
- Remove secrets, local DBs, generated artifacts and unused product scope.
- Preserve MIT notices and include third-party license inventory.
- Add README, setup guides, architecture docs, environment templates and CI workflow.
- Prepare exact folder paths, commit sequence and upload instructions for the user.

**Exit gate:** user reviews the prepared repository and explicitly approves publication.

## 13. Proposed work packages and dependency order

| Work package | Depends on | Main output |
|---|---|---|
| WP-01 Source baseline | Current archive | Reproducible build/test baseline |
| WP-02 Security and auth | WP-01 | Secure gateway and Android pairing contract |
| WP-03 Provider adapters | WP-01, WP-02 | Initial connected provider set |
| WP-04 Provider/model registry | WP-01 | Independent Infinity catalog |
| WP-05 Discovery and verification | WP-04 | Evidence-backed model discovery |
| WP-06 Quota/usage | WP-02, WP-03 | Normalized quota and usage service |
| WP-07 Unified API | WP-02, WP-03, WP-04, WP-06 | External client gateway |
| WP-08 Android app | WP-02 API contract, WP-07 contracts | Android control panel |
| WP-09 Release hardening | WP-03 to WP-08 | Release candidate |
| WP-10 GitHub handoff | WP-09 | Publish-ready repository |

## 14. MVP acceptance criteria

The first usable MVP is complete only when all of the following work:

1. Android can securely pair with a local gateway and a remote gateway.
2. User can connect at least the selected initial providers using manual API keys; official OAuth is available only where implemented and supported.
3. Provider credentials are encrypted at rest and never returned in plaintext after submission.
4. Connected providers can be validated and their model lists/capabilities retrieved where supported.
5. Infinity catalog differentiates verified free, restricted free, trial, unknown, paid and unavailable models.
6. Verified free models are automatically registered; uncertain models enter Review.
7. Usage reports requests and tokens with source/confidence labels.
8. Missing provider reset data is displayed as unknown, not fabricated.
9. External client can use one Infinity endpoint and API key for a supported OpenAI-compatible request.
10. Errors, quota exhaustion and provider rate limits are surfaced accurately; fallback is not silent.
11. Simple and Advanced modes both retain all essential functions.
12. Local and remote gateways remain separate data/credential domains.
13. Tests cover key security, provider adapter contracts, discovery classification, quota normalization and end-to-end routing.

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Free-tier policies change frequently | Evidence timestamps, expiry/rechecks, source links and Review state |
| Provider does not expose quota API | Label observed/estimated data and show unknown where appropriate |
| Provider APIs differ or lack OpenAI compatibility | Adapter interface and feature capability matrix |
| Android background limits | Run gateway on PC/server; Android is control panel only |
| Local gateway not reachable outside LAN | Explain secure remote access/VPN/reverse proxy; do not expose unauthenticated ports |
| Original catalog/license coupling | Replace with Infinity-owned registry; remove original hosted sync dependency |
| Existing security defaults unsuitable for internet | Harden before remote exposure; security gate blocks release |
| Scope expands into chat/voice or unrelated providers | Keep separate product boundary and backlog |
| Upstream source changes | Pin upstream baseline and maintain an adaptation/attribution record |

## 16. Immediate next engineering actions

The next actions are technical work, not more product preference questions:

1. Create a source-to-Infinity file-level reuse map (retain / modify / exclude / replace / new).
2. Reproduce the original clean build, lint and test baseline and record actual results.
3. Identify the smallest initial provider cohort and verify each against current official documentation before claiming free access.
4. Run the Android POC for Capacitor versus Kotlin/Compose using the same gateway pairing and dashboard journeys.
5. Turn the approved database and integration contracts into migrations, interfaces and test cases.

**No repository files have been modified and no GitHub publication has occurred as part of this planning document.**
