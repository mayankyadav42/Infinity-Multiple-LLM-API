# Infinity Multiple LLM API — Provider Authentication Policy (0.11.0)

## Decision

Infinity will use each provider's supported **server-side inference credential**. It will not offer a generic OAuth button merely because a provider has an OAuth flow for its consumer chat product, web dashboard, or developer console.

The Android app is a control panel. Provider credentials are entered or provisioned through the app but are stored encrypted by the gateway. The Android app stores only its gateway session using Android Keystore.

## Provider capability matrix

| Provider | Inference credential supported by current integration | OAuth decision | Implementation status |
|---|---|---|---|
| Google Gemini Developer API | Gemini API key / authorization API key | Do not assume consumer Google sign-in OAuth is interchangeable with Gemini API credentials. Keep secure key entry. | API-key integration; OAuth not implemented |
| Groq | Groq API key (Bearer) | No verified user-delegated OAuth flow for this inference integration. | API-key integration; OAuth not implemented |
| OpenRouter | OpenRouter API key (Bearer) | Use its API key flow; do not reuse browser login tokens. | API-key integration; OAuth not implemented |
| Cloudflare Workers AI | Account ID + scoped API token | Cloudflare dashboard login OAuth is not a substitute for an account API token used by the gateway. | API-token integration; OAuth not implemented |
| Hugging Face Inference Providers | Hugging Face user access token | Use a scoped token; do not treat website login cookies as API credentials. | API-token integration; adapter remains separate from OAuth |

## Security requirements

1. Never collect provider website passwords, browser cookies, or consumer-chat session tokens.
2. Never embed provider credentials in Android resources, BuildConfig, logs, crash reports, or API responses.
3. Encrypt provider credentials at rest on the gateway; restrict access to authenticated gateway operations.
4. Mask credentials in all UI and API responses. Show a newly created secret only once where applicable.
5. Request the minimum provider scopes/permissions needed. For Cloudflare, use a dedicated token with only the required Workers AI read/inference permissions for the features enabled.
6. OAuth may be added only after official provider documentation confirms an authorization-code flow intended for third-party applications and a supported inference API scope. Use PKCE for public Android clients, validate state, use exact redirect URIs, rotate/refresh securely, and never ship a client secret in the APK.
7. If a provider later offers a first-party OAuth integration for inference, implement it as a provider-specific adapter with explicit consent and revocation—not a generic credential conversion layer.

## Current scope

- Manual API key/token entry remains the common supported path.
- OAuth is not claimed as implemented in 0.11.0.
- Google Cloud service-account / Vertex AI authentication is a separate future integration and must not be conflated with Google Gemini Developer API keys.
- User-facing copy must say “API key” or “API token” where that is what the provider requires.

## Official documentation reviewed

- Google Gemini API key authentication: https://ai.google.dev/gemini-api/docs/api-key
- Cloudflare AI Gateway credentials and account token: https://developers.cloudflare.com/ai-gateway/get-started/
- Hugging Face Inference Providers authentication: https://huggingface.co/docs/inference-providers/index
- Groq API documentation: https://console.groq.com/docs
- OpenRouter API documentation: https://openrouter.ai/docs/api-reference/overview

## Release gate for OAuth

An OAuth integration is accepted only when all of the following are true:

- Official provider docs explicitly support third-party application authorization for the inference API.
- Scopes and token lifetime/refresh/revocation semantics are documented.
- Android flow uses Authorization Code + PKCE and a verified redirect strategy.
- Gateway stores refresh/access tokens encrypted and never returns them to Android after initial exchange.
- Tests cover state mismatch, code replay, token expiry, refresh failure, revocation, and account disconnect.
