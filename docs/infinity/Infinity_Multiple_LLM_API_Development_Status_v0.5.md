# Infinity Multiple LLM API — Development Status v0.5.0

## Current state

The repository is an early development preview based on the MIT-licensed FreeLLMAPI codebase. It is not a production release and no GitHub repository has been created or modified by this preparation step.

## Working areas in source

- Existing Node.js / Express gateway and OpenAI-compatible routing foundation.
- Existing provider adapters, including Google Gemini, Groq and OpenRouter.
- Gateway-side encrypted provider credentials.
- Infinity-owned provider registry and model-specific free-tier evidence registry.
- Android Jetpack Compose control panel source.
- Android Keystore-backed encrypted dashboard session persistence.
- Provider key management UI and backend routes.
- Model Explorer and evidence Review UI.
- Quota pool and 30-day request/token summary UI.
- Unified API client-profile management.
- Daily Google, OpenRouter and Groq discovery scheduling.
- OpenRouter free-route verification and fail-closed deactivation.
- Groq candidate discovery routed to Review.

## Current provider discovery behavior

| Provider | Discovery | Automatic free-catalogue publication |
|---|---|---|
| Google Gemini | Authenticated model list | No; new candidates go to Review pending model-specific pricing evidence and live availability check |
| OpenRouter | Official public model catalogue and model-specific pricing | Yes, only for `:free` IDs with prompt and completion prices exactly zero |
| Groq | Authenticated model list | No; model visibility is insufficient proof of recurring free access |

## Remaining release gates

1. Install dependencies in a network-enabled environment and run the complete backend/client/CLI build and test suites.
2. Run the new Vitest provider-discovery tests.
3. Build the Android app in Android Studio/Gradle and test on emulator and physical device.
4. Test real provider requests with user-owned API keys.
5. Add further provider-specific discovery and quota adapters (Cloudflare, Hugging Face, Gemini quota detail, Groq quota detail, and other providers only after official-source verification).
6. Complete OAuth only where the provider officially supports a suitable flow.
7. Complete device-session management, remote gateway hardening, TLS/reverse-proxy setup, backup/restore, and encryption-key rotation tests.
8. Prepare clean GitHub repository and CI workflows; create/upload only after the source tree is reviewed.

## GitHub destination

The intended destination is a separate repository named `Infinity-Multiple-LLM-API` under the user's existing GitHub account. Do not overwrite the existing InfinitySynth repository. Keep the original upstream MIT license and notices.
