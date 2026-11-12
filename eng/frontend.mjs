import { resolve } from 'node:path';
import { isMain, main, run } from './process.mjs';

export const testSiteKey = '1x00000000000000000000AA';
export function siteKey(env = process.env) {
  const key = (env.TURNSTILE_SITE_KEY ?? '').trim();
  if (env.REQUIRE_TURNSTILE_SITE_KEY === 'true' &&
      (!key || /^[123]x0+/.test(key))) {
    throw new Error('Production builds require a real TURNSTILE_SITE_KEY GitHub secret.');
  }
  if (key && !/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('Invalid TURNSTILE_SITE_KEY');
  return key;
}

if (isMain(import.meta.url)) main(() => {
  const [command, ...args] = process.argv.slice(2);
  if (!['build', 'serve'].includes(command)) throw new Error('Expected build or serve');
  const cwd = process.cwd();
  run(process.execPath, [resolve(cwd, 'node_modules/@angular/cli/bin/ng.js'), command,
    `--define=__TURNSTILE_SITE_KEY__=${JSON.stringify(siteKey())}`, ...args], { cwd });
  if (command === 'build') run(process.execPath, [resolve(import.meta.dirname, 'static-hosting.mjs'), 'prepare'], { cwd });
});
