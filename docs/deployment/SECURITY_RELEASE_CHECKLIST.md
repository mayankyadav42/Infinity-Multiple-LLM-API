# Security release checklist

Before exposing an Infinity gateway beyond localhost:

- [ ] Set a unique, stable 64-character `ENCRYPTION_KEY`; protect an offline backup.
- [ ] Keep the SQLite volume persistent and test a restore.
- [ ] Use HTTPS or a private VPN; never expose the raw app port publicly.
- [ ] Set `ALLOWED_HOSTS` to exact hostnames where appropriate.
- [ ] Set `TRUST_PROXY` only for the actual trusted proxy topology.
- [ ] Restrict inbound firewall ports; SSH and HTTPS only for a typical VPS.
- [ ] Use a strong unique admin password and rotate exposed unified API keys.
- [ ] Keep provider credentials out of source control, logs, screenshots, and chat.
- [ ] Review authentication/session behavior and revoke stale sessions.
- [ ] Verify backups, restore procedure, disk capacity, and update/rollback plan.
- [ ] Run dependency installation, full server/client builds, Vitest, Android build, and device testing in CI before production use.

A checked box means the operator has verified it in their environment; it is not automatically satisfied by the source repository.
