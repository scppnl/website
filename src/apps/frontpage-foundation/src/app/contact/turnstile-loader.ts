import { DOCUMENT, inject, Injectable, InjectionToken } from '@angular/core';

declare const __TURNSTILE_SITE_KEY__: string;
export const TURNSTILE_SITE_KEY = new InjectionToken<string>('TURNSTILE_SITE_KEY', {
  providedIn: 'root',
  factory: () => (typeof __TURNSTILE_SITE_KEY__ === 'string' ? __TURNSTILE_SITE_KEY__ : ''),
});

export interface WidgetOptions {
  sitekey: string;
  action: string;
  appearance: 'interaction-only';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => boolean;
  'timeout-callback': () => void;
}
export interface TurnstileApi {
  render(element: HTMLElement, options: WidgetOptions): string;
  reset(id: string): void;
  remove(id: string): void;
}

@Injectable({ providedIn: 'root' })
export class TurnstileLoader {
  private readonly document = inject(DOCUMENT);
  private pending?: Promise<TurnstileApi>;

  load(): Promise<TurnstileApi> {
    if (this.pending) return this.pending;
    this.pending = new Promise<TurnstileApi>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const fail = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Verification could not be loaded'));
      };
      const timeout = setTimeout(fail, 15_000);
      script.onerror = fail;
      script.onload = () => {
        const api = (this.document.defaultView as (Window & { turnstile?: TurnstileApi }) | null)
          ?.turnstile;
        if (!api) {
          fail();
          return;
        }
        clearTimeout(timeout);
        resolve(api);
      };
      this.document.head.appendChild(script);
    }).catch((error) => {
      this.pending = undefined;
      throw error;
    });
    return this.pending;
  }
}
