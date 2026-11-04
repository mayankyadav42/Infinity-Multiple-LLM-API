# Infinity Multiple LLM API

**An Android-first control panel and hybrid gateway for managing multiple LLM provider accounts, discovering genuinely free API models, monitoring usage, and exposing one OpenAI-compatible endpoint to external clients.**

> Development status: foundation assembled from the MIT-licensed FreeLLMAPI project. Infinity-specific product work is in progress. This repository is not yet a production release.

## Product scope

- Android is the primary control panel.
- The gateway can run locally (on a PC/home server) or remotely (on a VPS). Android connects to either deployment; it is not required to host the gateway process.
- Connect provider accounts using API keys. The current Android preview implements manual key onboarding; provider-specific OAuth onboarding is an outstanding integration task and will only be added where the provider officially supports it.
- Encrypt provider credentials at rest in the gateway's deployment environment.
- Discover providers and models automatically. Automatically publish only models with current, model-specific evidence of recurring no-charge API access. Put uncertain, trial-only, or potentially paid models in Review.
- Track tokens and requests, provider rate-limit headers, credits, quota pools, reset windows, source, confidence, and last-observed time. Never invent a reset time or claim an estimate is an official quota.
- Expose a single OpenAI-compatible API endpoint and Infinity API key for external agents and applications.
- Keep chat/voice agent experiences outside this product's current scope.

## Current foundation

The initial codebase is derived from [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi), licensed under MIT. The upstream `LICENSE` and copyright notices are retained. See [`UPSTREAM_NOTICES.md`](UPSTREAM_NOTICES.md) and [`UPSTREAM_README.md`](UPSTREAM_README.md).

The inherited code includes an Express/TypeScript gateway, provider adapters (including Gemini), encrypted provider-key storage, an OpenAI-compatible proxy, quota observation, model catalog logic, and a React/Vite dashboard. Infinity-specific free-model evidence, provider discovery adapters, quota provenance, hybrid deployment guidance, and a native Android control panel have been added; release validation remains in progress. The native Android preview includes Keystore-backed gateway sessions, signed-in device/session management, provider-key lifecycle management, scheduled Google, OpenRouter, Groq and Cloudflare discovery, evidence review, quota provenance, 30-day request/token summaries, and unified API client-key management. OpenRouter `:free` models are automatically published only when its official model catalogue reports zero prompt and completion prices; Groq model-list candidates remain in Review until free-tier evidence is verified. Android build and device testing remain outstanding; OAuth is intentionally not implemented for providers whose inference APIs use API keys or scoped API tokens, and Hugging Face discovery remains a future adapter.

## Repository layout

- `server/` — Node.js / Express gateway and provider adapters.
- `client/` — React / Vite dashboard foundation.
- `shared/` — shared TypeScript contracts.
- `cli/` — inherited CLI (retained pending scope cleanup).
- `desktop/` — inherited Electron app (not part of the initial Infinity release target).
- `android/` — native Android Jetpack Compose control panel (development preview 0.16.0).
- `docs/infinity/` — Infinity product and engineering documents.

## Development prerequisites

- Node.js `>=20.18.0 <25.0.0`
- npm `>=10`

Install dependencies and run the inherited project:

```bash
npm ci
npm run dev
```

Build and test:

```bash
npm run build
npm test
```

The source baseline has not yet been verified in the current build environment because npm registry DNS resolution failed during dependency installation. Do not treat build or test status as passing until these commands complete successfully in a network-enabled environment.

## Security notes

- Never commit `.env`, provider API keys, OAuth tokens, database files, or encryption master keys.
- Use HTTPS for remote gateway connections.
- Keep the gateway bound to loopback for local-only deployments unless an explicit secure reverse-proxy/network configuration is provided.
- Rotate encryption keys using the supported migration/rotation workflow; keep backups of the old key until rotation is verified.
- Provider free-tier status is model-specific and can change. A model's presence in a provider `/models` endpoint is not proof of free access.

## License

MIT. The upstream MIT license and notices are preserved. Infinity-specific additions are also provided under MIT unless a file states otherwise.

## Android control-panel preview 0.16.0

An Infinity-owned native Android Jetpack Compose application is included under [`android/`](android/). It includes Android Keystore-backed AES-GCM sessions, provider credential management, Google, OpenRouter, Groq and Cloudflare Workers AI model discovery with an evidence Review workflow, quota pools plus 30-day request/token summaries, and unified API client-key creation/rotation/revocation. See [`android/README.md`](android/README.md) for the implementation boundaries and backend endpoint contract. The OpenRouter adapter fails closed by expiring and disabling previously published free routes when they disappear or no longer report zero prices. Cloudflare catalogue results are review-only; account-wide Workers AI neuron entitlement is not inferred from model visibility.

The Gateway screen also manages active dashboard sessions: it lists safe session metadata, identifies the current session, and supports individual or bulk revocation. The provider-authentication policy and OAuth eligibility limits are documented in `docs/INFINITY_PROVIDER_AUTHENTICATION_POLICY_v0.11.md`.

The Android source has not been compiled against an Android SDK in this development environment. Do not treat this source preview as a verified APK or production release.

### Quota provenance (0.7.0)

The quota dashboard exposes the source, observation timestamp, and confidence of the latest selected provider quota observation. Missing provider limits and reset times remain unknown rather than being estimated.

## Infinity provider authentication policy

See [`docs/INFINITY_PROVIDER_AUTHENTICATION_POLICY_v0.11.md`](docs/INFINITY_PROVIDER_AUTHENTICATION_POLICY_v0.11.md) for the provider-by-provider API credential matrix and the security gates required before adding OAuth.

## Release readiness

See [`docs/infinity/RELEASE_READINESS_v0.16.md`](docs/infinity/RELEASE_READINESS_v0.16.md) for the latest verified checks, known limitations, and remaining production release blockers. The v0.12 assessment is retained as historical context.
