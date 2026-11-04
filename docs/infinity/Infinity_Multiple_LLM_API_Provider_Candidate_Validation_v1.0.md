# Infinity Multiple LLM API — Provider Candidate Validation v1.0

**Date checked:** 3 November 2026  
**Status:** Preliminary official-documentation review; not yet an end-to-end account/API test.  
**Purpose:** Select a small, defensible first integration set and define how Infinity labels free access.  
**Important:** Provider terms, eligible models, quotas and region availability can change. The Android app must display evidence freshness and must not treat this snapshot as permanent truth.

## 1. Classification rules used

| Infinity class | Meaning |
|---|---|
| `verified_free_api` | Official provider evidence confirms a recurring, no-charge API allowance for the particular API/model. Model-level eligibility must still be checked. |
| `restricted_free_api` | No-charge API access exists, but is limited by model, usage window, account tier, geography, eligibility or other material conditions. |
| `monthly_credits` | The provider supplies a finite credit balance periodically. It is free to the user while credits remain, but is not an unlimited free tier. |
| `trial_credits` | Temporary or one-time promotional credits. Never describe this as recurring free access. |
| `review_required` | Official evidence is conflicting, incomplete, account-dependent or insufficient to certify no-charge use. |

Infinity's free catalogue must be model-specific. A provider may offer both free and paid models under the same API key.

## 2. Official-source findings

### 2.1 Google Gemini Developer API

**Preliminary classification:** `restricted_free_api`  
**Adapter in source:** `server/src/providers/google.ts` (native Gemini API adapter)  
**Protocol:** Gemini-specific API; requires a dedicated adapter rather than assuming generic OpenAI compatibility.

The official pricing page advertises a Free Tier with free input/output tokens, while specifying limited access to certain models. It also states that content from the Free Tier may be used to improve Google's products. The official rate-limit page describes tier-dependent RPM/TPM and spend-based limits; the Free tier has no spend-based rate limit in the cited table.

**Infinity requirements:**
- Verify access separately for every model ID; do not mark the entire Gemini catalogue as free.
- Record the free-tier data-use notice prominently in provider onboarding.
- Capture request/token limits per model/account when exposed; do not hardcode one global quota.
- Store reset and limit observations from official API signals where available; mark account dashboard-only information as provider-reported/manual where no API exists.

Official sources:
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits

### 2.2 GroqCloud

**Preliminary classification:** `restricted_free_api`  
**Adapter in source:** registered generic `OpenAICompatProvider` for `groq`  
**Protocol:** OpenAI-compatible chat completions.

Groq's official rate-limit documentation explicitly lists request and token dimensions including RPM, RPD, TPM, TPD, and input/output token limits. It says limits apply at the organization level, and the API supplies rate-limit headers for limit, remaining and reset information. Exact limits vary by model and organization and should be read from the account's Limits page rather than assumed from a universal quota.

**Infinity requirements:**
- Read and preserve Groq rate-limit response headers.
- Track organization/account-level quota pools, not one independent pool per stored API key unless provider evidence supports that.
- Display the exact observed model-specific values and their last-observed time.
- Verify the active free plan and free-model eligibility at account connection time.

Official source:
- https://console.groq.com/docs/rate-limits

### 2.3 Cloudflare Workers AI

**Preliminary classification:** `restricted_free_api`  
**Adapter in source:** `server/src/providers/cloudflare.ts`  
**Protocol:** Cloudflare account-scoped Workers AI API; credential is documented in source as account ID plus API token.

Cloudflare's Workers AI pricing documentation, last updated 1 October 2026, describes 10,000 Neurons per day at no charge. The daily allocation resets at 00:00 UTC. The same page identifies models that require a paid billing method or prepaid AI Gateway credits. Cloudflare's error documentation distinguishes daily free-allocation exhaustion from temporary capacity errors.

**Infinity requirements:**
- Quota unit must include `neurons`; do not convert it into token counts.
- Track daily reset at 00:00 UTC only where the account's documented plan and endpoint match this rule.
- Verify model-specific paid-plan restrictions before adding a model to the free catalogue.
- Distinguish account quota exhaustion from provider capacity errors.

Official sources:
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/errors/

### 2.4 OpenRouter

**Preliminary classification:** `restricted_free_api` (model-specific)  
**Adapter in source:** generic `OpenAICompatProvider` for `openrouter`, with a dedicated key-info quota probe.  
**Protocol:** OpenAI-compatible aggregator/router.

OpenRouter's official free-model collection states that listed models have $0 model pricing. It also explains that `:free` variants have plan-based rate limits: 20 requests per minute and 50 requests per day on the free account, with a higher daily allowance after at least $10 of credits have been purchased. OpenRouter's pricing page describes a free plan with 25+ free models and 4 free providers, but availability changes as models/providers are added or removed. The source adapter also defines a key-info endpoint to read credit limits/remaining values when present.

**Infinity requirements:**
- Use the provider's live model catalogue and model-specific `:free`/pricing metadata; never seed a fixed permanent list.
- Label `openrouter/free` as an auto-router target only if the live API confirms its availability and zero-price behavior.
- Model pricing and request caps are different dimensions; show both.
- A model priced at $0 is not automatically eligible for the `:free` account cap rules unless provider documentation says so.
- Preserve the dedicated account key/credit observation probe and request/token headers.

Official sources:
- https://openrouter.ai/collections/free-models
- https://openrouter.ai/pricing

### 2.5 Hugging Face Inference Providers

**Preliminary classification:** `monthly_credits`  
**Adapter in source:** generic `OpenAICompatProvider` for the Hugging Face router.  
**Protocol:** OpenAI-compatible routing endpoint; model availability and billing depend on the selected inference provider and route.

Hugging Face's official pricing documentation states that Free users receive $0.10 in monthly credits for Inference Providers, subject to change. Additional usage is pay-as-you-go and requires purchased credits. The same page differentiates requests routed/billed by Hugging Face from requests using a user's custom provider key; custom provider-key requests are billed directly by the external provider and do not consume Hugging Face's included monthly credits.

**Infinity requirements:**
- Do not display the whole Hugging Face catalogue as “free.”
- Label included credit as a finite monthly credit pool, not unlimited free usage.
- Distinguish Hugging Face-routed requests from custom provider-key requests.
- Where billing depends on the selected inference partner, record provider/route identity separately.

Official source:
- https://huggingface.co/docs/inference-providers/pricing

### 2.6 Cerebras Inference

**Preliminary classification:** `review_required`  
**Adapter in source:** `server/src/providers/openai-compat.ts` generic adapter registered for `cerebras`  
**Protocol:** OpenAI-compatible inference.

The official Cerebras documentation currently presents inconsistent descriptions. Its inference-docs pricing page lists a $0 Free tier with lower rate limits. The current Cerebras inference product page describes a $5 free credit after account creation, and a separate support FAQ documents PayGo pricing. This may reflect different account paths or stale documentation; the available public sources do not establish a clear, recurring free allocation that Infinity can certify without account-level verification.

**Infinity requirements:**
- Keep Cerebras in Review until account-level and current terms are reconciled.
- Do not treat the $5 credit as recurring free quota.
- During validation, establish whether a new account gets an ongoing no-charge allowance after trial credit exhaustion.
- Capture model-specific limits and billing eligibility before marking any model verified free.

Official sources:
- https://inference-docs.cerebras.ai/support/pricing
- https://www.cerebras.ai/inference
- https://support.cerebras.net/articles/5041581099-cerebras-self-serve-paygo-faq

## 3. Proposed first integration-validation set

This is a test order, not a promise that every model from these providers will be included in the free catalogue.

| Priority | Provider | Why test early | Main engineering check | Initial class |
|---:|---|---|---|---|
| 1 | Google Gemini API | Strong official free-tier documentation; native adapter already exists | Native protocol, per-model eligibility, account/model rate limits, content-data notice | Restricted free |
| 2 | GroqCloud | Existing OpenAI-compatible path and detailed request/token headers | Organization-level quota pool and model-specific limits | Restricted free |
| 3 | OpenRouter | Aggregator with live free-model catalogue and useful key-info endpoint | Dynamic free model pricing, `:free` limits, credit-vs-free distinctions | Restricted free |
| 4 | Cloudflare Workers AI | Explicit daily free neuron allocation and provider error codes | Non-token quota unit, daily reset and paid-only model restrictions | Restricted free |
| 5 | Hugging Face Inference Providers | Existing router adapter and documented monthly included credits | Monthly credit accounting and route/provider billing distinction | Monthly credits |
| Review | Cerebras | Adapter is straightforward but official pricing descriptions conflict | New-account signup and post-trial billing status | Review required |

## 4. Adapter-level observations from the archive

- `server/src/providers/base.ts` already defines a common provider contract and an optional quota-fetch mechanism.
- `server/src/providers/openai-compat.ts` is a useful generic adapter, but provider quirks (authentication, validation, model path, tool calls, timeout, streaming, free-tier enforcement) still require provider-specific configuration or subclass overrides.
- `server/src/providers/google.ts` has a dedicated native adapter, showing why an OpenAI-compatible-only design would be insufficient.
- `server/src/providers/cloudflare.ts` parses Cloudflare-specific authentication and usage observations.
- `server/src/providers/aclide.ts`, `sail.ts`, and other adapters use dedicated endpoint/protocol translation and quota-observation hooks.
- Search-only adapters (`brave.ts`, `exa.ts`, `firecrawl.ts`, `linkup.ts`, `parallel.ts`, `serpsearch.ts`, `tavily.ts`, `keenable.ts`) must not appear as LLM inference providers in the primary free-model catalogue.
- The upstream active-provider allowlist is much broader than the 51 provider source files because some platforms are instantiated through the generic OpenAI-compatible adapter. Treat the allowlist, adapter files and free-model catalogue as three different things.

## 5. Data the Infinity provider registry should retain

At minimum, each provider should record:

- stable provider ID, display name, official homepage and developer/signup URL;
- provider category: direct inference, aggregator/router, local runtime, speech/media, search/tool;
- adapter kind and API base URL (never expose secrets);
- auth modes: API key, OAuth/PKCE if official, keyless if officially supported;
- capability flags: chat, streaming, tools, vision, embeddings, audio, image, video;
- model-list mechanism and whether the catalogue is dynamic;
- quota sources: official usage API, rate-limit headers, error-body hints, dashboard-only or manual;
- quota dimensions and units: requests, tokens, credits, neurons, characters, seconds or other;
- account-level versus key-level quota semantics;
- free-access class, restrictions, region/verification requirements and evidence URLs;
- last verified time, evidence confidence, next recheck time and lifecycle state;
- data-use/privacy warnings where publicly documented.

## 6. Validation gate before a provider becomes active

A provider integration is not `verified` merely because a source adapter compiles or `/models` responds. It must pass all of the following:

1. Official account/signup path and API access method documented.
2. Key/OAuth validation is safe, non-destructive and does not consume material quota.
3. One or more specific free model IDs are verified against official pricing/access evidence.
4. A minimal real inference call succeeds using a new test account or controlled test key.
5. Paid/trial-only models are excluded from verified-free status.
6. Request/token/other quota signals are captured accurately with source and reset semantics.
7. Streaming, errors, timeout and retry behavior are tested where supported.
8. Region, data-use, retention or eligibility caveats are exposed to the user.
9. Credential redaction and secret handling tests pass.
10. A recheck cadence and retirement path are configured.

## 7. Current conclusion

The recommended first integration-validation set is Google Gemini, Groq, OpenRouter, Cloudflare Workers AI and Hugging Face Inference Providers, with Cerebras held in Review pending clarification. This is a pragmatic test sequence based on official documentation and source-code readiness, not a claim that all of these services offer unlimited or permanent free access.

The next engineering action is to implement one complete vertical slice with the first provider: connect an account securely, verify model eligibility, register its model evidence, observe quota/usage, and route a request through the Infinity endpoint. Expand to more providers only after that pattern passes its acceptance tests.
