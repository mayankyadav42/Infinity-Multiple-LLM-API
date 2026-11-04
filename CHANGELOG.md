# Changelog

## 0.16.0 — Streaming error redaction coverage

- Added an end-to-end regression test proving credential-shaped secrets are redacted from mid-stream provider error frames and persisted request analytics.
- Updated Android preview metadata and documentation to 0.16.0.
- The new Vitest integration test is not yet executed; full dependency-enabled CI remains a release gate.

## 0.10.0 — Android session management

- Add a Signed-in Devices section to the Android Gateway screen.
- List active dashboard sessions with current-device identification, creation time, and expiry time.
- Support revoking an individual other-device session and signing out all other sessions while preserving the current session.
- Never display or persist session identifiers as bearer credentials; the session ID returned by the server is a one-way hash used only for revocation.
- Session management remains optional when offline; provider keys remain gateway-side.

## 0.7.0 — Quota provenance

- Expose the selected provider quota observation's source, timestamp, and confidence from `GET /api/free-tier`.
- Show quota provenance in the Android Usage screen, so users can distinguish provider headers/API observations from other evidence and see how fresh a reading is.
- Preserve the existing metric preference and multi-account aggregation rules; provenance describes the freshest observation among the rows contributing to the selected metric.
- No quota values, reset times, or free-tier allowances are inferred or fabricated.

## 0.6.0 — Cloudflare discovery

- Add Cloudflare Workers AI model discovery; discovered catalogue entries are routed to Review because catalogue visibility does not establish free-tier eligibility.
- Add Cloudflare to scheduled discovery and Android controls.
