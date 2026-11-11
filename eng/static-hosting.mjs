import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const sites = {
  'scpp-association': {
    directory: 'dist/client',
    routes: ['', 'speltakken', 'verhuur', 'contact', 'downloads'],
  },
  'scpp-foundation': {
    directory: 'dist/frontpage-foundation/browser',
    routes: ['', 'gebouw', 'ligging', 'tarieven', 'reserveren', 'contact'],
  },
};

const config = JSON.parse(await readFile('wrangler.json', 'utf8'));
const site = sites[config.name];
assert(site, 'Use a distinct, registered Worker name for each site');
assert.equal(config.main, undefined, 'Static assets must not have a runtime Worker');
assert.deepEqual(config.assets, {
  directory: site.directory,
  html_handling: 'drop-trailing-slash',
  not_found_handling: '404-page',
});
const directory = path.resolve(site.directory);

if (process.argv[2] === 'prepare') {
  // Angular emits a route directory; Workers requires this exact root filename.
  await mkdir(directory, { recursive: true });
  await copyFile(path.join(directory, '404/index.html'), path.join(directory, '404.html'));
} else if (process.argv[2] === 'check') {
  for (const route of [...site.routes, '404']) {
    const html = await readFile(path.join(directory, route, 'index.html'), 'utf8');
    assert.match(html, /<h1[\s>]/, `/${route}: missing prerendered content`);
    assert.match(html, /ngh=/, `/${route}: missing hydration markers`);
    assert.doesNotMatch(html, /<app-root[^>]*>\s*<\/app-root>/, `/${route}: empty app shell`);
    if (route === '404') assert.match(html, /Pagina niet gevonden/);
    console.log(`/${route}: prerendered HTML with hydration markers`);
  }
  assert.equal(await readFile(path.join(directory, '404.html'), 'utf8'),
    await readFile(path.join(directory, '404/index.html'), 'utf8'));

  async function files(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => entry.isDirectory()
      ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
    return nested.flat();
  }
  const assets = await files(directory);
  assert(assets.length <= 20_000, 'Exceeds Workers Free limit of 20,000 static assets');
  let largest = 0;
  for (const asset of assets) {
    const { size } = await stat(asset);
    assert(size <= 25 * 1024 * 1024, `${asset}: exceeds the 25 MiB static asset limit`);
    largest = Math.max(largest, size);
    assert(!/\.(?:mjs|cjs)$/.test(asset), `${asset}: unexpected server module in public assets`);
  }
  console.log(`${assets.length}/20,000 static assets; largest ${(largest / 1024 / 1024).toFixed(2)}/25 MiB`);
} else {
  throw new Error('Usage: node ../../../eng/static-hosting.mjs prepare|check (from an app directory)');
}
