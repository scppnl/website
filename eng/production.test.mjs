import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { accountId, selectedSites, siteFor, sites, validateDeployment, writeSelection } from './production.mjs';
import { smoke } from './smoke-hosting.mjs';

test('production selection allows only registered websites and deduplicates projects', () => {
  assert.deepEqual(selectedSites([]), []);
  for (const site of sites) assert.deepEqual(selectedSites([site.project]), [site.project]);
  assert.deepEqual(selectedSites(['future-api', ...sites.map(s => s.project), sites[0].project]), sites.map(s => s.project));
  assert.throws(() => siteFor('../other'), /Unregistered/);
});

test('selection exports valid JSON, including an empty matrix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'production-output-'));
  try {
    const output = join(dir, 'output');
    writeSelection([], output);
    writeSelection(sites.map(s => s.project), output);
    assert.deepEqual(readFileSync(output, 'utf8').trim().split('\n').map(line => JSON.parse(line.slice(6))),
      [[], sites.map(s => s.project)]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('deployment rejects absent credentials, wrong account and invalid commit before invoking Wrangler', () => {
  const env = { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: 'test-placeholder', GITHUB_SHA: 'a'.repeat(40) };
  for (const site of sites) validateDeployment(site, env);
  assert.throws(() => validateDeployment(sites[0], { ...env, CLOUDFLARE_API_TOKEN: '' }), /secret CLOUDFLARE_API_TOKEN/);
  assert.throws(() => validateDeployment(sites[0], { ...env, CLOUDFLARE_ACCOUNT_ID: 'other' }), /CLOUDFLARE_ACCOUNT_ID/);
  assert.throws(() => validateDeployment(sites[0], { ...env, GITHUB_SHA: '' }), /commit SHA/);
  assert.throws(() => validateDeployment({ ...sites[0], worker: sites[1].worker }, env), /does not match/);
});

function fixture(site) {
  const files = {
    'index.html': '<h1>Home</h1><script src="main-123.js" type="module"></script>',
    [`${site.route.slice(1)}/index.html`]: '<h1>Internal route</h1>',
    'main-123.js': 'console.log("this artifact")',
    '404.html': '<h1>Pagina niet gevonden</h1>',
  };
  return {
    read: async path => Buffer.from(files[path]),
    fetchImpl: async (url, options) => {
      assert.equal(options.redirect, 'manual');
      assert.equal(options.cache, 'no-store');
      assert.equal(url.origin, site.url);
      if (url.pathname === `${site.route}/`) return new Response(null, { status: 307, headers: { location: site.route } });
      const path = url.pathname === '/' ? 'index.html' : url.pathname === site.route ? `${site.route.slice(1)}/index.html` : url.pathname.slice(1);
      return new Response(files[path] ?? files['404.html'], { status: files[path] ? 200 : 404 });
    },
    pause: async () => {},
  };
}

test('smoke checks each site against its tested artifact, including redirect and genuine 404', async () => {
  for (const site of sites) await smoke(site, fixture(site));
});

test('smoke retries propagation errors and rejects persistent stale HTML, wrong assets, SPA fallbacks and bad redirects', async () => {
  const site = sites[0];
  const good = fixture(site);
  let calls = 0;
  await smoke(site, { ...good, attempts: 2, fetchImpl: async (...args) => {
    if (calls++ === 0) throw new Error('propagating');
    return good.fetchImpl(...args);
  } });
  for (const [target, response] of [
    ['/', () => new Response('<h1>old release</h1>')],
    ['/main-123.js', () => new Response('old asset')],
    ['/__ci_missing_page__', () => new Response('<h1>SPA fallback</h1>')],
    [`${site.route}/`, () => new Response(null, { status: 308, headers: { location: '/' } })],
  ]) {
    let failed = 0;
    await assert.rejects(smoke(site, { ...good, attempts: 2, fetchImpl: async (url, options) => {
      if (url.pathname === target) { failed++; return response(); }
      return good.fetchImpl(url, options);
    } }));
    assert.equal(failed, 2);
  }
});
