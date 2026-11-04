# Infinity Multiple LLM API — File-Level Source Mapping v0.8

**Date:** 3 November 2026  
**Status:** Source mapping completed; no source files have been changed or copied into a new repository.  
**Input:** User-provided `freellmapi-main (1).zip`  
**Upstream snapshot marker shown in ZIP:** `5127fee51ba97ad112915ebe227ba13df461a266`  
**Archive date shown in ZIP entries:** 30 October 2026  
**License:** MIT; preserve the original `LICENSE` and applicable notices whenever code is reused.

---

## 1. What was inspected

The archive listing contains **1,398 ZIP entries in total: 1,294 files and 104 directory entries**. The earlier 1,398 figure refers to all ZIP entries, not 1,398 files.

| Top-level area | Files | Infinity disposition |
|---|---:|---|
| `server/` | 670 | Primary reuse source; selectively retain and modify |
| `client/` | 289 | Selective UI/API-client reference and possible component reuse after Android POC |
| `docs/` | 168 | Keep selected technical references; rewrite product documentation |
| `desktop/` | 56 | Exclude Electron shell from initial product; inspect selected process-hosting logic as reference only |
| `repo-assets/` | 51 | Replace inherited branding/screenshots |
| `cli/` | 22 | Exclude from MVP; possible later companion utility |
| `.github/` | 6 | Reuse CI/dependency-update patterns; replace release workflows |
| Root files | 19 | Mixed: preserve license, adapt project/build/deployment files |
| `scripts/` | 3 | Inspect and selectively adapt developer bootstrap scripts |
| `shared/` | 2 | Adapt shared contracts if useful for TypeScript services/web client |
| `examples/` | 4 | Keep selected API interoperability examples after review |
| `docker/` | 1 | Inspect and adapt only if compatible with new deployment layout |
| **Total** | **1,294** | — |

Test inventory in the archive: **460 test files** by filename pattern (`.test.ts`, `.test.tsx`, `.test.mjs`), including **386 files under `server/src/__tests__/`**. This is a test-file count, not a claim that all tests currently pass.

This mapping covers the key files and executable directories at source-path level. It is not a line-by-line review of every provider adapter or every test. Individual provider activation and free-tier status remain unverified until provider-by-provider testing.

## 2. Disposition definitions

- **RETAIN:** useful implementation or reference can be carried forward after normal code review and tests.
- **MODIFY:** retain the concept/code, but change identifiers, behavior, security, data model or product boundaries for Infinity.
- **REPLACE:** do not carry the implementation forward as-is; create an Infinity-owned equivalent.
- **EXCLUDE (MVP):** outside the agreed API-manager/gateway product scope. Keep untouched in the original archive; do not import into the first Infinity build.
- **NEW:** required functionality or application area not present in the source in the required form.

No category means “copy blindly.” All retained code still requires dependency, license, security and test review.

## 3. Root-level project files

| Source path | Action | Reason / Infinity treatment |
|---|---|---|
| `LICENSE` | **RETAIN** | Preserve MIT license text and upstream copyright notice in reused distributions. |
| `package.json` | **MODIFY** | Rename package/workspaces/scripts; define only the Infinity server, contracts and any selected web tooling. Do not retain the original workspace layout automatically. |
| `package-lock.json` | **REPLACE** | Regenerate after dependencies/workspaces are finalized; never hand-edit lockfile. |
| `.nvmrc` | **MODIFY** | Keep a supported Node version aligned with the chosen runtime and deployment images. |
| `.env.example` | **MODIFY** | Re-author all variables; document secrets as placeholders only; no real keys or production encryption material. |
| `.gitignore` | **MODIFY** | Add Android, local gateway data, SQLite, secrets, signing files, build artifacts and IDE-specific ignores. |
| `.dockerignore` | **MODIFY** | Match the new server build context and avoid copying local data/secrets into images. |
| `Dockerfile` | **MODIFY** | Rebuild around the Infinity gateway, secure non-root runtime, health check and persistent data mount. |
| `docker-compose.yml` | **MODIFY** | Provide a secure self-hosted gateway example with explicit secrets, volumes, ports and restart policy. |
| `docker-entrypoint.sh` | **MODIFY** | Retain only if migration/permission/startup behavior remains valid; otherwise replace. |
| `README.md` | **REPLACE** | Write Infinity installation, security, provider onboarding and Android pairing instructions. |
| `README.ru.md`, `README.zh-cn.md` | **EXCLUDE initially** | Do not carry inherited translations forward; consider after the English product docs stabilize. |
| `SECURITY.md` | **REPLACE** | Publish Infinity-specific threat model, disclosure route and deployment-hardening guidance. |
| `CONTRIBUTING.md` | **MODIFY** | Adapt project setup, test commands, code ownership and contributor rules. |
| `CODE_OF_CONDUCT.md` | **RETAIN / REVIEW** | May preserve if desired, with attribution/license review. |
| `GLOSSARY.md` | **MODIFY** | Reuse useful API/quota terminology; remove irrelevant product-specific terms. |
| `opencode.json` | **EXCLUDE initially** | Tool-specific upstream developer configuration, not a runtime requirement. |

## 4. Backend mapping — primary reuse area

### 4.1 Server entry points and composition

| Source path | Action | Notes |
|---|---|---|
| `server/src/index.ts` | **MODIFY** | Preserve startup/shutdown structure where useful; review binding host, setup flow, migrations, scheduler startup and remote exposure defaults. |
| `server/src/app.ts` | **MODIFY** | Rebuild route composition to expose only Infinity admin, discovery, usage and inference APIs. Remove unrelated product routes. |
| `server/src/env.ts` | **MODIFY** | Keep typed environment validation; replace original settings with Infinity deployment profiles and secure defaults. |
| `server/package.json` | **MODIFY** | Retain required Express/TypeScript/testing dependencies; remove unused features and scripts as the scope is finalized. |
| `server/tsconfig.json`, `server/vitest.config.ts`, `server/eslint.config.js` | **MODIFY** | Preserve build/test conventions but update aliases, coverage and lint scope after code removal. |

### 4.2 Provider adapters

**Directory: `server/src/providers/` — 51 adapter/module files.**

| Source path(s) | Action | Notes |
|---|---|---|
| `server/src/providers/base.ts` | **RETAIN / MODIFY** | Core adapter contract. Extend for Infinity capability flags, credential kind, model metadata, account quota probes, error/limit normalization and verification hooks. |
| `server/src/providers/openai-compat.ts` | **RETAIN / MODIFY** | High-value generic adapter for OpenAI-compatible providers. Add provider-specific quirks and capability declaration rather than assuming all compatible endpoints behave identically. |
| `server/src/providers/index.ts` | **MODIFY** | Replace the original active-provider allowlist with an Infinity-owned registry and explicit integration lifecycle. |
| `server/src/providers/*.ts` (provider-specific adapters) | **RETAIN selectively / MODIFY per adapter** | Each adapter must pass an individual audit for current endpoint, auth method, model-list behavior, streaming, tool/vision support, error mapping, quota signals, free-tier evidence and region restrictions before being marked active. |
| `server/src/providers/search-only.ts`, `serpsearch.ts`, `tavily.ts`, `exa.ts`, `brave.ts`, `firecrawl.ts`, `parallel.ts`, `linkup.ts` | **EXCLUDE from LLM provider catalogue initially** | Search services are not interchangeable with inference providers. Keep out of the free-LLM model list; reconsider only as a separate future tool integration category. |
| `server/src/providers/speechify.ts` and other speech/media-only adapters | **EXCLUDE from MVP inference roster** | The agreed product is API-key/model/quota management for LLM inference; speech/media services are not part of the first provider roster unless separately approved. |
| `server/src/providers/decision-only.ts` and other specialty adapters | **REVIEW individually** | Do not classify as ordinary chat models. Include only if an explicit gateway capability and model UX are defined. |

The provider directory contains 51 files, but file presence is not evidence that a service currently offers a free API tier. Do not bulk-enable every upstream adapter.

### 4.3 Backend services

| Source path | Action | Notes |
|---|---|---|
| `server/src/services/provider-quota.ts` | **RETAIN / MODIFY** | Main quota observation pipeline. Extend account-level pools, normalized units, explicit source/confidence/freshness, provider-reported vs gateway-observed values and reset-window modeling. |
| `server/src/services/ratelimit.ts` | **RETAIN / MODIFY** | Reuse request/token accounting and routing guards; define exact attribution and avoid double counting retries/fallback attempts. |
| `server/src/services/health.ts` | **RETAIN / MODIFY** | Keep provider health monitoring; separate health probes from quota probes and avoid tests that consume scarce quota. |
| `server/src/services/cooldown-probe.ts` | **RETAIN / MODIFY** | Reuse cooldown/availability observation with provider-specific safe probing policies. |
| `server/src/services/router.ts`, `routing-decision.ts`, `decision.ts`, `scoring.ts`, `degradation.ts` | **RETAIN selectively / MODIFY** | Preserve suitable model selection, error handling and failover logic; simplify to Infinity's explicit model/provider selection policy. |
| `server/src/services/model-listing.ts`, `model-groups.ts`, `model-state.ts`, `model-probe.ts`, `model-retirement.ts` | **RETAIN / MODIFY** | Useful model lifecycle foundations; align status values with the Infinity model/access classification model. |
| `server/src/services/model-discovery.ts`, `builtin-model-discovery.ts` | **MODIFY substantially** | Existing discovery scope is narrow. Replace allowlist-only assumptions with scheduled provider/source discovery, evidence collection, deduplication and verification queue. |
| `server/src/services/catalog-sync.ts` | **REPLACE** | Original sync is tied to the upstream hosted catalog/licensing. Infinity must own its registry, sync process, provenance and release mechanism. |
| `server/src/services/provider-credential.ts` | **RETAIN / MODIFY** | Credential abstraction is useful; extend for credential kinds and lifecycle metadata while preserving secret redaction. |
| `server/src/services/auth.ts` | **RETAIN / MODIFY** | Extend for mobile app sessions/device labels/scopes/rotation and individual revocation. Keep admin and inference auth separate. |
| `server/src/services/backups.ts` | **RETAIN / MODIFY** | Adapt backup/restore for Infinity tables and explicitly document separate encryption-key backup/recovery. |
| `server/src/services/idempotency.ts`, `cache.ts` | **RETAIN selectively** | Reuse where gateway request/retry behavior needs them; verify cache isolation by gateway profile and credential/account. |
| `server/src/services/custom-model-register.ts`, `custom-model-sync.ts`, `custom-model-tombstone.ts`, `custom-endpoint.ts` | **REVIEW / MODIFY** | Retain manual/custom endpoint support only if it fits the approved provider registry; do not let custom endpoints bypass free-tier verification labels. |
| `server/src/services/key-budget.ts`, `budget-alerts.ts`, `quota-forecast.ts`, `quota-outlook.ts` | **RETAIN selectively / MODIFY** | Useful for limits/alerts; distinguish user-defined budgets from provider-enforced quotas. |
| `server/src/services/compression/**`, `context-handoff.ts`, `fusion.ts`, `embeddings.ts`, `rerank.ts`, `moderation.ts`, `media.ts`, `search.ts`, `decision.ts` (specialized agent/tool paths) | **EXCLUDE from MVP unless required by gateway compatibility** | These support the upstream broader agent/playground/product scope. Do not import them just because they exist. The exact minimal request/response compatibility surface will be retained separately. |
| `server/src/services/catalog-sync.ts` plus any upstream premium/licensing integration | **REPLACE / EXCLUDE** | No dependency on the upstream hosted service, catalog signature or premium licensing for Infinity's base product. |

### 4.4 Backend routes

| Source path | Action | Notes |
|---|---|---|
| `server/src/routes/auth.ts` | **MODIFY** | Extend existing login/setup/session with per-device sessions, last-seen, scopes, refresh/rotation and individual revocation. |
| `server/src/routes/keys.ts` | **MODIFY substantially** | Rename/restructure around provider accounts and credential records; keep key validation, masking and safe provider setup patterns. |
| `server/src/routes/models.ts` | **MODIFY** | Replace inherited model presentation/API with Infinity registry, capabilities, pricing class, evidence and availability state. |
| `server/src/routes/proxy.ts` | **RETAIN / MODIFY** | Core unified inference proxy. Simplify compatibility endpoints and add explicit usage attribution, policy checks and safe routing. |
| `server/src/routes/health.ts`, `status.ts` | **MODIFY** | Expose gateway health and provider status without leaking sensitive data. |
| `server/src/routes/settings.ts` | **MODIFY** | Rebuild for Infinity deployment, security, discovery and quota settings. |
| `server/src/routes/backups.ts`, `logs.ts` | **RETAIN / MODIFY** | Preserve only required operational controls, with secret redaction and scoped access. |
| `server/src/routes/free-tier.ts` | **REPLACE / MODIFY** | Replace assumptions from upstream free-tier logic with Infinity's evidence-backed free/restricted/trial/paid/unknown classification. |
| `server/src/routes/premium.ts`, `update.ts` | **EXCLUDE / REPLACE if needed** | Remove upstream premium/licensing/update endpoints. Infinity update mechanism, if needed, must be independent. |
| `server/src/routes/analytics.ts` | **REVIEW / SIMPLIFY** | Keep operational usage summaries needed by quota/usage dashboards; exclude agent-specific analytics. |
| `server/src/routes/client-profiles.ts`, `mcp.ts`, `conversations.ts`, `embeddings.ts`, `media.ts`, `search.ts`, `anthropic.ts`, `gemini.ts`, `responses.ts`, `fallback.ts`, `decisions.ts`, `compression.ts`, `ollama.ts` | **REVIEW; mostly EXCLUDE from first MVP** | Preserve only routes required for agreed OpenAI-compatible API compatibility or provider wire protocols. Do not carry over unrelated client/agent/product endpoints by default. |
| Remaining routes | **EXCLUDE unless a direct MVP requirement is recorded** | Route count reduction is intentional; the first release is not a clone of the full upstream product. |

### 4.5 Security libraries and middleware

| Source path | Action | Notes |
|---|---|---|
| `server/src/lib/crypto.ts`, `credential.ts` | **RETAIN / MODIFY** | Preserve authenticated encryption pattern after review; add encryption-key versioning/rotation and deployment-specific secret loading. |
| `server/src/lib/password.ts` | **RETAIN** | Reuse password hashing after parameters and tests are reviewed. |
| `server/src/lib/config.ts`, `env.ts` | **MODIFY** | Tighten remote-binding, allowed-host, CORS, proxy and public deployment defaults. |
| `server/src/lib/error-redaction.ts`, `log-redaction.ts`, `request-log.ts`, `server-logs.ts` | **RETAIN / MODIFY** | Strongly relevant; audit for provider secrets, bearer tokens, request bodies and OAuth material. |
| `server/src/lib/url-guard.ts`, `header-value.ts`, `file-permissions.ts`, `process-safety-net.ts`, `graceful-shutdown.ts` | **RETAIN selectively** | Useful hardening utilities; verify every utility still has an active caller. |
| `server/src/lib/setup-code.ts`, `one-time-code.ts`, `reset-code.ts` | **RETAIN / MODIFY** | Preserve protected first-run claim/reset behavior; adapt wording and tests for Android/local/remote onboarding. |
| `server/src/lib/proxy.ts`, `key-proxy.ts`, `key-parser.ts`, `model-scope.ts`, `provider-identity.ts` | **RETAIN / MODIFY** | Reuse relevant gateway primitives; align with new provider/account/model registry. |
| `server/src/middleware/requireAuth.ts`, `rateLimit.ts`, `errorHandler.ts`, `allowed-hosts.ts` | **RETAIN / MODIFY** | Keep core middleware; extend scopes and secure host policy. No remote deployment with an empty/unrestricted host configuration by default. |

### 4.6 Database and migrations

| Source path | Action | Notes |
|---|---|---|
| `server/src/db/index.ts`, `node-sqlite.ts`, `types.ts` | **RETAIN / MODIFY** | Preserve database access patterns where suitable; map tables to the approved Infinity schema before migration. |
| `server/src/db/migrate/**` | **RETAIN framework / MODIFY migrations** | Keep migration runner/template/CLI if compatible. Do not apply upstream migrations blindly to a fresh Infinity database. |
| `server/src/db/migrations/20260101_000000_legacy_baseline.ts` | **REVIEW as reference** | Understand source schema, but author a clean Infinity baseline or carefully curated migration path rather than carrying unrelated tables. |
| Migrations for key health, quota observations/freshness, request attempts/usage, model provenance/state, idempotency, backups, key monthly usage | **RETAIN as design reference; rewrite/selectively port** | These contain useful patterns for quota/history and reliability. Reconcile against Infinity's own database specification. |
| Migrations for conversations, client profiles, compression, decisions, search engines, media and agent compatibility | **EXCLUDE from Infinity MVP** | Outside agreed scope unless a specific dependency is proven. |
| `server/src/db/model-pricing.ts` | **REVIEW / MODIFY** | Retain only useful normalized model pricing/free-tier metadata; Infinity's evidence model remains authoritative. |

### 4.7 Backend tests

| Source path | Action | Notes |
|---|---|---|
| `server/src/__tests__/providers/**` | **RETAIN / ADAPT selectively** | Keep tests for retained adapters and generic protocol behavior; remove tests only for adapters explicitly excluded from MVP. |
| `server/src/__tests__/routes/auth*`, `keys*`, `models*`, `health*`, `free-tier*`, `fallback*`, `proxy*` | **RETAIN / ADAPT** | Rewrite expected behavior for Infinity security, discovery, credential and gateway contracts. |
| `server/src/__tests__/db/**`, `lib/crypto*`, `lib/config*`, `lib/url-guard*`, `lib/error-redaction*`, `lib/log-redaction*` | **RETAIN / EXTEND** | These are essential regression and security tests. |
| Tests for agent chat, compression, media, search, decision workflows | **EXCLUDE from first MVP** | Keep upstream archive untouched; do not let unrelated feature tests block the reduced Infinity build. |
| All retained tests | **NEW ACCEPTANCE GATES** | Provider credential never appears in logs; quota source is explicit; unverified/paid candidate is not silently routable as free; revoked admin session stops working; API keys and admin sessions cannot be interchanged. |

## 5. Client mapping — use only after Android POC decision

The supplied client is React 19 + Vite. It is not a native Android application and does not include a Capacitor project. Treat these files as reusable source material, not as a finished Android experience.

| Source path | Action | Notes |
|---|---|---|
| `client/src/lib/api.ts` | **RETAIN / MODIFY** | Useful API transport pattern if the selected dashboard remains TypeScript-based; replace auth storage and gateway-profile handling. |
| `client/src/App.tsx`, `main.tsx`, router setup | **MODIFY / REFERENCE** | Existing app shell and route architecture are desktop/web oriented. Rebuild navigation for mobile screen specification. |
| `client/src/components/ui/**` | **RETAIN selectively** | Primitive components may be reused if React/Capacitor wins the Android POC; otherwise use as visual/behavior reference only. |
| `client/src/components/keys/**` | **RETAIN selectively / MODIFY** | Valuable provider/key management flows, but map them to provider accounts, credential vault, OAuth and Android interactions. |
| `client/src/components/model-table.tsx`, `model-combobox.tsx`, model-related components | **RETAIN selectively / MODIFY** | Reuse model filtering/selection logic if compatible with mobile UX. |
| `client/src/components/api-usage.tsx`, `usage-summary-card.tsx`, `token-usage-bar.tsx` | **RETAIN selectively / MODIFY** | Useful UI references for quota/usage cards, subject to explicit source/freshness indicators. |
| `client/src/components/auth-gate.tsx` | **REFERENCE / MODIFY** | Existing dashboard login is useful as reference; replace desktop-specific behavior and add paired-device/session management. |
| `client/src/pages/KeysPage.tsx`, model pages/components | **REFERENCE / REBUILD selectively** | Map to Android Providers and Models flows, not necessarily direct page reuse. |
| `client/src/pages/AgentsPage.tsx`, `PlaygroundPage.tsx`, `AudioPage.tsx`, `ImagePage.tsx`, `VideoPage.tsx`, `SearchPage.tsx`, `EmbeddingsPage.tsx`, `FusionPage.tsx`, `DecisionPage.tsx`, premium and media detail pages | **EXCLUDE from MVP** | These are not part of the current API manager control-panel product. |
| `client/src/i18n/**` | **REVIEW / SELECTIVE RETAIN** | Existing localization framework can be useful, but do not import every locale before initial language scope is decided. |
| `client/src/theme*`, `index.css` | **REFERENCE / MODIFY** | Rebuild Infinity's visual design, including agreed Simple/Advanced transition. |
| `client/package.json`, `vite.config.ts`, `index.html`, test setup | **MODIFY if web/Capacitor path selected** | Add Android packaging only after the POC proves the approach. |
| `client/dev/mockApi.ts` | **RETAIN as test reference / MODIFY** | Mock endpoints should follow the new Infinity API contract and never masquerade as production quota evidence. |

## 6. Desktop, CLI, docs and delivery infrastructure

| Source path | Action | Notes |
|---|---|---|
| `desktop/**` | **EXCLUDE from initial product** | Do not ship the Electron shell. Some process-hosting ideas can be studied for local gateway operation, but the gateway itself remains the server process. |
| `desktop/src/server-host.ts` | **REFERENCE only** | May inform process lifecycle and logging; not to be ported without review. |
| `cli/**` | **EXCLUDE from MVP; possible later** | Useful future option for gateway installation/configuration, but the Android-first control panel and secure gateway are the initial scope. |
| `docs/en/clients/**` | **SELECTIVE RETAIN / REWRITE** | Keep relevant external-agent compatibility concepts; update endpoint, API key, supported request and setup instructions to Infinity. |
| `docs/en/api/**`, `docs/en/providers/**`, `docs/api.md`, `docs/architecture.md`, install docs | **REFERENCE / REWRITE** | Retain generic protocol knowledge, but all provider URLs, free claims, licensing and installation guidance must be reverified. |
| `docs/` product screenshots and upstream feature guides | **EXCLUDE / REPLACE** | They describe upstream branding and out-of-scope features. |
| `examples/**` | **SELECTIVE RETAIN** | Keep minimal OpenAI-compatible client examples after renaming and removing upstream endpoints/secrets. |
| `.github/workflows/ci.yml` | **MODIFY** | Retain CI pattern and rebuild against Infinity workspace/test matrix. |
| `.github/dependabot.yml` | **MODIFY / RETAIN** | Keep automated dependency update configuration with Infinity package paths. |
| `.github/workflows/desktop-release.yml`, `cli-release.yml` | **EXCLUDE** | No desktop or CLI release in MVP. |
| `.github/workflows/docker.yml` | **MODIFY** | Replace with Infinity gateway build/publish workflow only after release/security process is defined. |
| `.github/RELEASE_TEMPLATE.md` | **MODIFY** | Re-author for Infinity release notes. |
| `repo-assets/**` | **REPLACE** | Remove original FreeLLMAPI logo/screenshots from the new product and create Infinity assets. |
| `scripts/dev-bootstrap.*` | **REVIEW / MODIFY** | Reuse only if helpful for local developer setup; strip upstream naming and assumptions. |

## 7. Required new Infinity files and capabilities

These are not available in the source in the required product form and must be created or substantially redesigned.

| New path / component | Purpose |
|---|---|
| `android/` or `apps/android/` | Android app. Final framework remains contingent on the Android POC: Kotlin + Jetpack Compose versus React + Capacitor. |
| `docs/INFINITY_PRODUCT_SPEC.md` | Authoritative product requirements and scope. |
| `docs/PROVIDER_REGISTRY_POLICY.md` | Provider lifecycle, proof of free API access, region/eligibility and review rules. |
| `docs/SECURITY_MODEL.md` | Threat model, trust boundaries, secrets, sessions, gateway hardening and incident recovery. |
| `docs/DEPLOYMENT_LOCAL.md`, `docs/DEPLOYMENT_SERVER.md` | Safe local-host and VPS deployment procedures. |
| `packages/contracts/` or equivalent | Versioned request/response schemas shared by Android and gateway; ideally generate OpenAPI docs/client models. |
| Infinity-owned provider registry data | Stable provider IDs, official links, authentication modes, capabilities, quota support, region eligibility and verification state. |
| Infinity-owned model evidence registry | Evidence URL/type, checked-at, confidence, access/pricing classification, review status and expiry/recheck. |
| OAuth connector framework | Provider-by-provider official OAuth/PKCE integrations when supported; manual API-key flow remains first. |
| Device/session management | Android paired-device labels, scopes, last-seen, session rotation and individual revocation. |
| Gateway profile management in Android | Save/switch local and remote gateway profiles without mixing credentials or caches. |
| Provider account layer | Model shared account-level quota pools across multiple keys. |
| Quota source/freshness presentation | Display provider-reported, header-observed, Infinity-counted and estimated values separately. |
| Discovery review center | Hold unknown, restricted, trial or potentially paid candidates outside the verified free catalog. |
| Notification subsystem | Notify on new verified models, changed free access, retirement, quota warnings and provider failures. |
| Infinity API key lifecycle | Create/revoke/label separate inference keys; reveal full key only once. |
| New tests and operational telemetry | Add contract, Android pairing, registry-evidence, quota accuracy, security, gateway isolation and regression tests. |

## 8. Proposed Infinity repository layout (provisional)

```text
infinity-multiple-llm-api/
├── android/                    # Native/Capacitor app, chosen after POC
├── server/                     # Gateway and administration API
│   ├── src/providers/           # Audited provider adapters
│   ├── src/services/            # Registry, discovery, quota, routing, auth
│   ├── src/routes/              # Infinity admin and inference endpoints
│   ├── src/db/                  # Infinity schema and migrations
│   ├── src/lib/                 # Security, config, transport utilities
│   └── src/__tests__/           # Retained/adapted tests plus new tests
├── packages/
│   └── contracts/               # Shared API schemas/types (implementation choice)
├── docs/                        # Infinity-owned product/engineering/deployment docs
├── examples/                    # External client connection examples
├── ops/
│   └── docker/                  # Gateway image and compose configuration
├── scripts/                     # Development and release helpers
├── .github/workflows/           # CI, dependency and approved release workflows
├── LICENSE                      # MIT with upstream notice retained
├── README.md                    # Infinity-specific instructions
└── package.json                 # Clean Infinity workspace manifest
```

This is a proposed layout, not a generated project. The exact `android/` structure depends on the POC result.

## 9. Migration and copying rules

1. Keep the original ZIP and extracted tree unchanged as the immutable upstream reference.
2. Create a separate clean Infinity working directory; never edit the uploaded source in place.
3. Copy only files classified RETAIN or MODIFY, with their required imports/tests and the original MIT notice.
4. Port migrations by intent and schema, not by copying the entire upstream migration history into the new database.
5. Do not import original catalog signing keys, endpoints, premium license assumptions, logos or update services.
6. Scan source, docs, examples and Git history for real credentials before any commit. `.env.example` must contain placeholders only.
7. Record upstream source path and commit marker for each retained/ported module in `docs/THIRD_PARTY_ATTRIBUTION.md` or an equivalent provenance file.
8. Keep EXCLUDE items in the untouched upstream archive; “exclude” means not in the Infinity MVP, not delete from the user's source.

## 10. Recommended implementation sequence after mapping

| Order | Work package | Exit condition |
|---:|---|---|
| 1 | Baseline original source | Reproducible install, build, test and lint results recorded; failures separated into environment vs source failures. |
| 2 | Build a clean Infinity skeleton | New package/workspace, license/provenance, environment config and CI compile. |
| 3 | Port security/database foundations | Migrations run; encryption, auth separation, backup and host policies pass tests. |
| 4 | Port a minimal provider adapter slice | First small set of providers verified end-to-end; no blanket activation. |
| 5 | Port quota and usage foundation | Request/token ledger and provider-source labels are accurate and tested. |
| 6 | Create Infinity registry/discovery | Candidates verified from evidence; unknown/paid candidates cannot enter free routing. |
| 7 | Implement unified inference API | OpenAI-compatible request, streaming, errors, model IDs and key revocation tested. |
| 8 | Complete Android POC, then select framework | Device pairing, secure storage, profile switching, usability and animation tested on a physical phone. |
| 9 | Build Android MVP screens | Connect provider → discover models → show quota → create Infinity key → call through gateway. |
| 10 | Local/server deployment hardening | Documented secure deployments, health checks, backups and recovery validated. |

## 11. Immediate next action: original baseline test/build

The mapping is complete, but the original archive has **not yet been proven to build or pass its tests in this runtime**. Before porting anything, establish the upstream baseline in a separate extracted working copy:

1. Confirm Node.js and npm versions against the root engine requirement (`Node >=20.18.0 <25.0.0`, npm `>=10`).
2. Install dependencies using the lockfile without changing the archive (prefer `npm ci`).
3. Run build, lint and tests as separate commands so failures are attributable.
4. Record failing tests, environment-specific limitations and baseline duration.
5. Run migration tests separately and verify the test process does not touch user data.

No GitHub repository upload, push, commit or changes to the user's existing repositories are part of this step.

## 12. Mapping conclusion

The most valuable reuse is the backend's provider adapter foundation, OpenAI-compatible routing, quota observation, usage accounting, encryption/redaction, health/cooldown handling, database migration framework and regression tests. The original dashboard offers useful interaction patterns and components, but must be evaluated against the Android POC. Electron, the general agent/playground/media/search experience, upstream premium/catalog services and its branding are outside the initial Infinity product.

**The mapping is a controlled port plan—not approval to copy every active provider or ship the original application under a new name.** Every initial provider must independently pass authentication, inference, free-tier evidence, region and quota behavior checks.
