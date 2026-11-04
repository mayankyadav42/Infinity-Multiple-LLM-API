# Infinity Multiple LLM API — Android Technical Proof-of-Concept Plan v0.6

**Status:** Engineering validation plan; no framework selected yet  
**Date:** 3 November 2026  
**Depends on:** Architecture Specification v0.1 and Android Screen Specification v0.5  
**Goal:** Validate the Android app approach and secure mobile gateway sessions before building the full mobile application.

---

## 1. What the source archive tells us

The supplied FreeLLMAPI archive currently contains:

- A React 19 + Vite web client in `client/`.
- TypeScript application dependencies and shared client-side libraries.
- A Node.js/Express gateway backend in `server/`.
- An Electron desktop wrapper in `desktop/`.
- No native Android project/module.
- No Capacitor configuration or dependency in the inspected client/root package manifests.

The existing React client is a useful source of UI components, API-client patterns, types and visual conventions. It is not yet evidence that the desktop-oriented interface is suitable for a phone. The Android work must use the screen specification as the mobile product baseline and selectively reuse existing code after checking each component.

## 2. Proof-of-concept objective

Before committing to the full Android implementation, validate two candidate approaches against the same small set of user journeys:

- **Option A — React + Capacitor:** adapt a mobile-first React interface and package it as an Android application with native bridges for secure storage, notifications and other device features.
- **Option B — Kotlin + Jetpack Compose:** build the Android interface natively and connect it to the same gateway API. Reuse backend contracts and selected TypeScript specifications, not React UI components.

The aim is not to build two complete applications. Build only enough to test the core risks and compare the actual results on a physical Android phone.

## 3. Candidate comparison

| Evaluation area | React + Capacitor | Kotlin + Jetpack Compose |
|---|---|---|
| Reuse of existing React/TypeScript UI logic | High potential | Low for UI; API contracts/types can be shared conceptually or generated |
| Time to reuse selected existing web components | Likely faster, after mobile redesign | More UI must be written again |
| Native Android interaction | Through plugins/native bridges | Direct platform APIs |
| Secure device credential storage | Requires a vetted native secure-storage bridge | Direct integration with Android Keystore-backed storage |
| Background work and notifications | Depends on native plugins and Android service design | Direct Android platform integration |
| Complex native-feeling motion/accessibility | Must validate WebView and bridge behavior | Strong native control, but more implementation work |
| Shared UI with a future web dashboard | Strong | Requires a separate web UI |
| Risk of carrying desktop layout assumptions into mobile | Higher unless mobile screens are rebuilt intentionally | Lower |
| Maintenance model | Web stack plus native bridge/plugin dependencies | Android/Kotlin stack plus shared gateway API contracts |

**Initial direction, not a final selection:** test React + Capacitor first because the supplied project already uses React and TypeScript. Keep Jetpack Compose as a real alternative until secure pairing, app responsiveness, animations, accessibility and notification behavior are demonstrated on-device.

Do not select a framework solely because it appears to reduce initial coding. Security, reliability and long-term maintenance matter more than minimizing the first prototype.

---

## 4. POC scope

Build a small installable debug APK with only these functions:

1. Gateway profile list (one local and one remote test profile can be represented).
2. Add/connect gateway using its address and the existing operator login, extended with device-labelled sessions. Test an optional QR identity/enrollment flow only if it adds measurable usability value.
3. Show gateway identity, version, deployment type, connection state and last successful contact.
4. Display a minimal provider summary returned by the gateway (no provider secret values).
5. Display a small verified-model summary and one quota observation with source/freshness labels.
6. Store a revocable gateway app-session credential using the candidate platform's secure storage mechanism.
7. Switch between two gateway profiles without mixing cached data or credentials.
8. Show a basic activity/connection notification when the app is active; validate native notification delivery as a separate POC check.

Do not implement the entire dashboard, full provider directory, full OAuth catalogue, API playground, chat UI, voice features, or production discovery engine during this POC.

---

## 5. Existing login extension and app-session security design

### 5.1 Separate three kinds of credentials

These are not interchangeable:

1. **Provider credentials:** user-owned API keys/OAuth tokens for upstream LLM providers. They are submitted to the selected gateway and encrypted/stored there.
2. **Android app session:** revocable credential used by this paired Android app to access its gateway's administrative/control APIs. Store securely on Android; gateway stores only the token hash and device/session metadata.
3. **Infinity API keys:** keys issued by the gateway to external agents/tools. Store as one-way hashes on the gateway and show the full value once at creation.

The Android app must never use an Infinity API key as its administrative login credential.

### 5.2 Baseline mobile login flow

1. User adds a local or remote gateway address, or scans an optional gateway identity QR code to populate the address and verify the intended gateway.
2. Android checks gateway identity, version and transport security before sending login credentials.
3. User signs in with the existing gateway operator account. First-run account setup follows the gateway's protected setup process.
4. Gateway creates a device-labelled session with device/app metadata, last-seen time, expiry, scopes and revocation state.
5. The raw session token is returned once; Android stores it using the candidate framework's secure storage integration.
6. Gateway stores only the session token hash plus non-secret session metadata.
7. The user can name and later revoke the Android session from the gateway's paired-device/session manager.

### 5.3 Session security requirements

- Remote login requires HTTPS and normal certificate validation.
- Local-gateway transport trust must be explicit. Do not treat a private LAN IP as a trusted TLS identity and do not disable certificate validation globally.
- Session tokens must be high-entropy, hashed at rest on the gateway, and stored securely on Android.
- Add device labels, client type, app version, creation time, last-seen time, expiry, scopes and revocation state.
- Add per-device session listing and individual revocation.
- Design session refresh/rotation with replay detection; do not blindly copy the existing 30-day lifetime without review.
- Password change/recovery must continue to invalidate active sessions as an emergency safety mechanism.
- App sessions, provider credentials and external Infinity API keys remain separate authentication domains.
- Tokens and secrets must never appear in logs, analytics, crash reports or diagnostic exports.

### 5.4 Optional QR enrollment

QR-based pairing may improve first-time local onboarding, but it creates a new protocol with challenge expiry, single-use semantics, replay protection, gateway identity verification, rate limiting and device revocation. Test it only as an optional enhancement after the existing login/session extension works. A QR payload must not contain provider keys, a permanent admin password or a long-lived bearer token.

### 5.5 Manual connection fallback

Manual connection uses the gateway base URL and the existing account login over a verified secure channel. A permanent provider API key or server password must never be used as the gateway URL or pairing code.

## 6. Minimum Android screens for the POC

| Screen | Required behavior |
|---|---|
| Welcome | Explain that Android controls a separately running gateway |
| Gateway profiles | List saved gateways, show active profile and connection state |
| Add gateway | Enter gateway address or scan optional identity QR; sign in using operator account |
| Verify gateway | Show identity, deployment type, address and transport trust before login |
| Connected overview | Show gateway health, version and last contact |
| Profile detail | Rename, reconnect, switch or remove profile; revoke pairing where authorized |
| Security state | Show secure session status and device label without displaying tokens |

The POC can use neutral placeholder styling. It should not be mistaken for final Infinity visual design.

---

## 7. API contract required for the POC

Final route names may change after backend review. The POC needs equivalent operations for:

| Operation | Purpose | Security note |
|---|---|---|
| Read gateway identity | Return gateway ID, name, version, deployment type and fingerprint | No secrets |
| Login / first-run setup | Authenticate the operator using existing gateway account flow | Secure transport, throttling, protected bootstrap |
| Register mobile session | Add device label, client type, app version, scopes and last-seen metadata | Token hash stored on gateway |
| List/revoke sessions | Let operator inspect and revoke individual devices | Revocable, audited session lifecycle |
| Refresh/revoke app session | Renew or terminate Android app access | Rotating, revocable session; replay protection |
| Get gateway summary | Read health and counts for dashboard | Requires paired app session |
| List gateway profiles/data scopes | Return permitted management data | No credential ciphertext/plaintext returned |
| Get provider summary | Provider names, statuses and masked credential metadata | Never return provider secret |
| Get model summary | Small catalog response for mobile rendering | Evidence and free-tier status included |
| Get quota summary | Observations with unit/source/freshness | Unknown reset stays null/unknown |

For remote deployments, every route must be served over HTTPS. Local transport and certificate trust need explicit testing; a LAN URL alone does not make a connection trusted.

---

## 8. POC test plan

Run both candidate UI shells against the same test gateway and same API contract.

### 8.1 Functional tests

- Sign in from a phone to a local gateway using the extended mobile session flow.
- Sign in from the same phone to a remote HTTPS gateway.
- Save both profiles and switch between them.
- Revoke one device session and confirm that access stops.
- Expire/revoke a session and confirm rejection; if optional QR enrollment is tested, expire/replay its challenge and confirm rejection.
- Confirm provider credentials never appear in the Android response payloads or local preferences.
- Disconnect network and verify that cached values are labelled stale/last-known.
- Reconnect and verify the active gateway profile refreshes without cross-contamination.

### 8.2 UX and performance tests

Test on at least one physical Android phone representative of a mid-range device:
- App cold start and return-from-background behavior.
- Screen rendering and scrolling responsiveness.
- Gateway address entry, account login and optional QR identity scan.
- Text scaling, TalkBack labels and back navigation.
- Portrait/landscape behavior.
- Simple/Advanced transition performance in a prototype screen.
- Battery/network behavior while periodically refreshing gateway summaries.

### 8.3 Security tests

- Inspect app preferences/files for session and provider-secret leakage.
- Inspect logs/crash diagnostics for secrets.
- Confirm remote HTTP is rejected and TLS verification is not bypassed.
- Test expired, revoked, rotated and wrong-gateway sessions; if optional QR enrollment is included, test expired, replayed and wrong-gateway QR challenges.
- Confirm session revocation takes effect promptly.
- Confirm the app cannot retrieve provider credential plaintext from gateway APIs.
- Confirm API key creation flow is separate from Android pairing.

### 8.4 Comparison measurements

Record actual results for both implementations:
- Time required to implement the POC flows.
- APK size and cold-start time.
- Memory and scroll responsiveness on device.
- Secure storage integration complexity.
- Gateway login/session reliability and error handling.
- Notification/background behavior.
- TalkBack/accessibility gaps.
- Simple/Advanced animation smoothness.
- Plugin/native bridge maintenance burden versus Kotlin implementation effort.

Do not decide from subjective preference alone; keep a short test log and screenshots/video from the same device and scenarios.

---

## 9. Decision gate: choosing the Android framework

Select React + Capacitor if:
- Core mobile workflows are responsive and reliable on physical devices.
- Secure storage and session lifecycle can be implemented with a maintained, reviewed native bridge.
- Notifications, background refresh, accessibility and motion meet the product requirements.
- Reusing existing React/TypeScript foundations creates a meaningful maintenance advantage.

Select Kotlin + Jetpack Compose if:
- The Capacitor bridge adds too much complexity to secure pairing/session management.
- Native background/notification behavior is materially more reliable for the required use cases.
- Mobile accessibility, animation or performance is substantially better with Compose.
- The team accepts maintaining a separate native UI while keeping the gateway API contracts shared.

If results are close, prefer the approach with the lower long-term security and maintenance burden, not simply the one with the fastest first screen.

---

## 10. Work sequence after this plan

1. Review current gateway authentication/session routes and identify what can be reused safely.
2. Define mobile session metadata, session rotation and per-device revocation; define optional QR challenge data only if justified.
3. Implement a minimal mobile-session backend prototype with rotation and individual revocation tests. Add QR challenge/replay tests only if the optional QR flow is selected.
4. Build the same minimum UI journey in a Capacitor spike.
5. Build the same minimum UI journey in a Compose spike, if needed for an honest comparison.
6. Run the functional, UX, performance and security tests.
7. Record the decision and update the architecture specification before full Android implementation.

No production provider keys, user databases or live external accounts should be used in the POC. Use test credentials and a non-production gateway.

---

## 11. Status

This is a technical validation plan, not an implementation claim. No Android framework has been selected, the mobile session extension is not implemented, optional QR enrollment is not production-approved, and no gateway or repository files have been modified by creating this document.
