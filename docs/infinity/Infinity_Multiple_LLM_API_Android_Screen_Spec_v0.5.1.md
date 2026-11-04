# Infinity Multiple LLM API — Android Application Screen Specification v0.5

**Status:** Product planning specification  
**Date:** 3 November 2026  
**Depends on:** Architecture Specification v0.1, Integration Contract v0.3, Database Schema & Migration Plan v0.4  
**Product boundary:** Android control panel for provider/API-key management, free-model discovery, quota and usage monitoring, and management of the unified API gateway. A separate conversational agent or voice assistant is not included.

---

## 1. Purpose and design principles

The Android application is the user's primary control panel for one or more Infinity gateways. It does not need to host a continuously running gateway process itself. A gateway runs on a local computer/home server or a remote server; Android connects to it securely and manages it.

The mobile experience must:

1. Make the operational state of the selected gateway understandable at a glance.
2. Make adding a provider and its API key straightforward without exposing secrets unnecessarily.
3. Make verified free models easy to find, while clearly separating restricted, trial-only, unknown, and paid models.
4. Distinguish provider-reported quota from response-header observations and Infinity-measured usage.
5. Allow the user to manage the unified API without turning the app into a chat client.
6. Keep all essential functions available in Simple Mode. Advanced Mode adds controls; it never removes or hides the basic functions permanently.
7. Work with both local and remote gateway deployments through the same interface.
8. Clearly display stale, missing, estimated, or unverified data rather than presenting it as certain.

## 2. Navigation model

### 2.1 Primary navigation

Use a five-destination bottom navigation bar:

| Destination | Purpose | Main screens |
|---|---|---|
| Overview | Current gateway health and important summaries | Dashboard, alerts summary |
| Providers | Provider accounts, credentials, connection status | Provider list, provider detail, connect flow |
| Models | Catalog, filters, discovery, review | Model catalog, model detail, Discovery Center, Review queue |
| Usage | Quota observations and Infinity usage | Usage overview, provider/account detail, usage history |
| Gateway | Unified API endpoint and client access | Gateway status, endpoints, Infinity API keys, quick-start |

A global top app bar contains the Infinity identity, active gateway selector/status, notifications, and Settings entry. The active gateway should remain visible when navigating between destinations.

### 2.2 Secondary navigation

- **Discovery Center** is reached from Models, with tabs for `New`, `Changes`, `Review`, and `History`.
- **Activity / Logs** is available from Overview and in Advanced Mode under Gateway or Settings. Simple Mode shows a concise activity feed, not raw logs.
- **Settings** is a global destination, not a bottom-navigation item.
- Back navigation must preserve list filters, scroll position, and the selected gateway where practical.

### 2.3 Gateway selection

The app may store several gateway connection profiles, such as `Home Gateway` and `Remote Gateway`. Switching profiles changes the data source for the whole app. Display the active gateway name and connection state in the app bar and provide a confirmation when a switch would interrupt an in-progress operation.

Gateway switching does not copy credentials, quota history, API keys, or provider accounts between gateways. The UI must not imply that local and remote gateway data are automatically synchronized.

---

## 3. First launch and gateway connection

### 3.1 Welcome screen

**Goal:** Explain what Infinity does and establish that the Android app controls a separately running gateway.

Content:
- Product name and concise description: manage provider connections, free models, quotas, and one unified API.
- Primary action: `Connect a Gateway`.
- Secondary action: `Learn how local and server gateways work`.
- Short note: the Android app is the control panel; a gateway runs on a computer/home server or remote server.

Do not imply the phone itself is the default always-on gateway host.

### 3.2 Add Gateway screen

Offer two connection types:

**A. Local gateway**
- Enter the local gateway address.
- Optionally scan a gateway identity QR code to avoid typing the address and help verify the intended gateway.
- Explain that the phone and gateway should normally be on the same trusted network for initial connection.
- Do not treat an arbitrary LAN endpoint as trusted merely because it uses a private IP address.

**B. Remote gateway**
- Enter the HTTPS gateway URL or scan an optional gateway identity QR code.
- Require HTTPS for remote connections. Do not provide a routine production option to bypass TLS validation.
- Authenticate using the gateway operator's existing account login; the gateway then registers a device-labelled app session.
- Show hostname/certificate and gateway identity information before accepting the connection.

### 3.3 Gateway identity and sign-in screen

Show:
- Gateway name and deployment type (Local / Remote).
- Gateway software version and compatibility status.
- Secure connection status and gateway identity/fingerprint.
- Operator account sign-in (or first-run account setup where appropriate).
- Device label for this Android installation (editable, e.g. `My Android phone`).
- `Connect` and `Cancel` actions.

The baseline flow extends the existing email/password dashboard authentication with device-labelled, revocable sessions. QR-based pairing may be added as an optional convenience flow after a security proof-of-concept; it is not a mandatory replacement for account login. Never ask the user to paste a provider API key into the gateway URL or QR code.

### 3.4 Connection result

Display one of:
- Connected and ready.
- Connected, but gateway needs setup or migration.
- Incompatible gateway version.
- Cannot connect / gateway unreachable.
- TLS or gateway identity verification failed.

Provide actionable troubleshooting: check gateway process, network, URL, firewall, TLS certificate, and pairing status. Do not display raw secrets or sensitive request headers.

### 3.5 Multiple gateways

A `Gateway Manager` screen lists saved profiles with name, deployment type, URL/host label (masked or abbreviated where appropriate), connection state, version, and last successful connection. Actions: Add, Switch, Rename, Reconnect, Revoke app session, Remove profile. Removing a profile from Android must not delete the gateway's server-side data.

---

## 4. Overview dashboard

### 4.1 Simple Mode layout

The dashboard should answer, in this order:

1. Is the selected gateway connected and healthy?
2. How many providers are connected and working?
3. How many verified free models are currently available?
4. What is the current quota/usage situation?
5. Is there anything that needs attention?

Recommended sections:

- **Gateway status card:** gateway name, Local/Remote label, online/degraded/offline state, last sync/check time, `Manage` action.
- **Provider summary:** connected providers, healthy providers, providers needing attention.
- **Free models summary:** verified free model count and restricted-free count. Trial and Review candidates are not included in the verified-free count.
- **Usage snapshot:** token usage and request count for a selected period, clearly labelled as Infinity-observed unless it is explicitly provider-reported.
- **Quota alerts:** provider-reported remaining quota, observed rate-limit pressure, or stale/unknown data notices.
- **Discovery summary:** new verified models added and candidates requiring review.
- **Recent activity:** provider connected, key validation failed, model availability changed, quota threshold reached, gateway disconnected, etc.

Do not combine credits, tokens, and requests into one misleading total. Use separate units and labels.

### 4.2 Advanced Mode additions

Advanced Mode retains every Simple Mode card and adds:
- Gateway service health and version details.
- Provider adapter health and last validation timestamps.
- Discovery run status and last successful source check.
- Quota source breakdown (official API / response header / manual / Infinity counter).
- Stale observation count and failed probe count.
- Gateway request throughput, latency percentiles where available, error rate, fallback count, and cooldown status.
- Compact event/log explorer with redaction applied.

### 4.3 Dashboard states

- **No gateway configured:** explain setup and offer Add Gateway.
- **Gateway offline:** keep last-known information visible but label it `Last known`, show its timestamp, and disable operations that require a live gateway.
- **No providers configured:** show a clear Connect Provider action.
- **No usage yet:** explain that usage is recorded for requests that pass through Infinity; direct provider-dashboard usage may not be included.
- **Partial data:** show individual cards with their own freshness/source status rather than declaring the whole dashboard healthy.

---

## 5. Providers section

### 5.1 Provider list

Each provider row/card shows:
- Provider name and logo/monogram.
- Connection state: Connected, Needs attention, Paused, Not connected.
- Number of linked accounts/credentials where relevant.
- Free-tier status: verified, restricted, trial, unknown, paid, or retired.
- Supported capabilities as small text/icon indicators (chat, embeddings, vision, etc.).
- Last successful validation and last quota observation, if available.

Filters:
- All, Connected, Not connected, Needs attention.
- Capability.
- Free-tier status.
- Region/payment requirements where known.

Primary action: `Add Provider`.

### 5.2 Provider directory / add provider

Show only provider records from Infinity's maintained registry. Each provider detail/selection card should include:
- Official provider website.
- Official signup/console link.
- API documentation link.
- Supported authentication methods: Manual API key / OAuth / both / unsupported.
- Supported regions and account requirements, when known.
- Free-tier classification, last verified date, restrictions and evidence source.
- API capabilities and known quota visibility.

The user can open the official website to create an account. Infinity must not request or store the provider account password.

### 5.3 Connect Provider flow

**Step 1 — Select provider account**
- Provider name and official links.
- Optional user-defined account label (e.g., Personal, Work, Region A).
- Region/account class if the provider uses them.

**Step 2 — Choose authentication**
- Manual API key.
- Official OAuth, only where the provider has a supported documented flow.
- If OAuth is not supported, do not display it as an option.

**Step 3A — Manual API key**
- Instructions for finding the key in the provider's official console.
- Secure key input with reveal/hide control.
- Paste action and format hint, but avoid assuming a fixed key prefix unless provider-specific evidence supports it.
- Submit key directly to the selected gateway over the authenticated secure connection.
- Android should not persist the raw provider key in ordinary app preferences, logs, analytics, crash reports, or clipboard history by design.

**Step 3B — OAuth**
- Use provider-published authorization flow, preferably authorization code with PKCE where supported.
- Show the provider identity and requested scopes before redirecting.
- Return through a verified app link/custom scheme or gateway callback design that has been reviewed for security.
- Store access/refresh tokens encrypted on the gateway.

**Step 4 — Validate**
- Validate credentials through the provider adapter's safe validation method.
- Distinguish invalid credentials, insufficient permissions, unsupported endpoint, network failure, account restriction, and provider outage.
- Do not make a paid model call merely to validate a key.

**Step 5 — Connected result**
- Show account label, auth type, masked credential fingerprint, validation state, available model count (if known), and quota visibility.
- Offer `Explore Models` and `View Quota` actions.

### 5.4 Provider detail

Tabs/sections:
- Overview: account health, free-tier terms, capabilities, region and current status.
- Accounts & Keys: labels, masked identifiers, expiry/validation state; add, replace, pause, revoke/delete.
- Models: provider models, availability and free-tier classification.
- Quota: provider-reported observations and Infinity usage, kept distinct.
- Diagnostics: last adapter check, safe error summary, supported endpoints (Advanced Mode).

Secret handling:
- Never reveal a stored API key again after creation. Replacing a key requires entering a new value.
- A `Copy key` action must not exist for stored provider credentials.
- Deletion/revocation must clearly state whether the action only removes local encrypted storage or also revokes the key at the provider (usually the latter requires the provider's console).

---

## 6. Models section

### 6.1 Model catalog

Default view: verified free models, with a clear filter bar and search.

Each model card shows:
- Model display name and provider.
- Free-tier badge/state with explicit wording (Verified free / Restricted free / Trial only / Under review / Paid / Retired).
- Key capabilities (chat, tools, vision, embeddings, etc.).
- Availability state (Available / Degraded / Unavailable / Unverified).
- Last verified timestamp where relevant.

Filters:
- Free-tier status.
- Provider.
- Capability/modality.
- Region/account restrictions.
- Streaming and tool support.
- Context window range where trustworthy data exists.
- Availability.

Sorting options: Recently verified, Provider, Name, Capability, and availability. Do not label a model `free` solely because it appears in a provider's model-list endpoint.

### 6.2 Model detail

Show:
- Canonical Infinity model identifier and upstream provider model ID.
- Provider and endpoint/protocol.
- Free-tier classification and conditions.
- Evidence source, last checked time, confidence, and expiry/recheck date if used.
- Supported features and unknown/untested capabilities.
- Context/output limits only when sourced and timestamped.
- Region, account, payment-card, rate-limit and usage restrictions when known.
- Availability/health history.
- `Copy model ID` action.
- `View provider documentation` action.
- `Test compatibility` action only if implemented as a controlled, clearly disclosed diagnostic call; show whether it can consume provider quota before running it.

No conversational prompt playground, chat history, or agent interface is part of this application scope.

### 6.3 Discovery Center

Tabs:

**New**
- Newly detected providers/models.
- Verified recurring-free entries are automatically registered and appear in the catalog.
- Restricted-free entries are automatically registered with prominent restrictions.

**Changes**
- Existing models whose pricing/free-tier status, region, capabilities, limits, endpoint, or lifecycle changed.
- Show old value versus new value when evidence supports a direct comparison.

**Review**
- Unknown, conflicting, trial-only, potentially paid, or insufficiently evidenced candidates.
- Never automatically promote uncertain candidates to verified free.

**History**
- Discovery runs, additions, changes, removals, and prior verification decisions.

Each candidate should show evidence URL/source type, date checked, confidence, and reason for its classification. A model directory listing alone is insufficient evidence of free API access.

### 6.4 Review actions

For Review candidates:
- `Open official evidence`.
- `Keep under review`.
- `Mark as trial/promotion` only when evidence supports it.
- `Approve as recurring free` only when the user's decision is supported by sufficient evidence and the action records who/what approved it and why.
- `Exclude from free catalog`.

The automatic discovery policy remains: verified recurring-free and verified restricted-free models are added automatically; uncertain or potentially paid models stay in Review. Manual override must not erase the underlying evidence or automated classification history.

---

## 7. Usage and quota section

### 7.1 Usage overview

Top-level period selector: Today, 7 days, 30 days, and custom range if supported.

Separate metric cards/sections:
- Requests.
- Input tokens.
- Output tokens.
- Total tokens.
- Errors and retries.
- Latency (Advanced Mode or where useful).

Every number should identify its data scope: `Through Infinity` for the gateway usage ledger. Do not imply these counts include direct calls made elsewhere.

### 7.2 Quota overview

Provider/account cards display only metrics actually supplied or safely inferred:
- Metric and native unit (requests, tokens, credits, characters, images, seconds, etc.).
- Limit, used, remaining when the source provides them.
- Reset time or reset strategy only when known.
- Source label: Official API, Response header, Error response, Manual, or Infinity counter.
- Last observed time and freshness: Fresh, Stale, Expired, Unknown.
- Confidence where relevant.

Use different visual treatments for provider-reported quota and Infinity-estimated/observed usage. Do not sum or combine unlike units. Do not infer a reset time from a generic rate-limit window unless the provider's semantics justify it.

### 7.3 Provider/account usage detail

Show timelines and breakdowns by model, endpoint, credential, and day where the gateway has that data. Shared quota pools must be represented as shared; do not show the same account-level quota as if it were an independent balance for every key.

### 7.4 Alerts

Examples:
- Quota remaining below configured threshold (only for a trustworthy remaining measurement).
- Rate limit reached or cooldown active.
- Quota observation stale.
- Provider reset detected or confirmed.
- Sudden failure increase.
- Provider key invalid/expired.

Alerts must explain whether they are provider-confirmed or inferred from gateway activity.

---

## 8. Gateway section

### 8.1 Gateway overview

Show:
- Gateway name, type (Local/Remote), base URL, version.
- Connection/health status.
- API compatibility status.
- Number of active Infinity API keys.
- Recent request activity and latest error summary.
- Start/stop/restart controls only if the Android client can safely manage the relevant gateway deployment; otherwise link to deployment instructions and show status only.

### 8.2 Unified API configuration

Display:
- Base URL.
- Supported API routes and compatibility notes.
- Model naming convention and model list endpoint.
- Streaming support status.
- Authentication header format.
- Copyable sample requests and client setup snippets.

The first compatibility target is the OpenAI-compatible interface defined by the integration contract. Do not claim compatibility with every OpenAI SDK feature unless tested.

### 8.3 Infinity API key management

Show key name, prefix, scopes, creation date, expiry, last-used date, and status. The full key is displayed only once at creation and stored server-side as a one-way hash. The UI must explain that if the user loses the key, they must create a replacement.

Actions:
- Create key.
- Set scopes/permissions.
- Set expiry if supported.
- Revoke key.
- Rename key label.

The app must distinguish Infinity-issued client keys from provider API keys.

### 8.4 API quick-start

Include copyable examples for:
- Base URL.
- Authentication header.
- List models.
- Chat-completion request (non-streaming and streaming if supported).
- A minimal configuration example for a compatible external agent/tool.

Never embed a real API key in documentation examples. Use placeholders and clearly mark the generated key as a secret.

### 8.5 Diagnostics and logs

Simple Mode: recent events and plain-language error explanations.

Advanced Mode:
- Request ID/correlation ID.
- Selected provider/model and route decision.
- Retry/fallback/cooldown information.
- Latency and status code.
- Redacted provider error details.

Never display provider keys, OAuth tokens, authorization headers, or sensitive request bodies in logs.

---

## 9. Settings and security

Settings categories:

1. **Appearance:** theme preference, density, reduce-motion preference.
2. **Mode:** Simple / Advanced.
3. **Gateway profiles:** saved connections, active gateway, session/device management.
4. **Discovery:** polling/notification preferences, source categories, review alerts. Verification policy itself must remain consistent with the agreed automatic-add rule unless explicitly changed later.
5. **Usage and quota:** time zone, display period, alert thresholds, retention settings.
6. **Notifications:** discovery, quota, provider health, key expiry, gateway status.
7. **Security:** app lock/biometric gate if implemented, session timeout, paired device list, revoke session.
8. **Backup and restore:** gateway-side backup status and instructions; clearly distinguish database backup from encryption-key backup.
9. **About:** app version, gateway compatibility, licenses, privacy/security notes.

Android-side security:
- Store gateway session tokens in Android Keystore-backed secure storage where available.
- Do not store provider API keys in ordinary Android preferences or local app databases.
- Use secure transport to the gateway.
- Redact secrets from logs, analytics, crash reports and clipboard operations.
- Support session revocation and lost-device recovery.

Gateway-side security:
- Provider API keys and OAuth refresh tokens are encrypted at rest by the gateway.
- Infinity API keys are stored as one-way hashes.
- Master encryption keys remain outside the application database and source repository.
- Backups must not silently omit required encryption-key recovery guidance.

---

## 10. Simple Mode and Advanced Mode behavior

### 10.1 Simple Mode (default)

Simple Mode presents the main tasks in plain language:
- Connect a provider.
- Find verified free models.
- Understand usage and quota status.
- See whether the gateway is healthy.
- Create/manage an Infinity API key.
- Resolve attention items.

It should hide implementation-level complexity by default, not remove core functionality.

### 10.2 Advanced Mode

Advanced Mode includes every Simple Mode capability plus:
- Adapter and endpoint diagnostics.
- Provider/model evidence details.
- Detailed quota source/freshness/confidence metadata.
- Routing and fallback configuration, where supported by the gateway.
- Rate-limit and cooldown settings, with safe validation.
- Request traces and redacted logs.
- Discovery source configuration and run history.
- API compatibility and health diagnostics.
- Database/backup and maintenance status.

Advanced controls should have explanations, safe defaults, and validation. Potentially destructive actions require confirmation.

### 10.3 Transition animation

**Simple → Advanced:**
- The transition begins at the Advanced Mode control.
- A subtle activation wave/energy field expands outward across the interface.
- Additional technical panels reveal progressively as the transition completes.
- The visual language should feel like the system is revealing deeper controls, not loading an unrelated page.

**Advanced → Simple:**
- The reverse transition should feel like graceful simplification.
- Advanced panels contract/fade toward the mode control; essential dashboard structure remains stable.
- Do not make it feel like a crash, shutdown, or punitive downgrade.

Implementation constraints:
- Target a smooth, brief transition (approximately 350–600 ms on capable devices), but prioritize responsiveness over visual effects.
- Respect Android's Reduce Motion/accessibility setting; provide a minimal or instant transition when requested.
- Do not block navigation or data refresh while animation runs.
- Persist the chosen mode across launches per app preference.

---

## 11. Notifications and background behavior

Notification categories:
- New verified free model/provider added.
- Candidate requires review.
- Free-tier or provider terms changed.
- Quota threshold warning.
- Provider key invalid/expired.
- Gateway unreachable or restored.
- Provider/model degraded or retired.

Rules:
- Ask for Android notification permission in context, after the user enables or requests notifications—not immediately on first launch without explanation.
- Use in-app notifications even if system notifications are denied.
- Discovery and quota polling are performed by the gateway, not by a phone that may be offline.
- Android background sync fetches gateway summaries and notifications when allowed by OS constraints; it must not be treated as the source of truth for scheduled discovery.
- Show last updated timestamps when the app returns from background or reconnects.

---

## 12. Visual design system

Design direction: premium, restrained, dark cosmic interface.

- Base: deep charcoal/near-black rather than pure black on every surface.
- Accents: controlled violet and cyan for active states, data highlights and system status.
- Surface hierarchy: subtle contrast between base canvas, cards, overlays and modal sheets.
- Typography: high readability, strong hierarchy, compact but not cramped data labels.
- Charts: clear units, labeled axes, accessible contrast; avoid decorative gradients that make values hard to read.
- Status colors must be consistent and never used as the only signal; pair color with text/icon.
- Use motion as feedback, not constant decoration.
- Keep empty states useful and calm; avoid misleading fake/demo numbers in production views.

Android interaction requirements:
- Touch targets should generally be at least 48 dp.
- Support system font scaling and display size changes.
- Support portrait first; adapt gracefully to landscape and larger screens.
- Use native back navigation and predictable modal behavior.
- Ensure the UI remains usable on mid-range Android devices and slower connections.

---

## 13. Core user journeys

### Journey A — First-time setup

Welcome → Add Gateway → choose Local or Remote → enter URL or scan optional identity QR → verify gateway → sign in/create first account → register device-labelled session → compatibility check → Overview.

### Journey B — Add a provider manually

Providers → Add Provider → select provider → open official signup/docs if needed → select Manual API Key → paste key → submit securely to gateway → validate → Connected → Explore Models.

### Journey C — Connect by OAuth

Providers → select OAuth-supported provider → review scopes → authorize through official provider flow → callback → gateway stores encrypted tokens → validation → Connected.

### Journey D — Find a verified free model

Models → Verified Free → filter by capability/provider → open model detail → inspect restrictions/evidence → copy canonical model ID → configure external client in Gateway/API Quick-start.

### Journey E — Review an uncertain candidate

Models → Discovery → Review → open candidate → inspect official evidence and reason for uncertainty → keep under review, exclude, or approve only with adequate evidence → decision history recorded.

### Journey F — Diagnose quota pressure

Usage → provider/account → inspect native quota metric and source → compare with Infinity-observed tokens/requests → inspect reset only if known → configure alert threshold if measurement is reliable.

### Journey G — Connect an external agent/tool

Gateway → API Quick-start → create Infinity API key → copy key once → use base URL and compatible endpoint in external client → verify a test request in Activity.

### Journey H — Switch deployment

Global gateway selector → choose saved local/remote profile → confirm switch → reconnect → all screens refresh from the selected gateway. No credentials or usage are silently migrated.

---

## 14. Error, empty, and recovery states

Every key screen must define:
- Loading state.
- First-use empty state.
- No network / gateway unreachable state.
- Permission or authentication failure.
- Partial/stale data state.
- Provider-side outage or rate-limit state.
- Retry behavior and safe manual recovery.

Errors should be normalized into plain-language summaries with a technical detail expansion in Advanced Mode. Avoid asking users to paste logs containing secrets. Provide a redacted diagnostic export only after review of included fields.

---

## 15. Accessibility, privacy, and telemetry

- Support TalkBack labels and logical focus order.
- Do not encode status using color alone.
- Provide accessible chart summaries or tabular alternatives.
- Honor reduce motion and font scaling.
- Collect no provider passwords.
- Keep analytics optional and minimal; never send provider keys, OAuth tokens, prompts, request bodies or personally identifying account metadata as telemetry.
- Diagnostics must be user-initiated and redacted by default.

---

## 16. MVP screen inventory and implementation priority

| Priority | Screen/flow | Release requirement |
|---|---|---|
| P0 | Welcome, gateway connection and operator login | Required to use app |
| P0 | Gateway manager / switcher | Required for hybrid deployment |
| P0 | Overview dashboard | Required |
| P0 | Provider directory and manual key connect | Required |
| P0 | Provider detail and key management | Required |
| P0 | Verified free model catalog and model detail | Required |
| P0 | Discovery Center and Review queue | Required for agreed discovery policy |
| P0 | Usage/quota overview with source labels | Required |
| P0 | Unified API status and Infinity API key management | Required |
| P0 | API quick-start | Required |
| P0 | Settings/security basics | Required |
| P1 | OAuth flows for providers that officially support them | Add provider by provider after security review |
| P1 | Advanced diagnostics and redacted request traces | Important, but after core flows |
| P1 | Rich usage charts and configurable alerts | Can follow basic accurate counters |
| P1 | Backup/restore UI | After gateway backup and key recovery are implemented |
| P2 | Expanded routing policy editor | Only after routing behavior is stable and tested |
| P2 | Tablet/large-screen optimized layouts | Follow core phone UX |

MVP does not require chat, voice chat, agent memory, conversation history, a general-purpose playground, cloud multi-user SaaS, or a marketplace for paid services.

---

## 17. Acceptance checklist

The Android screen specification is considered implemented when:

- A user can securely sign in to a local or remote gateway and register a device-labelled session. Optional QR enrollment, if implemented, must meet the pairing security requirements.
- The app can save and switch between multiple gateway profiles without mixing their data.
- The user can connect a provider with a manual API key and see clear validation results.
- OAuth is offered only for providers with supported official flows.
- The provider key is sent to and stored encrypted by the selected gateway, not persisted in plaintext by Android.
- The model catalog separates verified free, restricted free, trial/promo, unknown, paid and retired states.
- Only verified recurring-free and verified restricted-free discoveries are auto-added.
- Uncertain or potentially paid discoveries appear in Review with evidence.
- Usage and quota figures clearly identify source, unit, time and freshness.
- The app never invents a quota reset time or converts provider units without authoritative rules.
- The user can create and revoke Infinity API keys and see copy-once behavior.
- The app provides accurate OpenAI-compatible endpoint documentation without claiming untested compatibility.
- Simple Mode contains all basic workflows; Advanced Mode only adds controls.
- The agreed animated mode transition works and respects Reduce Motion.
- Offline/stale/error states are understandable and do not display stale information as current.
- Logs, notifications, analytics and diagnostic exports redact secrets.

---

## 18. Engineering decisions still open (not user product decisions)

These require a focused technical proof-of-concept, not a change to the agreed product scope:

1. **Android packaging:** evaluate React + Capacitor first to reuse the existing React/TypeScript UI; compare with native Kotlin/Jetpack Compose for secure storage, background behavior, accessibility, and animation quality. Do not claim the framework is finalized until the spike is measured.
2. **Mobile session lifecycle:** extend operator login with device labels, session rotation, scopes and per-device revocation. Optional QR identity/enrollment must pass a separate security review.
3. **OAuth callback ownership:** decide whether callbacks terminate in the Android app or gateway based on provider requirements and PKCE security review.
4. **Offline read-only cache:** define which gateway summaries may be cached on the phone and how stale values are marked. Provider secrets and full credential payloads are not part of the cache.
5. **Notification transport:** decide whether remote gateway alerts use Android push delivery, periodic sync, or both; local gateway alerts may require foreground sync or a locally reachable gateway.

These are engineering validations. They do not reopen the already confirmed decisions: Android is the main control panel, deployment is hybrid, and provider credentials remain encrypted on the gateway.

---

## 19. Next planning phase

After review of this screen specification, the next work item is a technical proof-of-concept for the Android shell and mobile session/security flow. Then the UI component inventory and implementation-ready API contracts can be produced before coding the app screens.
