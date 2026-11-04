# Infinity Multiple LLM API — Release Readiness 0.16.0

## Assessment

**Status: engineering preview; not production-ready.** This milestone adds end-to-end regression coverage for credential redaction in mid-stream provider errors. It does not claim that the complete inference pipeline or Android application has passed full integration testing.

## Changes in 0.16.0

- Added `server/src/__tests__/routes/proxy-stream-error-redaction.test.ts`.
- The test scripts a provider stream that emits partial assistant content followed by an in-band error containing a bearer-like credential and an `api_key` value.
- Assertions require the client-facing SSE error frame and the persisted request error to omit the secret and contain redaction markers.
- Added a source-contract assertion to `android/scripts/check-preview-contract.mjs`.
- Updated Android version metadata to version code 16 / version name 0.16.0.

## Verified in this preparation environment

- Android/backend source-contract checks: 31/31 passed.
- Node built-in tests: 11 passed, 2 platform-specific tests skipped, 0 failed.
- TypeScript `transpileModule` syntax diagnostics for the new streaming integration test: 0.
- ZIP archive integrity: verified after packaging.

## Not verified

- The new Vitest integration test has **not** been executed. It is syntax-checked and registered in source-contract checks only.
- Full TypeScript semantic build, all backend Vitest tests, CLI/client tests, lint, and production workspace build.
- Android Gradle build, APK output, emulator run, or physical-device run.
- Live provider inference, streaming, usage reconciliation, quota observations, or fallback using operator-owned credentials.
- Local/remote deployment rehearsal, TLS/reverse-proxy configuration, backup/restore, and rollback.

## Release blockers

1. Install dependencies with `npm ci` in a network-enabled runner.
2. Run `npm test`, `npm run build`, and `npm run lint`; resolve failures rather than relying on source-contract checks.
3. Execute the new streaming redaction integration test and the full proxy streaming/usage suites.
4. Build the Android debug APK and test session, provider, discovery, quota, and gateway screens on emulator and physical device.
5. Perform live inference smoke tests for each configured provider, including stream/non-stream parity, usage accounting, provider failure, and fallback behavior.
6. Rehearse local and remote deployment, TLS, credential backup/restore, and rollback.
7. Review licensing notices, secrets hygiene, dependency health, and final repository contents before creating the separate GitHub repository.

## GitHub state

No GitHub repository has been created or pushed by this preparation. The intended new repository remains `Infinity-Multiple-LLM-API`; the existing InfinitySynth repository is not the target.
