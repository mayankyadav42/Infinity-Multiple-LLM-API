# Infinity Multiple LLM API — Gateway Authentication & Android Session Gap Audit v0.7

**Status:** Source-based engineering audit  
**Date:** 3 November 2026  
**Scope:** Existing FreeLLMAPI dashboard authentication, admin/API separation, encrypted provider credentials, and the changes needed for secure Android control-panel access.

## 1. Existing authentication found in the source

The supplied source already contains a usable single-owner dashboard authentication foundation:

- Email/password account setup and login.
- Password hashing and verification in a dedicated authentication service.
- Opaque 32-byte random session tokens.
- Only the SHA-256 hash of a dashboard session token is stored in SQLite.
- Session expiry is currently 30 days.
- Login attempt throttling and lockout.
- Logout deletes the current session token hash.
- Password change/reset invalidates all sessions for the account.
- `requireAuth` protects the dashboard/admin API surface.
- The unified `/v1` proxy uses a separate authentication mechanism for external client API keys.

The current `sessions` table is minimal: token hash, user ID, expiry timestamp and created timestamp. It has no device label, client/platform metadata, per-session scopes, last-seen timestamp, or user-facing session management fields.

## 2. Existing provider credential encryption

The source uses AES-256-GCM for provider API keys. The encryption key is 32 bytes; each encryption operation uses a random IV and an authentication tag. The production configuration requires an explicit `ENCRYPTION_KEY`. A generated development key can be persisted in a restricted `.encryption-key` file separate from the database.

This is a meaningful foundation and should be retained after review. Infinity must also preserve:

- Secret redaction in logs and API responses.
- No provider credential plaintext in dashboard state persistence, exports by default, crash reports, analytics or diagnostic bundles.
- Encryption-key backup/recovery guidance.
- Key rotation/versioning and authenticated decryption-failure handling.

The Android app should not receive a stored provider key back from the gateway. It may temporarily collect a new key in memory during the connect flow and transmit it to the selected gateway over a secure authenticated channel.

## 3. Existing separation of dashboard and external API access

The source comments and middleware establish two distinct access paths:

- Dashboard/admin routes under `/api/*` require a dashboard session.
- The unified inference proxy under `/v1` uses a separate Infinity/client API key.

Infinity should preserve and formalize this separation. Android administrative access must not use a client API key, and external tools must not receive a dashboard session token.

## 4. Gaps for the Android control panel

| Capability | Existing source | Infinity requirement | Work needed |
|---|---|---|---|
| Human operator login | Email/password | Keep a secure bootstrap/login path | Reuse and review |
| Opaque session token | Present, random token, hash stored | Retain with stronger lifecycle | Reuse and extend |
| Session expiry | Fixed 30 days | Configurable policy and refresh/re-auth rules | Extend |
| Per-device session identity | Not present | Name each paired Android device | Add metadata/table fields |
| List active devices/sessions | Not found in current auth routes | User can inspect active sessions | Add route and screen |
| Revoke one lost device | Logout current session exists; no discovered device manager | Revoke selected device/session | Add route and tests |
| Session scopes | Not present in current session record | Restrict Android control-plane permissions | Add explicit authorization model |
| Last-used/last-seen | Not present in session record | Show recent activity and detect stale sessions | Add update/index strategy |
| Session rotation/refresh | Not found in current dashboard session service | Reduce long-lived bearer-token exposure | Design and implement |
| Device-bound proof | Not present | Optional stronger binding | Evaluate in POC |
| QR-based pairing | Not found | Convenience flow only if justified | New feature; not a prerequisite |
| External Infinity API key | Separate from dashboard session | Preserve separate credential domain | Reuse/extend separately |

## 5. Recommended approach: extend existing login first

Do not replace the existing authentication system with a completely new QR-only system before testing the simpler path.

Recommended baseline:

1. Android connects to the gateway using the existing operator account login over a secure channel.
2. Gateway creates a session that includes Android device metadata (device label, app version, platform, created time, last seen, expiry, scopes and revocation state).
3. The raw session token is returned once and stored in Android Keystore-backed secure storage through the selected Android framework's vetted native mechanism.
4. Gateway stores only the token hash, not the raw session token.
5. Settings includes `Paired Devices / Active Sessions`, allowing the user to name and revoke individual devices.
6. Password change, account recovery and emergency revoke invalidate sessions according to a documented policy.
7. Session renewal/rotation is designed so that stolen or replayed old tokens cannot remain valid indefinitely.

This extends proven code and delivers device-level control without requiring a new QR pairing protocol for the first working version.

## 6. QR pairing: optional enhancement, not a settled requirement

QR pairing may improve local-gateway onboarding or simplify adding another phone, but it introduces a separate security protocol: single-use challenges, expiry, replay protection, gateway identity verification, TLS trust, device binding, rate limiting and revocation.

It should only be implemented if the POC demonstrates a real usability benefit over login and if the security requirements can be satisfied. If added, QR must contain only short-lived pairing material and gateway identity—not provider keys, a permanent admin password, or a long-lived bearer token.

For local gateway connections, TLS trust must be explicit. A private LAN address is not automatically trusted. Remote connections require HTTPS and normal certificate validation.

## 7. Required backend additions

Likely additions (exact schema/routes subject to implementation review):

- Session metadata: `device_id`, `device_label`, `client_type`, `app_version`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, `scope_set`, `token_hash`, optional device public-key fingerprint.
- `GET /api/auth/sessions`: return active session metadata for the authenticated operator, excluding token hashes and secrets.
- `DELETE /api/auth/sessions/:id`: revoke one session, with self-revocation and current-session behavior defined.
- Session refresh/rotation endpoint with replay detection and atomic token replacement.
- Device/session audit events for login, refresh, logout and revoke.
- Authorization tests proving that a session with a limited scope cannot call prohibited admin actions.

The exact public routes can be namespaced differently, but the semantics are required.

## 8. Security cautions from the current code

- The current 30-day session expiry is long for a mobile bearer token without device metadata or refresh rotation. Infinity should reassess it rather than copy it unchanged.
- Password change currently invalidates all sessions. Keep this emergency safety property even after per-device revocation is added.
- Remote first-run setup uses a one-time setup code. Keep first-account claiming protected; do not expose an unauthenticated remote setup endpoint after the account exists.
- `ALLOWED_HOSTS` and TLS/reverse-proxy deployment settings must be configured for remote use. Do not rely on a default empty host allowlist for a public server.
- Do not log authorization headers, setup codes, session tokens, provider keys, OAuth tokens or request bodies that may contain secrets.
- The server's provider-key encryption secret must be managed separately from the database and repository; database backup without the matching encryption key is not a complete recoverable backup.

## 9. Implementation acceptance criteria

- Android login uses secure transport and produces a distinct device-labelled session.
- Session tokens are stored securely on Android and only token hashes are persisted by the gateway.
- User can list and revoke an individual paired device/session.
- A revoked, expired or rotated-out token immediately stops authorizing admin API calls.
- Password change/recovery invalidates all active sessions.
- App sessions and Infinity API keys cannot be used interchangeably.
- Provider credentials never appear in Android reads, session records, logs or diagnostic exports.
- Local-gateway certificate trust is explicit; remote gateway rejects insecure HTTP.
- QR pairing, if included, passes expiry, replay, rate-limit and gateway-identity tests.

## 10. Conclusion

The current backend is not missing authentication; it is missing mobile device lifecycle management around its existing dashboard sessions. The low-risk approach is to extend the current opaque-session foundation with device identity, session rotation, scopes, last-seen metadata and individual revocation. Treat QR pairing as an optional onboarding enhancement to prove, not as a mandatory replacement for login.
