# Infinity Android control panel — development preview 0.16.0

The Android app is the primary control panel. The Node.js gateway runs on a local PC/home server or remote VPS. The phone connects to that gateway; it does not host the long-running API server.

## Implemented in this preview

- HTTPS gateway health check, first-run administrator setup, and sign-in.
- Session persistence encrypted with AES-256-GCM using a non-exportable Android Keystore key.
- Session restoration is validated against `/api/auth/status` before the app opens the dashboard.
- Logout revokes the current server session when reachable and always removes local ciphertext.
- Signed-in Devices lists active sessions without returning bearer credentials, marks the current session, and supports individual revocation or revoking every other session.
- Gateway switching never forwards the old session token to the new gateway and requires fresh authentication.
- Provider directory, masked credential listing, add, edit/replace, enable/disable, health-check and remove flows. Manual API-key onboarding is implemented; provider-specific OAuth flows are not yet implemented.
- Model catalogue loaded from the connected gateway.
- Google, OpenRouter, Groq and Cloudflare Workers AI model discovery initiated from the app and also scheduled daily by the gateway.
- Discovery candidates are placed in Review; a provider's model-list endpoint is not treated as proof of free API access.
- Evidence review flow: submit model-specific official pricing evidence, account tier and region. The gateway checks the evidence host and verifies the model is currently available through the authenticated Google API before publishing it.
- Review items can be dismissed without adding them to the inference catalogue.
- Quota-pool display from `/api/free-tier`, including provider metric, reported remaining/limit and reset time when available.
- Request and token totals for the last 30 days from `/api/analytics/summary`.
- Unified API client-profile management: create, list, enable/disable, rotate and delete keys.
- Full client key is shown once after create/rotation and can be copied; only masked keys are listed later.
- OpenAI-compatible endpoint guidance (`<gateway>/v1`).
- Overview, Providers, Models, Usage and Gateway navigation.
- Simple Mode by default and the animated transition to Advanced Mode.

## Discovery and free-tier evidence boundaries

The scheduled discovery adapters cover Google Gemini, OpenRouter, Groq and Cloudflare Workers AI. Google discovery uses an enabled Google API key and queues unknown models for Review. Groq discovery requires an enabled Groq API key and queues model-list candidates for Review because visibility alone does not establish free-tier eligibility. OpenRouter discovery reads its official public model catalogue and automatically publishes only IDs ending in `:free` where both prompt and completion prices are exactly zero. OpenRouter evidence expires after 24 hours and is refreshed daily; if a previously published route disappears or no longer has zero prices, Infinity expires its evidence and disables that inference model. Operator rejections and removal tombstones are respected.

A reviewer can submit a model-specific official pricing source, account tier and region. The gateway checks HTTPS and the provider's official-host allowlist, applies Infinity's recurring-free policy, and performs provider-specific live checks where implemented. Google has an authenticated model-list check. OpenRouter uses its official model-specific pricing response. Groq and Cloudflare candidates remain review-only until recurring free-tier evidence is established. Cloudflare discovery uses the authenticated account-scoped Workers AI model search endpoint and requires the existing `account_id:api_token` credential format. Workers AI neuron allowance is account-wide; this catalogue-discovery adapter does not claim to retrieve the current account balance or remaining daily neurons. Provider-specific OAuth onboarding also remains outstanding and will only be enabled for providers with documented official OAuth support.

## Credential and session boundaries

- Provider API keys are submitted over HTTPS and stored only by the gateway's encrypted credential store. The Android app does not persist provider keys.
- The dashboard bearer token and gateway/email metadata are encrypted with AES/GCM/NoPadding and stored as ciphertext in private SharedPreferences.
- The AES key is generated in Android Keystore and is not exported by the app. Invalidated keys or corrupt ciphertext fail closed and require a new sign-in.
- App backup is disabled in the Android manifest.
- HTTPS is mandatory for local LAN and remote gateway URLs. Cleartext traffic is disabled; configure TLS for a LAN gateway.
- The app manages client-profile API keys using the existing dashboard-session-gated backend routes. Full keys are shown only on create/rotation responses.
- Session metadata is limited to creation time, expiry time, and whether the session is current; client IP and device fingerprint are intentionally not inferred.

## Build

Open the `android/` directory in Android Studio using JDK 17. Let Gradle resolve the Android Gradle Plugin and AndroidX dependencies, then run the `app` configuration on an Android 8.0/API 26 or newer device or emulator.

The development container used to prepare this preview does not have the Android SDK or Gradle installed, so APK compilation and on-device behavior are **not verified here**. The GitHub Actions Android workflow is configured to assemble a debug APK, but this workflow has not yet run for this project. Treat this as source implementation preview, not a release APK.

## Backend endpoints used

- `GET /api/auth/status`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/:sessionId`
- `POST /api/auth/sessions/revoke-others`
- `GET /api/keys/providers`
- `GET /api/keys`
- `POST /api/keys`
- `PATCH /api/keys/:id`
- `DELETE /api/keys/:id`
- `POST /api/health/check/:keyId`
- `GET /api/models`
- `GET /api/free-tier`
- `GET /api/analytics/summary?range=30d`
- `GET /api/infinity/catalog/review`
- `POST /api/infinity/catalog/discover/google`
- `POST /api/infinity/catalog/discover/openrouter`
- `POST /api/infinity/catalog/discover/groq`
- `POST /api/infinity/catalog/discover/cloudflare`
- `POST /api/infinity/catalog/evidence/evaluate`
- `GET /api/infinity/catalog/providers`
- `GET /api/infinity/catalog/models`
- `GET /api/infinity/catalog/runs`
- `POST /api/infinity/catalog/review/:id/dismiss`
- `GET /api/client-profiles`
- `POST /api/client-profiles`
- `PATCH /api/client-profiles/:id`
- `POST /api/client-profiles/:id/rotate`
- `DELETE /api/client-profiles/:id`
- `GET /api/ping`

## Offline source-contract check

From the repository root, run:

```bash
npm run test:android-contract
```

This verifies source-level client/backend contracts. It does not replace TypeScript semantic compilation, an Android Gradle build, emulator testing, or live provider verification.


## Session safety note

The individual session-revocation endpoint refuses to revoke the caller's current session (HTTP 409, `current_session`). Use `POST /api/auth/logout` to end the current session deliberately. This guard helps prevent an accidental self-revocation from the signed-in devices interface.
