import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const [sessionStore, activity, manifest, gradle, keysRoute, healthRoute, authRoute, authService, appRoute, catalogRoute, discoveryService, providerDiscoveryService, providerMigration, cloudflareMigration, indexFile, androidReadme, rootReadme, authTests, cloudflareProvider, cloudflareTests, streamRedactionTests] = await Promise.all([
  read('android/app/src/main/java/com/infinity/multiplellmapi/SecureSessionStore.kt'),
  read('android/app/src/main/java/com/infinity/multiplellmapi/MainActivity.kt'),
  read('android/app/src/main/AndroidManifest.xml'),
  read('android/app/build.gradle.kts'),
  read('server/src/routes/keys.ts'),
  read('server/src/routes/health.ts'),
  read('server/src/routes/auth.ts'),
  read('server/src/services/auth.ts'),
  read('server/src/app.ts'),
  read('server/src/routes/infinity-catalog.ts'),
  read('server/src/services/infinity-discovery.ts'),
  read('server/src/services/infinity-provider-discovery.ts'),
  read('server/src/db/migrations/20261104_000003_infinity_provider_discovery.ts'),
  read('server/src/db/migrations/20261104_000004_infinity_cloudflare_discovery.ts'),
  read('server/src/index.ts'),
  read('android/README.md'),
  read('README.md'),
  read('server/src/__tests__/routes/auth.test.ts'),
  read('server/src/providers/cloudflare.ts'),
  read('server/src/__tests__/providers/cloudflare.test.ts'),
  read('server/src/__tests__/routes/proxy-stream-error-redaction.test.ts'),
]);

const checks = [
  ['AES-GCM encryption is used for persisted Android session data', /AES\/GCM\/NoPadding/.test(sessionStore) && /cipher\.doFinal\(payload\)/.test(sessionStore)],
  ['AES key is generated and held by Android Keystore', /AndroidKeyStore/.test(sessionStore) && /KeyGenParameterSpec/.test(sessionStore)],
  ['Only encrypted envelope is persisted in SharedPreferences', /putString\(PAYLOAD_KEY, encoded\)/.test(sessionStore) && /ciphertext/.test(sessionStore)],
  ['Restored session is validated against the gateway', /\/api\/auth\/status/.test(activity) && /status\.optBoolean\("authenticated"\)/.test(activity)],
  ['Gateway logout and local session clearing are wired', /\/api\/auth\/logout/.test(activity) && /sessionStore\.clear\(\)/.test(activity)],
  ['Provider listing and masked key listing are wired', /\/api\/keys\/providers/.test(activity) && /\/api\/keys"/.test(activity)],
  ['Provider create, update, delete and health-check calls are wired', /\/api\/keys"/.test(activity) && /\/api\/keys\/\$\{row\.id\}/.test(activity) && /DELETE/.test(activity) && /\/api\/health\/check\/\$\{row\.id\}/.test(activity)],
  ['HTTP cleartext is disabled and backup is disabled', /usesCleartextTraffic="false"/.test(manifest) && /allowBackup="false"/.test(manifest)],
  ['Android version metadata is 0.16.0', /versionCode = 16/.test(gradle) && /versionName = "0\.16\.0"/.test(gradle)],
  ['Backend exposes required provider and health routes', /keysRouter\.get\('\/providers'/.test(keysRoute) && /keysRouter\.get\('\/'/.test(keysRoute) && /keysRouter\.post\('\/'/.test(keysRoute) && /keysRouter\.patch\('\/:id'/.test(keysRoute) && /keysRouter\.delete\('\/:id'/.test(keysRoute) && /healthRouter\.post\('\/check\/:keyId'/.test(healthRoute)],
  ['Backend auth status/login/logout routes are mounted behind intended app API', /authRouter\.get\('\/status'/.test(authRoute) && /authRouter\.post\('\/login'/.test(authRoute) && /authRouter\.post\('\/logout'/.test(authRoute) && /app\.use\('\/api\/keys', requireAuth/.test(appRoute)],
  ['Android documentation matches current session-management implementation and version', /development preview 0\.16\.0/i.test(androidReadme) && androidReadme.includes('GET /api/auth/sessions') && androidReadme.includes('DELETE /api/auth/sessions/:sessionId') && rootReadme.includes('Android control-panel preview 0.16.0') && !androidReadme.includes('does not yet provide a server-side per-device session list')],
  ['Auth integration tests cover safe listing, individual revocation and revoke-others', authTests.includes('lists safe session metadata') && authTests.includes('revoke-others') && authTests.includes('revoked: true')],
  ['Individual session revocation refuses the caller current session and documents explicit logout', /isCurrentSession/.test(authRoute) && /current_session/.test(authRoute) && /selfRevoke/.test(authTests) && /Use `POST \/api\/auth\/logout`/.test(androidReadme)],
  ['Session management lists safe metadata and supports account-scoped revocation', /authRouter.get\('\/sessions'/.test(authRoute) && /authRouter.delete\('\/sessions\/:sessionId'/.test(authRoute) && /authRouter.post\('\/sessions\/revoke-others'/.test(authRoute) && /listUserSessions/.test(authService) && /revokeUserSession/.test(authService) && /revokeOtherUserSessions/.test(authService)],
  ['Android Gateway screen lists sessions, identifies current device and supports individual or bulk revocation', /SIGNED-IN DEVICES/.test(activity) && /\/api\/auth\/sessions/.test(activity) && /revoke-others/.test(activity) && /Revoke this device/.test(activity) && /This device/.test(activity)],
  ['Android model explorer calls Google, OpenRouter, Groq and Cloudflare discovery plus review APIs', /discover\/\$providerId/.test(activity) && /onDiscover = \{ providerId/.test(activity) && /openrouter/.test(activity) && /groq/.test(activity) && /cloudflare/.test(activity) && /catalog\/review/.test(activity) && /onDismiss/.test(activity) && /evidence\/evaluate/.test(activity) && /Verify evidence/.test(activity)],
  ['Android quota screen displays provider pools and request/token analytics', /quotaPools/.test(activity) && /analytics\/summary\?range=30d/.test(activity) && /totalRequests/.test(activity)],
  ['Android quota screen displays source, observation time and confidence metadata', /source = quota\?\.optString\(\"source\"\)/.test(activity) && /observedAt = quota\?\.optString/.test(activity) && /Confidence:/.test(activity)],
  ['Free-tier quota API returns provenance metadata from the latest selected observation', /source: freshest\?\.source/.test(await read('server/src/routes/free-tier.ts')) && /observedAt: freshest\?\.observedAt/.test(await read('server/src/routes/free-tier.ts')) && /confidence: freshest\?\.confidence/.test(await read('server/src/routes/free-tier.ts'))],
  ['Android unified API key management supports create, rotate, enable/disable and delete', /client-profiles/.test(activity) && /onRotateProfile/.test(activity) && /onDeleteProfile/.test(activity) && /clipboard\.setText/.test(activity)],
  ['Google discovery queues unverified model-list entries for Review, not auto-publication', /modelsSentToReview/.test(discoveryService) && /modelsAutoAdded: 0/.test(discoveryService) && /'review'/.test(discoveryService)],
  ['Automatic provider discovery is scheduled daily for Google, OpenRouter, Groq and Cloudflare', /startInfinityDiscoveryScheduler/.test(indexFile) && /24 \* 60 \* 60 \* 1000/.test(discoveryService) && /runInfinityProviderDiscovery/.test(discoveryService) && /runInfinityOpenRouterDiscovery/.test(providerDiscoveryService) && /runInfinityGroqDiscovery/.test(providerDiscoveryService) && /runInfinityCloudflareDiscovery/.test(providerDiscoveryService)],
  ['Infinity evidence routes expose model list, review dismissal and all provider discovery endpoints', /get\('\/models'/.test(catalogRoute) && /review\/:id\/dismiss/.test(catalogRoute) && /discover\/google/.test(catalogRoute) && /discover\/openrouter/.test(catalogRoute) && /discover\/groq/.test(catalogRoute) && /discover\/cloudflare/.test(catalogRoute)],
  ['OpenRouter auto-publication requires :free ID and zero prompt/completion prices', /endsWith\(':free'\)/.test(providerDiscoveryService) && /promptPrice === 0 && completionPrice === 0/.test(providerDiscoveryService) && /evaluateInfinityFreeModelEvidence/.test(providerDiscoveryService) && /status === 'rejected'/.test(providerDiscoveryService) && /expireEvidence/.test(providerDiscoveryService) && /disableModel/.test(providerDiscoveryService)],
  ['Groq model visibility is review-only, never automatically published', /This proves model availability only/.test(providerDiscoveryService) && /modelsAutoAdded: 0/.test(providerDiscoveryService) && /discovery is disabled/.test(providerDiscoveryService)],
  ['Cloudflare model visibility is review-only, never automatically published', /Cloudflare.*catalogue lists/.test(providerDiscoveryService) && /modelsAutoAdded: 0/.test(providerDiscoveryService) && /runInfinityCloudflareDiscovery/.test(providerDiscoveryService)],
  ['Provider registry migration seeds Groq, OpenRouter and Cloudflare official domains', /'groq'/.test(providerMigration) && /'openrouter'/.test(providerMigration) && /groq\.com/.test(providerMigration) && /openrouter\.ai/.test(providerMigration) && /'cloudflare'/.test(cloudflareMigration) && /cloudflare\.com/.test(cloudflareMigration)],
  ['Cloudflare inference adapter validates 32-character hexadecimal account IDs and non-empty tokens before URL construction', /\^\[a-f0-9\]\{32\}\$/.test(cloudflareProvider) && /token\)\s*\{/.test(cloudflareProvider) && /32-character hexadecimal ID/.test(cloudflareProvider) && cloudflareTests.includes('rejects malformed account IDs before making an upstream request') && cloudflareTests.includes('rejects malformed account IDs before opening a streaming upstream request') && cloudflareTests.includes('rejects whitespace-only tokens before making an upstream request')],
  ['Cloudflare streaming inference rejects malformed credentials before fetch and trims whitespace-only tokens', cloudflareTests.includes('rejects malformed account IDs before opening a streaming upstream request') && cloudflareTests.includes('rejects whitespace-only tokens before making an upstream request')],
  ['Streaming provider error integration test checks redaction in client SSE and persisted request analytics', streamRedactionTests.includes('contentThenError') && streamRedactionTests.includes('not.toContain(providerSecret)') && streamRedactionTests.includes('persisted request error')],
];

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
  if (!passed) failures += 1;
}
console.log(`\n${checks.length - failures}/${checks.length} Android/backend source-contract checks passed.`);
if (failures > 0) process.exitCode = 1;
