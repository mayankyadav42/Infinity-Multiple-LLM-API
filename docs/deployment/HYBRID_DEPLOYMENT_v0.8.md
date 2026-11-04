# Infinity Multiple LLM API — Hybrid Deployment Runbook (0.8.0)

This release documents and standardizes the two supported gateway placements. The Android app is a control panel; it is **not** the gateway host.

## Deployment choices

| Mode | Gateway runs on | Android connects to |
|---|---|---|
| Local | PC, mini-PC, or home server | Private LAN address or VPN address |
| Remote | VPS/server | HTTPS hostname through a reverse proxy |

Use one gateway per environment. Keep its database and encryption key persistent. Do not expose the Node port directly to the public internet.

## 1. Prepare either host

Requirements: Docker Engine, Docker Compose v2, and OpenSSL.

```bash
cp .env.example .env
```

Generate a stable encryption key and place it in `.env`:

```bash
openssl rand -hex 32
```

Set `ENCRYPTION_KEY` to the resulting 64-character value. Store a protected backup offline. **Do not rotate or regenerate it casually**: existing encrypted provider credentials depend on it.

## 2. Local PC / home-server mode

The default Compose binding is `127.0.0.1:3001`, intentionally local-only. For another device on the same trusted LAN, set `HOST_BIND=0.0.0.0` in `.env`, restrict port 3001 with the host firewall to the LAN subnet, and set `ALLOWED_HOSTS` to the exact LAN hostname/IP used by clients. Do not port-forward this port on your router.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f freellmapi
```

Connect the Android app to `http://<LAN-host>:3001` only on a trusted LAN. For access outside home, prefer a private VPN such as WireGuard/Tailscale rather than exposing plain HTTP.

## 3. Remote VPS mode

Use a supported reverse proxy (Caddy, Nginx, or Traefik) to terminate TLS. Keep the application port bound to loopback; the proxy and app should share a private Docker network or run on the same host.

Example host-side Nginx location (replace the hostname and certificate paths):

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        client_max_body_size 25m;
    }
}
```

Set these values in `.env` for a single trusted reverse-proxy hop:

```dotenv
HOST_BIND=127.0.0.1
ALLOWED_HOSTS=api.example.com
TRUST_PROXY=1
```

`TRUST_PROXY=1` is appropriate only when exactly one trusted proxy is directly in front of the app. If the topology differs, configure the exact trusted proxy addresses/CIDRs instead. Never set `TRUST_PROXY=true` on an internet-facing install without understanding the spoofing implications.

Open only SSH and HTTPS at the VPS firewall. Do not expose TCP 3001 publicly. Use strong admin credentials and unique unified API keys; revoke keys that are no longer needed.

## 4. Android connection

1. Start the gateway and complete its first-admin setup locally or through the HTTPS hostname.
2. In Android, add the gateway URL. Use `https://` for remote hosts.
3. Sign in and allow the app to retain its encrypted session using Android Keystore.
4. Add provider credentials through the control panel. Do not paste provider keys into chat, logs, or screenshots.
5. Create a unified API client key for external tools. Treat it as a password; rotate it if exposed.

## 5. Persistence, backup, and recovery

- Keep the `freellmapi-data` Docker volume.
- Back up the SQLite database and encryption key separately, encrypted at rest and stored in different protected locations.
- Test restoring a backup to a non-production instance before relying on it.
- A database backup without the matching `ENCRYPTION_KEY` is not sufficient to recover provider credentials.
- Restrict access to `.env`, config files, and backups (for example, `chmod 600 .env`).

## 6. Operational checks

```bash
docker compose ps
docker compose logs --tail=200 freellmapi
curl -fsS http://127.0.0.1:3001/api/ping
```

For a remote deployment, verify the public URL redirects/serves HTTPS and that port 3001 is unreachable from outside the host. Monitor disk space, container restarts, provider errors, and quota observation timestamps.

## Security boundaries and known gaps

- The Android client does not replace gateway-side authentication or network security.
- Use a VPN for private remote access, or TLS plus a hardened reverse proxy for public access.
- Never commit `.env`, provider credentials, production databases, signing keys, or real user data.
- OAuth support is provider-specific and not implied by this deployment guide.
- Per-device session administration and full production threat-model validation remain follow-up work. Do not treat this preview as a security-certified public SaaS deployment.
