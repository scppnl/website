import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteKey, testSiteKey, bookingApiUrl } from './frontend.mjs';

test('booking API activation defaults off and accepts only an HTTPS origin', () => {
  assert.equal(bookingApiUrl({}), '');
  assert.equal(bookingApiUrl({ BOOKING_API_BASE_URL: ' https://booking.example.org/ ' }), 'https://booking.example.org');
  for (const value of ['booking.example.org', 'http://example.org', 'https://example.org/bookings', 'https://user:password@example.org', 'https://example.org?x=1'])
    assert.throws(() => bookingApiUrl({ BOOKING_API_BASE_URL: value }), /BOOKING_API_BASE_URL must be an HTTPS origin/);
});

test('only release builds require a real site key', () => {
  assert.equal(siteKey({}), '');
  assert.equal(siteKey({ TURNSTILE_SITE_KEY: testSiteKey }), testSiteKey);
  for (const key of ['', testSiteKey, '2x00000000000000000000AB', '3x00000000000000000000FF'])
    assert.throws(() => siteKey({ TURNSTILE_SITE_KEY: key, REQUIRE_TURNSTILE_SITE_KEY: 'true' }));
  assert.equal(siteKey({ TURNSTILE_SITE_KEY: 'real-public-key', REQUIRE_TURNSTILE_SITE_KEY: 'true' }), 'real-public-key');
  assert.throws(() => siteKey({ TURNSTILE_SITE_KEY: 'bad\"value' }));
});

test('booking keys are independent and enforce release validation when selected', () => {
  const name = 'BOOKING_TURNSTILE_SITE_KEY';
  assert.equal(siteKey({}, name), '');
  assert.equal(siteKey({ [name]: testSiteKey }, name), testSiteKey);
  for (const key of ['', testSiteKey, '2x00000000000000000000AB', '3x00000000000000000000FF'])
    assert.throws(() => siteKey({ [name]: key, REQUIRE_TURNSTILE_SITE_KEY: 'true' }, name), /BOOKING_TURNSTILE_SITE_KEY/);
  assert.equal(siteKey({ [name]: 'booking-key', TURNSTILE_SITE_KEY: 'contact-key', REQUIRE_TURNSTILE_SITE_KEY: 'true' }, name), 'booking-key');
  assert.throws(() => siteKey({ [name]: 'bad"value' }, name));
  assert.equal(siteKey({ TURNSTILE_SITE_KEY: 'contact-key', REQUIRE_TURNSTILE_SITE_KEY: 'true' }), 'contact-key');
});
