import { InjectionToken } from '@angular/core';

declare const __BOOKING_TURNSTILE_SITE_KEY__: string;

export const BOOKING_TURNSTILE_SITE_KEY = new InjectionToken<string>('BOOKING_TURNSTILE_SITE_KEY', {
  providedIn: 'root',
  factory: () =>
    typeof __BOOKING_TURNSTILE_SITE_KEY__ === 'string' ? __BOOKING_TURNSTILE_SITE_KEY__ : '',
});
