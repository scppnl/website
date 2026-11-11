import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { isMain, main, root } from './process.mjs';
import { siteFor } from './production.mjs';

export async function smoke(site, { fetchImpl = fetch, attempts = 6, pause = setTimeout,
  read = path => readFile(resolve(root, site.directory, site.assets, path)) } = {}) {
  const home = await read('index.html');
  const assetPath = home.toString().match(/<script\b[^>]*\bsrc="([^"?#]+\.js)"/i)?.[1];
  assert(assetPath, 'Homepage must reference a JavaScript asset');
  const asset = new URL(assetPath, `${site.url}/`);
  assert.equal(asset.origin, new URL(site.url).origin, 'Smoke-test asset must belong to this site');
  const checks = [
    ['/', 200, home],
    [site.route, 200, await read(`${site.route.slice(1)}/index.html`)],
    [asset.pathname, 200, await read(asset.pathname.slice(1))],
    ['/__ci_missing_page__', 404, await read('404.html')],
  ];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      for (const [path, status, expected] of checks) {
        const response = await fetchImpl(new URL(path, site.url), {
          redirect: 'manual', signal: AbortSignal.timeout(15_000), cache: 'no-store',
        });
        assert.equal(response.status, status, `${path}: HTTP status`);
        assert(Buffer.from(await response.arrayBuffer()).equals(expected), `${path}: published bytes differ from tested artifact`);
      }
      const redirect = await fetchImpl(new URL(`${site.route}/`, site.url), {
        redirect: 'manual', signal: AbortSignal.timeout(15_000), cache: 'no-store',
      });
      assert([301, 302, 307, 308].includes(redirect.status), `Trailing slash must redirect (received HTTP ${redirect.status})`);
      assert(redirect.headers.get('location'), 'Redirect must include Location');
      assert.equal(new URL(redirect.headers.get('location'), site.url).href, `${site.url}${site.route}`);
      await redirect.body?.cancel();
      console.log(`${site.worker}: homepage, route, asset, redirect and 404 passed at ${site.url}`);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`${site.worker}: smoke attempt ${attempt}/${attempts} failed: ${error.message}`);
      await pause(5_000);
    }
  }
}

if (isMain(import.meta.url)) main(() => smoke(siteFor(process.argv[2])));
