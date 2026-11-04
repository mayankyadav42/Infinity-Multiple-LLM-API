# Infinity Multiple LLM API — Source Audit (Phase 1)

**Date:** 3 November 2026  
**Source:** Uploaded `freellmapi-main` archive (MIT-licensed)  
**Audit status:** Focused deep audit of provider integration, quota/usage, model discovery, credentials, and authentication. This is not yet a line-by-line review of every file in the 1,398-entry archive, and no tests/build have been run in this pass.

## 1. Product decisions locked

- Android app is the primary control panel.
- Hybrid deployment: local or remote gateway.
- Monitor both tokens and requests.
- Automatically discover providers and models.
- Automatically register verified free models; place uncertain or potentially paid entries in Review.
- Support manual API keys and official OAuth where providers support it.
- Store provider credentials encrypted at the gateway; do not keep ordinary plaintext copies on Android.
- Chat/voice agent UI remains a separate product.
- Simple Mode is the default; Advanced Mode includes all Simple Mode capabilities plus technical controls, with the agreed animated transition.

## 2. What the source already provides

### Provider integration

- A common `BaseProvider` contract for chat, streaming, key validation, timeouts, and optional quota probing.
- Dedicated adapters for providers with non-standard APIs and a reusable `OpenAICompatProvider` for OpenAI-compatible services.
- The provider picker allowlist contains 81 platform identifiers, including the `custom` placeholder. These identifiers are not all ordinary LLM providers: the registry also includes search, embeddings, speech, media, keyless and specialty services. Infinity should classify providers by capability instead of copying the allowlist blindly.
- Provider-specific error handling, retry-after parsing, cooldowns, key health checks, proxy support and routing are already substantial reusable work.

**Recommendation:** Reuse the provider adapter pattern and compatible adapters, but create an Infinity-owned provider registry with explicit capability flags (chat, streaming, tools, vision, embeddings, audio, quota API, OAuth, free-tier evidence, region restrictions).

### Quota and usage monitoring

- `provider-quota.ts` parses provider rate-limit headers, records observations with a source and confidence score, keeps a latest-state snapshot, and retains an observation history.
- Existing observation sources include headers, provider quota APIs, error bodies, local usage, documentation and probes.
- Header parsing supports both generic `x-ratelimit-*` headers and provider-specific mappings. Explicit mappings include providers such as Groq, Cerebras, OpenRouter, Radeon, Clod, Blaze, Router9, Septor, ElectronHub and ModelScope.
- Dedicated provider quota API polling is supported by the adapter framework. In the current registry, quota-probe endpoints are configured for **OpenRouter** and **SiliconFlow**. Other providers may still report usable limits in response headers or error responses.
- Health checks piggyback quota API polling at most every 15 minutes per key when a provider exposes a quota probe.
- `ratelimit.ts` records request/token usage for traffic passing through the gateway and applies local routing guards. The proxy uses actual upstream token usage when available and estimates when providers omit usage.
- The monthly key usage ledger counts successful requests and input/output tokens. It is separate from authoritative provider account quotas.
- Quota metrics currently include requests, tokens, credits and neurons.

**Important distinction:** Infinity can count requests and tokens that pass through its gateway. It cannot know the provider account's complete consumption from other apps unless that provider exposes a usage/quota API. These values must therefore be shown separately as provider-reported versus Infinity-observed/estimated.

**Recommendation:** Reuse the observation pipeline and local usage ledger. Expand the data model to support additional provider-native units (for example characters, images, seconds or compute units) while keeping the main dashboard's token/request summaries. Add an explicit account layer so multiple keys belonging to one provider account do not accidentally look like multiple independent free quotas.

### Model discovery

- The project has an adapter-based `/models` discovery service, metadata parsing, model-kind classification, deduplication, tombstones and insert-only registration.
- Built-in automatic discovery is currently restricted to an allowlist of only `longcat` and `siliconflow`.
- The original discovery mode defaults to `manual`; enabling `auto` changes the behavior.
- The original `autoRegistrable()` filter excludes known non-chat models and known paid models when pricing metadata is present. However, a model with no pricing metadata can pass the filter. That is **not strict enough** for Infinity's verified-free policy.
- The original signed catalog remains authoritative and is tied to the original service. The source's comments explain that catalog ownership and Premium/free timing affect which models can be seen by each installation.

**Recommendation:** Build an independent Infinity registry and discovery pipeline. Require positive free-tier evidence before auto-registration. Unknown pricing, ambiguous model IDs, limited trials and uncertain free grants must go to Review. Retain evidence URL/source, checked time, region, tier conditions, model capabilities and confidence for every entry.

### Credentials and authentication

- Provider API keys are encrypted at rest with AES-256-GCM.
- The encryption key is supplied through `ENCRYPTION_KEY` in production. Development can generate a local `.encryption-key` file with restrictive file permissions.
- The dashboard admin surface uses a session-based user login. The unified `/v1` API uses a separate unified API key for client applications.
- The source has manual API-key entry, import/export, masked display and a protected reveal route.
- A repository-wide source search found no provider OAuth authorization-code/PKCE or refresh-token integration. Provider authentication is effectively manual API-key based today.

**Recommendation:** Retain encrypted gateway-side storage. Add a credential-provider abstraction that supports API keys now and official OAuth flows individually when available. For OAuth, use provider-supported authorization/PKCE and encrypted refresh/access tokens; never collect provider passwords. Use Android Keystore for app-side session/device secrets, not as a reason to duplicate the provider vault on the phone.

## 3. Android and deployment gap

- The source is a Node.js/Express backend with a React/Vite web client, shared TypeScript types, CLI and Electron desktop client.
- No native Android application module was found in the archive. The existing React dashboard is not a native Android app.
- Local and remote operation are plausible with the backend, but Infinity still needs a deliberate local runtime and remote-server deployment contract.

**Recommendation:** Keep the backend API contract deployment-neutral. Build the Android client as a dedicated Android app (the UI implementation technology is a later implementation decision), and make it connect to either a local gateway or a configured remote gateway. Do not assume the current web dashboard alone satisfies the Android requirement.

## 4. Security and operational changes required

- The backend's default host is `::` (all IPv6 interfaces/dual-stack behavior); local mode should bind to loopback by default.
- The host allowlist guard is disabled when `ALLOWED_HOSTS` is unset. Remote deployments should require an explicit host allowlist and HTTPS reverse proxy, with firewall restrictions and secure session/API-key handling.
- The encryption key must be backed up separately from the database. Losing it makes stored provider credentials undecryptable; placing it inside a database backup would defeat the separation.
- The existing first-run setup flow has a one-time setup code for remote account claiming and a loopback convenience path. Infinity must preserve secure bootstrap behavior while making local and remote setup clear.
- Audit database export/import, reveal-key authorization, log redaction, backup encryption and secret rotation before public server deployment.

## 5. Reuse / modify / rebuild decision

| Area | Decision |
|---|---|
| Provider adapter base and compatible adapters | Reuse, then audit each provider's active/free status |
| Retry, cooldown and failover logic | Reuse and adapt to Infinity routing policy |
| Quota observation engine | Reuse; expand metrics, account grouping and evidence display |
| Gateway-side request/token metering | Reuse; clearly label estimates and gateway-only coverage |
| Built-in model discovery | Reuse parsing utilities; replace allowlist and free verification policy |
| Signed model catalog service | Replace with an independent Infinity registry |
| Manual API-key workflows | Reuse and redesign for Android |
| Provider OAuth | Build provider-by-provider where officially supported |
| React/Vite dashboard | Reuse selected design concepts/components if useful |
| Native Android app | Build; absent from source archive |
| Electron desktop client | Exclude from initial scope |
| Separate chat/voice agent UI | Exclude from current scope |

## 6. Proposed Infinity-owned data concepts

1. **Provider** — identity, official URL, regions, capability set, auth methods, lifecycle status.
2. **ProviderAccount** — optional account identity/label and provider-specific account metadata; allows multiple keys to share one account quota.
3. **Credential** — encrypted API key or OAuth credential, linked to provider account and deployment vault.
4. **Model** — canonical ID, provider ID, capability metadata, free-tier classification and evidence.
5. **QuotaObservation** — metric/unit, limit, remaining/used, reset, source, confidence and timestamp.
6. **UsageEvent** — request/token measurements observed by Infinity, with actual-versus-estimated provenance.
7. **DiscoveryReview** — unverified models/providers and evidence requiring approval or more research.
8. **GatewayKey** — Infinity-issued API keys with scopes, revocation, last-used time and rate limits.

## 7. Immediate implementation backlog

1. Finish the remaining provider audit: classify each registered adapter by capability, free-tier evidence, region and lifecycle status; identify retired/paid-only entries.
2. Define Infinity provider/model/account/credential/quota schemas before migrating old database tables.
3. Specify a strict free-tier evidence policy and review workflow.
4. Define the stable OpenAI-compatible gateway API, error mapping, streaming and client-key scopes.
5. Define local-vs-remote deployment security and credential-vault behavior.
6. Design the Android app navigation and screen requirements from the module list.
7. Only then begin modifying source code and preparing the clean Infinity repository.

## 8. Audit limitations

This pass inspected core provider, quota, discovery, credential and authentication files plus related migrations/routes. It did not execute the build or tests, audit every provider implementation, verify current external free-tier offers, or complete a full application security review. Those remain explicit tasks rather than implied approvals.
