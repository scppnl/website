import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteKey, testSiteKey } from './frontend.mjs';

test('only release builds require a real site key', () => {
  assert.equal(siteKey({}), '');
  assert.equal(siteKey({ TURNSTILE_SITE_KEY: testSiteKey }), testSiteKey);
  for (const key of ['', testSiteKey, '2x00000000000000000000AB', '3x00000000000000000000FF'])
    assert.throws(() => siteKey({ TURNSTILE_SITE_KEY: key, REQUIRE_TURNSTILE_SITE_KEY: 'true' }));
  assert.equal(siteKey({ TURNSTILE_SITE_KEY: 'real-public-key', REQUIRE_TURNSTILE_SITE_KEY: 'true' }), 'real-public-key');
  assert.throws(() => siteKey({ TURNSTILE_SITE_KEY: 'bad\"value' }));
});
