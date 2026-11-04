# Infinity build status

Updated: 2026-11-04

## Implemented in this working copy

- Imported the full upstream source tree into the Infinity working repository.
- Preserved upstream `LICENSE`, source headers, and a copy of the upstream README.
- Added Infinity product README and explicit product scope.
- Confirmed a native Google Gemini provider adapter and an existing OpenAI-compatible gateway are present in the inherited backend.
- Confirmed the inherited key-management route supports Google provider keys and the backend encrypts provider credentials through its existing crypto layer.
- Confirmed inherited quota observation hooks are called from the Google provider adapter.

## Not yet verified

- Full dependency installation, build, lint, and test suite. The previous baseline attempt failed before installation completed because npm registry DNS resolution returned `EAI_AGAIN`; offline install also lacked required packages.
- Live Gemini API request: requires the user's own API key and a network-enabled test environment. No API key has been requested or embedded.
- Official free eligibility of each individual Gemini model: provider pricing and account/region availability must be checked per model; a model list response is not sufficient evidence.
- Android build and device pairing: no Android application project existed in the upstream archive. Native app implementation remains a separate workstream.

## Immediate engineering sequence

1. Add an Infinity-owned provider/model evidence registry and review queue.
2. Connect that registry to discovery and model-catalog publication rules.
3. Verify the Gemini provider add-key -> model list -> test inference -> usage/quota observation flow.
4. Add Android pairing and dashboard API support.
5. Validate builds/tests in a network-enabled environment.

## Infinity-specific code added in this development pass

- `server/src/db/migrations/20261104_000001_infinity_model_evidence.ts`: provider registry, model evidence ledger, and discovery-run tables; seeds Google as a restricted-free provider without falsely pre-verifying any model.
- `server/src/services/infinity-free-model-policy.ts`: publication gate requiring current, model-specific, recurring no-charge evidence, plus account-tier and region scope.
- `server/src/__tests__/services/infinity-free-model-policy.test.ts`: unit tests for the core publication decisions.
- Migration registered in `server/src/db/migrate/defaults.ts`.
- `android/`: first native Kotlin/Jetpack Compose gateway-connection preview. It checks `/api/ping` over HTTPS and deliberately does not yet handle login or provider credentials.

## Validation performed in this pass

- Compiled the standalone free-model policy module with the globally available TypeScript compiler.
- Ran eight direct policy smoke cases: all eight passed.
- Executed the new migration SQL against an in-memory SQLite database, verified the Google seed row, and inserted sample evidence/discovery-run records successfully.
- Android build not run: this environment has no Android SDK and no Gradle executable.
- Full monorepo build/tests still blocked pending successful npm dependency installation.
- `server/src/routes/infinity-catalog.ts`: authenticated registry APIs to list registered providers, inspect the Review queue, evaluate/store model-specific evidence, and perform Google-specific live model verification before catalogue insertion.
- `server/src/app.ts`: mounts the Infinity catalog endpoints behind the existing dashboard session middleware at `/api/infinity/catalog`.
- The evidence evaluator now checks the evidence URL host against a provider-specific official-host allowlist (Google's seeded allowlist includes `ai.google.dev`, `generativelanguage.googleapis.com`, and `cloud.google.com`).

Additional validation:

- Expanded free-model policy smoke checks: 8/8 passed, including rejection of evidence hosted on an unapproved domain.
- TypeScript transpile/syntax checks passed for all six changed TypeScript files. This is a syntax check, not a full type-check or monorepo build.
- Migration up/down was re-tested after adding the official-domain allowlist column; SQLite smoke test passed.


## Vertical-slice integration update

- `POST /api/infinity/catalog/evidence/evaluate` now applies the Infinity policy and official-domain allowlist.
- For Google Gemini, it additionally checks the requested model against Google's authenticated `/v1beta/models` response using an enabled encrypted provider key and requires `generateContent` support.
- Only after both evidence and live model-list checks pass does the route call the existing model registration service. Failed or ambiguous checks remain in Review.
- `GET /api/infinity/catalog/providers` and `GET /api/infinity/catalog/review` expose the registry to the authenticated dashboard.
- Other providers are not yet auto-published by this route; each needs its own live model-list verification adapter.
- The Android native preview currently tests the HTTPS gateway health endpoint only; login, pairing, and registry screens are not yet wired.
