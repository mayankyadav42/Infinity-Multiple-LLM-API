# Infinity Multiple LLM API — Provider Discovery Implementation v0.5.0

Date: 2026-11-04

## Scope delivered

This increment extends the Infinity-owned provider/model discovery registry beyond Google Gemini.

### OpenRouter

- Reads the official public model catalogue at `https://openrouter.ai/api/v1/models`.
- A model is considered for automatic free-catalogue publication only when its model ID ends with `:free` and both `pricing.prompt` and `pricing.completion` parse as numeric zero.
- Uses Infinity's free-model evidence policy with model-specific pricing evidence, an explicit OpenRouter account tier label, region caveat, and 24-hour evidence expiry.
- Registers qualifying models into the existing OpenRouter inference provider catalogue.
- Preserves operator rejections and model-removal tombstones.
- Fails closed: if a previously published free route is absent or no longer zero-priced in a successful catalogue response, its evidence is expired and its inference model is disabled.
- Does not claim that an OpenRouter model is available in every geography or at every moment; upstream availability and rate limits remain applicable.

### Groq

- Uses the authenticated `https://api.groq.com/openai/v1/models` endpoint with an enabled, gateway-stored Groq key.
- Records newly observed model identifiers as Review candidates.
- Does not auto-publish based on model-list visibility because the endpoint does not establish the user's account tier or recurring no-charge eligibility.

### Scheduling and Android controls

- Both providers are included in the gateway's daily discovery schedule.
- Android Model Explorer exposes provider-specific discovery actions for Google, OpenRouter, and Groq.
- Review evidence submission uses the actual provider ID from the evidence row rather than assuming every candidate is Google.
- The provider registry migration seeds official documentation domains and discovery settings for Groq and OpenRouter.

## Files added or modified

- `server/src/services/infinity-provider-discovery.ts`
- `server/src/db/migrations/20261104_000003_infinity_provider_discovery.ts`
- `server/src/routes/infinity-catalog.ts`
- `server/src/services/infinity-discovery.ts`
- `android/app/src/main/java/com/infinity/multiplellmapi/MainActivity.kt`
- `android/app/build.gradle.kts`
- `android/scripts/check-preview-contract.mjs`
- `server/src/__tests__/services/infinity-provider-discovery.test.ts`
- `android/README.md`
- `README.md`
- `CHANGELOG_INFINITY.md`

## Verification performed in this environment

- Android/backend source-contract checks: 20/20 passed.
- TypeScript transpilation syntax checks for the four changed backend TypeScript files: 4/4 passed with zero syntax diagnostics.
- SQLite migration smoke test: migration up seeded Groq and OpenRouter; migration down removed both seeded rows.
- Existing Node built-in tests: 11 passed, 2 platform-specific tests skipped, 0 failed.
- ZIP integrity checked after packaging.

## Verification not performed

- Full TypeScript semantic build: blocked because npm dependencies and Node type declarations are not installed; npm registry DNS was unavailable in the earlier baseline attempt.
- Vitest provider discovery tests: test source is added but Vitest cannot run until npm dependencies are installed.
- Live calls to OpenRouter and Groq: not run from this environment; the runtime's network access is restricted.
- Android Gradle compilation, APK generation, emulator testing, and physical-device testing: Android SDK/Gradle are unavailable here.
- Production security review and remote hybrid deployment test: pending.

## Important operational note

The OpenRouter auto-publication rule is deliberately narrow. A future provider adapter must never infer free access from a model-list response alone. Each provider needs an explicit evidence strategy, an expiry policy, and a fail-closed response when pricing or eligibility becomes uncertain.
