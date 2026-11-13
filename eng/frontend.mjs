import { resolve } from 'node:path';
import { isMain, main, run } from './process.mjs';

export const testSiteKey = '1x00000000000000000000AA';
export function bookingApiUrl(env = process.env) {
  const value = (env.BOOKING_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password)
    throw new Error('BOOKING_API_BASE_URL must be an HTTPS origin without a path or credentials.');
  return value;
}
export function siteKey(env = process.env, name = 'TURNSTILE_SITE_KEY') {
  const key = (env[name] ?? '').trim();
  if (env.REQUIRE_TURNSTILE_SITE_KEY === 'true' &&
      (!key || /^[123]x0+/.test(key))) {
    throw new Error(`Production builds require a real ${name === 'TURNSTILE_SITE_KEY' ? 'CONTACT_TURNSTILE_SITE_KEY' : name} GitHub secret.`);
  }
  if (key && !/^[A-Za-z0-9_-]+$/.test(key)) throw new Error(`Invalid ${name}`);
  return key;
}

if (isMain(import.meta.url)) main(() => {
  const [command, ...rawArgs] = process.argv.slice(2);
  const booking = rawArgs.includes('--booking-turnstile');
  const args = rawArgs.filter(arg => arg !== '--booking-turnstile');
  if (!['build', 'serve'].includes(command)) throw new Error('Expected build or serve');
  const cwd = process.cwd();
  run(process.execPath, [resolve(cwd, 'node_modules/@angular/cli/bin/ng.js'), command,
    `--define=__TURNSTILE_SITE_KEY__=${JSON.stringify(siteKey())}`,
    ...(booking ? [
      `--define=__BOOKING_TURNSTILE_SITE_KEY__=${JSON.stringify(siteKey(process.env, 'BOOKING_TURNSTILE_SITE_KEY'))}`,
      `--define=__BOOKING_API_BASE_URL__=${JSON.stringify(bookingApiUrl())}`,
    ] : []),
    ...args], { cwd });
  if (command === 'build') run(process.execPath, [resolve(import.meta.dirname, 'static-hosting.mjs'), 'prepare'], { cwd });
});
