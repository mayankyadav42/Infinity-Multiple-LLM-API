# Infinity Multiple LLM API — Provider Registry Audit v0.2

**Phase:** Provider integration and quota audit  
**Source reviewed:** FreeLLMAPI archive supplied in this conversation  
**Purpose:** Decide which existing provider integrations can be adapted into Infinity, and define the provider registry required by the agreed product.

> This is a source-code audit, not a live verification that each provider currently offers a free tier. Provider pricing, regional eligibility, API availability, and model rosters change frequently. No provider should be labeled “verified free” solely because an adapter exists in this repository.

## 1. Main finding

The source has a broad provider-adapter framework, including OpenAI-compatible adapters and dedicated adapters for providers with different API formats. However, its adapter registry is not the same thing as a verified free-provider catalog.

The source also registers non-chat services (web search, scraping, speech, media, decision-only services) alongside LLM inference providers. Infinity must distinguish these capabilities instead of presenting every registered platform as a chat model provider.

## 2. Provider families found in the source

### A. LLM inference / model API candidates

The following are present in the provider registration code as model/inference integrations or OpenAI-compatible gateways. These are **audit candidates**, not confirmed free-tier recommendations:

- Google / Gemini
- Groq
- Cerebras
- Sail
- Aclide
- Speka
- Kenari
- KiosAPI
- Typhoon
- Plugsky
- Inferbase
- SimpleLLM
- LLMTR
- Gizmo
- BlockRun
- Moondream
- JamAI
- BeatAPI
- Apinex
- Onomeo
- IteraCompute
- ElectronHub
- Experiential
- Router9
- Septor
- CLōD
- FreeAI
- Blaze
- Lucidity
- Airforce
- DreamPrompting
- Waterfall
- Logfare
- B.AI
- AnyAPI
- AMD Radeon Cloud / TokenFactory
- NVIDIA NIM
- Mistral
- OpenRouter
- Cohere
- Cloudflare Workers AI
- Zhipu
- Hugging Face
- Ollama
- Kilo
- Pollinations
- LLM7
- OpenCode
- OVH
- Agnes
- Reka
- SiliconFlow
- Routeway
- BazaarLink
- AINative
- Aion
- Requesty
- Navy
- Nara
- SeaLion
- OrcaRouter
- UnoRouter
- xKiro
- ModelScope
- Qianfan
- Volcengine
- LongCat
- iFlytek / XFYun
- AI Horde

Some of these may be aggregators, hosted inference platforms, experimental/community gateways, local runtimes, or trial-credit services rather than recurring no-cost providers. Each requires separate evidence and classification.

### B. Search / retrieval / web services (not chat-model providers)

- Tavily
- Exa
- Firecrawl
- Linkup
- Parallel
- Brave Search

These should be classified under optional tools or external integrations, not included in the free LLM model count. They can be considered later if Infinity expands beyond the current API-management scope.

### C. Other specialized or non-chat integrations

- Speechify (speech/voice-related API)
- SiliconFlow also has media endpoints in addition to chat-compatible API support.
- Moondream has vision-focused capabilities.
- HAL-X and AI SENSE are registered as keyless decision-only providers; they should not be treated as ordinary general-purpose chat model endpoints without checking their exact interface.

## 3. Existing adapter architecture — reuse decision

| Capability | Source status | Infinity decision |
|---|---|---|
| Provider interface/base class | Present | Reuse and refactor behind a stable internal contract |
| OpenAI-compatible adapter | Present and widely used | Reuse; add conformance tests and capability metadata |
| Dedicated provider adapters | Present for nonstandard APIs | Reuse selectively after per-adapter review |
| Provider registration | Central registry in `providers/index.ts` | Replace hard-coded product assumptions with registry metadata |
| Key validation | Provider-specific validation methods | Reuse where reliable; add validation confidence and safe timeouts |
| Model listing | Adapter-dependent | Normalize into Infinity's independent model registry |
| Provider-specific headers / timeouts | Present | Retain as adapter configuration, not product policy |
| OAuth | No provider OAuth authorization-code implementation found in reviewed provider/routes code | Build a separate OAuth integration framework only for providers with official supported flows |
| Free-tier verification | Mixed comments, catalog gates and provider-specific assumptions | Build a dedicated evidence-based eligibility system |

## 4. Quota and usage findings

The existing `provider-quota.ts` service is a strong reusable foundation. It supports:

- quota observations scoped by provider, API key, account, model, endpoint and quota pool;
- multiple metrics including requests, tokens and credits;
- reset timestamps and reset strategies;
- observation sources such as response headers, provider quota APIs, error bodies, local usage, documentation and probes;
- confidence scores, observation history and freshness-aware state;
- shared account pools where multiple models consume one common allowance.

### Provider quota evidence in the current source

- Dedicated provider quota probes are configured for **OpenRouter** and **SiliconFlow** in the provider registry.
- Explicit rate-limit header mappings are configured for **10 platforms** in the quota service: CLōD, Blaze, Router9, Septor, ElectronHub, Groq, Cerebras, OpenRouter, AMD Radeon Cloud and ModelScope.
- Some of these mappings are explicitly marked unconfirmed or depend on observed response headers. They must not be presented as guaranteed exact account quotas.
- Other providers have shared-pool mappings or comments describing limits, but a pool definition is not the same as an official live quota endpoint.

### Infinity quota design

Infinity should preserve four distinct data classes:

1. **Official account quota** — fetched from an official provider usage endpoint. Highest confidence when the endpoint is authoritative and current.
2. **Response rate-limit observations** — parsed from actual API response headers. Useful for RPM/TPM and rolling windows, but may not represent all account-wide limits.
3. **Infinity-observed usage** — count requests and estimate tokens routed through the Infinity gateway. Clearly label it as gateway-observed, not total provider-account usage.
4. **Documented/manual allowance** — provider documentation or user-entered values. Show the source and verification date.

Never convert credits, dollars, characters or image-generation units into tokens unless the provider explicitly defines that conversion. Never invent reset times. Show “Not exposed by provider” or “Unknown” when exact data is unavailable.

## 5. Free-tier verification and model discovery

The source's built-in discovery mechanism is allowlist-based and uses provider `/models` endpoints where compatible. The reviewed code's automatic registration logic skips non-chat models and some models identified as priced/non-free, but an absent price field does not prove that a model is free.

Infinity's agreed policy is stricter:

- Automatically add only models whose free API access is supported by sufficient evidence.
- Put uncertain, ambiguous, potentially paid, promotional or trial-only models in Review.
- Keep free recurring, free restricted, trial-credit, paid and unknown classifications distinct.
- Record evidence URL/source, date checked, region restrictions, payment-card requirement, rate/usage limits, model ID and API compatibility.
- Re-check eligibility periodically and mark stale evidence as stale; do not silently retain a “verified free” label indefinitely.
- Do not assume a provider's public model listing proves API access or a free allowance.

### Proposed evidence grades

- **Verified recurring free:** official provider source confirms recurring free API access and model/API eligibility.
- **Verified restricted free:** official source confirms free access but with significant caps, region restrictions, waitlists or other conditions.
- **Trial / promotional:** temporary credits or one-time grants; never mix into recurring free.
- **Unverified:** insufficient or conflicting evidence; Review queue.
- **Paid / retired:** excluded from free catalog, retained as historical metadata if useful.

## 6. Required Infinity provider registry schema

Each provider record should contain:

- `provider_id` — stable internal slug.
- `display_name` and optional logo/brand metadata.
- `provider_type` — direct_inference, aggregator, local_runtime, search_tool, media_tool, speech_tool, or other.
- `api_protocols` — OpenAI-compatible, Anthropic-compatible, Gemini-native, custom, etc.
- `base_url` and endpoint configuration (where public and stable).
- `auth_methods` — API key, OAuth, keyless, or multiple; OAuth only when officially supported.
- `signup_url`, `developer_docs_url`, `pricing_url`, `usage_dashboard_url`.
- `region_availability` and known signup restrictions.
- `free_tier_classification` and `verification_status`.
- `free_tier_evidence[]` — source URL, claim, checked date, evidence grade.
- `quota_capabilities` — official quota API, response headers, request counters, token counters, reset visibility.
- `quota_pools[]` — account-wide, key-wide, model-specific or endpoint-specific.
- `model_discovery_method` — official catalog API, `/models`, provider feed, manual curated source.
- `adapter_id`, adapter version, health-check method and supported capabilities.
- `status` — active, degraded, paused, retired.
- `last_verified_at`, `last_catalog_sync_at`.

Each model record should separately contain:

- provider ID and exact upstream model ID;
- display name and aliases;
- modality (text, vision, audio, image, embedding, video, etc.);
- chat/completions/responses/embeddings support;
- tool calling, streaming, JSON mode and context-window capability where verified;
- free-tier classification inherited or overridden with evidence;
- restrictions and quota pool association;
- lifecycle status and last verified timestamp.

## 7. OAuth decision and implementation boundary

The source currently relies primarily on API-key entry and encrypted key storage. No reusable generic OAuth authorization-code flow was found in the reviewed provider and route code.

Infinity should not pretend that OAuth is universally available. Implement an OAuth broker only when a provider officially documents a supported flow and permits third-party clients. Store refresh/access tokens encrypted, use state + PKCE where appropriate, validate redirect URIs, support revocation/disconnection, and never collect provider passwords.

Manual API-key entry remains the universal fallback.

## 8. Immediate implementation recommendations

1. Create an Infinity-owned provider registry independent of the original hosted catalog.
2. Split inference providers from search/media/speech/tool providers in the UI and data model.
3. Reuse the base adapter and OpenAI-compatible adapter first; port dedicated adapters only after conformance tests.
4. Reuse the quota observation engine but add a provider capability matrix and source/confidence display in the Android UI.
5. Build a free-tier evidence service and review queue before enabling automatic catalog additions.
6. Keep provider credentials in an encrypted gateway-side vault, with deployment-specific key management; Android is the control panel.
7. Add contract tests for each adapter: validate key, list models, simple completion, streaming, error normalization, rate-limit parsing, timeout and cancellation.

## 9. Important caveats

- This audit inspects source code and comments, not live provider endpoints or current pricing pages.
- Provider comments may describe tests performed by the original maintainers at earlier dates. Treat those as leads, not current guarantees.
- The source registry contains integrations that are not all free, not all chat-capable and not all suitable for the MVP.
- Infinity's provider list should be curated by evidence and capability, not by maximizing the number of integrations.
