import { describe, it, expect, beforeAll } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { initDb } from '../../db/index.js';

async function call(app: Express, method: string, path: string, body?: any, token?: string) {
  const server = app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const addr = server.address() as any;
  const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  server.close();
  return { status: res.status, body: data };
}

// Tests run in definition order against one shared in-memory DB, mirroring the
// real bootstrap sequence: needs-setup → setup → gated access → login → logout.
describe('Dashboard auth (#35)', () => {
  let app: Express;
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
  });

  it('reports needsSetup before any account exists', async () => {
    const { body } = await call(app, 'GET', '/api/auth/status');
    expect(body).toMatchObject({ needsSetup: true, authenticated: false });
  });

  it('gates /api/* routes with 401 when unauthenticated', async () => {
    expect((await call(app, 'GET', '/api/keys')).status).toBe(401);
    expect((await call(app, 'GET', '/api/fallback')).status).toBe(401);
    expect((await call(app, 'GET', '/api/settings/api-key')).status).toBe(401);
    expect((await call(app, 'GET', '/api/update/status')).status).toBe(401);
  });

  it('leaves /api/ping and the /v1 proxy reachable without a dashboard session', async () => {
    expect((await call(app, 'GET', '/api/ping')).status).toBe(200);
    // /v1 has its own (unified-key) auth, so it 401s for a different reason —
    // the point is it is not gated by the dashboard session middleware.
    const proxy = await call(app, 'POST', '/v1/chat/completions', { messages: [{ role: 'user', content: 'x' }] });
    expect(proxy.body.error.type).toBe('authentication_error');
  });

  it('rejects weak setup credentials', async () => {
    expect((await call(app, 'POST', '/api/auth/setup', { email: 'bad', password: 'x' })).status).toBe(400);
    expect((await call(app, 'POST', '/api/auth/setup', { email: 'a@b.com', password: 'short' })).status).toBe(400);
  });

  let token = '';
  it('creates the first account on setup and returns a working token', async () => {
    const { status, body } = await call(app, 'POST', '/api/auth/setup', { email: 'admin@example.com', password: 'supersecret' });
    expect(status).toBe(201);
    expect(typeof body.token).toBe('string');
    token = body.token;
    expect((await call(app, 'GET', '/api/keys', undefined, token)).status).toBe(200);
  });

  it('refuses a second setup once an account exists', async () => {
    const { status } = await call(app, 'POST', '/api/auth/setup', { email: 'second@example.com', password: 'supersecret' });
    expect(status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const ok = await call(app, 'POST', '/api/auth/login', { email: 'admin@example.com', password: 'supersecret' });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe('string');

    const bad = await call(app, 'POST', '/api/auth/login', { email: 'admin@example.com', password: 'wrongpassword' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.type).toBe('authentication_error');
  });

  it('reports authenticated status with a valid token', async () => {
    const { body } = await call(app, 'GET', '/api/auth/status', undefined, token);
    expect(body).toMatchObject({ needsSetup: false, authenticated: true, email: 'admin@example.com' });
  });

  it('lists safe session metadata, revokes one session, and can revoke all other sessions', async () => {
    expect((await call(app, 'GET', '/api/auth/sessions')).status).toBe(401);
    const before = await call(app, 'GET', '/api/auth/sessions', undefined, token);
    expect(before.status).toBe(200);
    const beforeIds = new Set((before.body.sessions as Array<{ sessionId: string }>).map(row => row.sessionId));

    const secondLogin = await call(app, 'POST', '/api/auth/login', { email: 'admin@example.com', password: 'supersecret' });
    expect(secondLogin.status).toBe(200);
    const secondToken = secondLogin.body.token as string;

    const listed = await call(app, 'GET', '/api/auth/sessions', undefined, token);
    expect(listed.status).toBe(200);
    const rows = listed.body.sessions as Array<{ sessionId: string; current: boolean; createdAt: string; expiresAt: number }>;
    const current = rows.find(row => row.current);
    expect(current).toBeDefined();
    expect(current?.sessionId).not.toBe(token);
    expect(current?.sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(secondToken);
    const selfRevoke = await call(app, 'DELETE', `/api/auth/sessions/${current!.sessionId}`, undefined, token);
    expect(selfRevoke).toMatchObject({ status: 409, body: { error: { type: 'current_session' } } });
    expect((await call(app, 'GET', '/api/auth/status', undefined, token)).body.authenticated).toBe(true);

    const newlyCreated = rows.find(row => !beforeIds.has(row.sessionId));
    expect(newlyCreated).toBeDefined();
    expect(newlyCreated?.current).toBe(false);
    expect((await call(app, 'DELETE', '/api/auth/sessions/not-a-session-id', undefined, token)).status).toBe(400);

    const revoked = await call(app, 'DELETE', `/api/auth/sessions/${newlyCreated!.sessionId}`, undefined, token);
    expect(revoked).toMatchObject({ status: 200, body: { success: true, revoked: true } });
    expect((await call(app, 'GET', '/api/auth/status', undefined, secondToken)).body.authenticated).toBe(false);

    const thirdLogin = await call(app, 'POST', '/api/auth/login', { email: 'admin@example.com', password: 'supersecret' });
    expect(thirdLogin.status).toBe(200);
    const thirdToken = thirdLogin.body.token as string;
    const revokeOthers = await call(app, 'POST', '/api/auth/sessions/revoke-others', {}, token);
    expect(revokeOthers.status).toBe(200);
    expect(revokeOthers.body.revokedCount).toBeGreaterThanOrEqual(1);
    expect((await call(app, 'GET', '/api/auth/status', undefined, thirdToken)).body.authenticated).toBe(false);

    const after = await call(app, 'GET', '/api/auth/sessions', undefined, token);
    expect(after.status).toBe(200);
    expect(after.body.sessions).toHaveLength(1);
    expect(after.body.sessions[0].current).toBe(true);
  });

  it('invalidates the token on logout', async () => {
    const login = await call(app, 'POST', '/api/auth/login', { email: 'admin@example.com', password: 'supersecret' });
    const t = login.body.token;
    expect((await call(app, 'GET', '/api/keys', undefined, t)).status).toBe(200);
    await call(app, 'POST', '/api/auth/logout', {}, t);
    expect((await call(app, 'GET', '/api/keys', undefined, t)).status).toBe(401);
  });

  it('locks out after repeated failed attempts (separate email, no real account)', async () => {
    const creds = { email: 'attacker@example.com', password: 'guessguess' };
    for (let i = 0; i < 5; i++) {
      expect((await call(app, 'POST', '/api/auth/login', creds)).status).toBe(401);
    }
    expect((await call(app, 'POST', '/api/auth/login', creds)).status).toBe(429);
  });
});
