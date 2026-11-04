# Infinity Multiple LLM API — Changelog

## 0.4.0 — Google model evidence workflow

- Added daily scheduled Google Gemini model discovery using an enabled gateway key.
- Newly discovered model identifiers are recorded as unverified candidates in the Review queue; discovery never treats model-list visibility as proof of free access.
- Added model evidence listing and review dismissal endpoints.
- Added model-specific evidence storage, official HTTPS host allowlisting, recurring-free evidence evaluation, and authenticated Google model availability checks.
- Expanded Android quota display and unified API client-profile management.

## 0.5.0 — OpenRouter and Groq discovery

- Added OpenRouter discovery; only `:free` IDs with exactly zero prompt and completion prices can be automatically published.
- Added Groq authenticated model discovery; model visibility alone is not treated as proof of free access and candidates enter Review.
- Added provider registry entries, routes, Android controls, and daily discovery.
- Added fail-closed OpenRouter reconciliation: disappeared or no-longer-zero-priced routes have their evidence expired and model disabled.
- Preserved operator rejections and model-removal tombstones.

## 0.6.0 — Cloudflare Workers AI discovery

- Added authenticated, account-scoped Cloudflare Workers AI model discovery.
- Kept catalogue candidates in Review because model visibility does not prove recurring free usage.
- Kept account-wide neuron allowance separate from model-level evidence.

## 0.7.0 — Quota provenance

- Added quota source, observation time, and confidence metadata to the Android usage view.
- Kept unavailable limits and reset times unknown rather than estimating them.

## 0.8.0 — Hybrid deployment and security runbook

- Added local PC/home-server and remote VPS deployment guidance.
- Documented loopback binding, TLS reverse proxy, trusted proxy configuration, allowed hosts, Android connection, backup/restore, and operational checks.
- Added a pre-production security checklist with explicit operator verification gates.

## 0.9.0 — Dashboard session management

- Added authenticated session listing with hashed identifiers and safe metadata only.
- Added account-scoped individual session revocation and revoke-other-sessions support.

## 0.10.0 — Android session management

- Added the Signed-in Devices section to the Android Gateway screen.
- Added refresh, individual session revocation, and sign-out-other-devices actions.

## 0.11.0 — Provider authentication policy

- Added a provider-by-provider authentication capability matrix and explicit OAuth eligibility rules.
- Clarified that provider website sign-in, consumer chat sessions, and browser cookies are not inference API credentials.
- Retained encrypted gateway-side API key/token management as the supported integration path.
- Documented PKCE, state validation, redirect, refresh, revocation, and test gates required before any future OAuth implementation.

## 0.12.0 — Release-readiness consistency and session regression tests

- Corrected Android and root documentation that still described older preview versions or claimed session management was not implemented.
- Documented session-management API endpoints and the metadata intentionally omitted from the UI.
- Added an integration regression test for safe session listing, individual revocation, and revoke-others behavior.
- Added source-contract checks for documentation/version consistency.
- No provider OAuth flow is claimed or added; API key/token authentication remains the supported path for current providers.

## Release validation still required

- Full dependency installation, TypeScript semantic build, backend Vitest suite, CLI/client tests, lint, and production workspace build.
- Android Gradle debug APK build, emulator/physical-device checks, and session lifecycle verification on a live gateway.
- Live provider authentication, discovery, quota, and inference checks using operator-owned credentials.
- Remote deployment, TLS, reverse-proxy, firewall, backup, restore, and rollback checks in the target environment.

## 0.13.0 — Session self-revocation guard

- Prevented the individual session-revocation endpoint from revoking the caller's own active session; it returns HTTP 409 with `current_session` and directs the caller to the explicit logout endpoint.
- Added a regression assertion that the current session remains authenticated after a self-revocation attempt.
- Updated Android preview version metadata and documentation.


## 0.14.0 — Cloudflare inference credential validation

- Hardened the Cloudflare inference adapter to validate the account ID as exactly 32 hexadecimal characters and reject empty tokens before constructing upstream URLs.
- Added provider tests for malformed account IDs and empty tokens; updated existing fixtures to use valid Cloudflare account IDs.
- Kept the documented credential format as `account_id:api_token`; no credentials or tokens are logged.
- Updated Android version metadata and project documentation.


## 0.15.0 — Cloudflare streaming credential regression coverage

- Extended Cloudflare credential-validation regression coverage to the streaming inference path, ensuring malformed account IDs are rejected before an upstream request is opened.
- Added a whitespace-only token regression case to verify trimming is applied before credential acceptance.
- Updated Android version metadata and project documentation to 0.15.0.


## 0.16.0 — Streaming provider error redaction integration coverage

- Added an end-to-end gateway regression test for a provider that emits a partial response followed by an in-band streaming error containing credential-shaped values.
- Asserted that the client-facing SSE error frame and persisted request analytics both redact the provider secret.
- Added the test to the Android/backend source-contract check so the regression coverage cannot silently disappear.
- Updated Android version metadata and preview documentation to 0.16.0.
- The integration test source is syntax-checked but remains unexecuted until Vitest dependencies are installed in a network-enabled environment.
