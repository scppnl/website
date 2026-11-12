import { vi } from 'vitest';
import { TURNSTILE_SITE_KEY, TurnstileLoader, WidgetOptions } from './turnstile-loader';

export function turnstileProviders() {
  let options: WidgetOptions;
  const api = {
    render: vi.fn((_element: HTMLElement, value: WidgetOptions) => {
      options = value;
      queueMicrotask(() => options.callback('test-token'));
      return 'widget-1';
    }),
    reset: vi.fn(() => queueMicrotask(() => options.callback('test-token'))),
    remove: vi.fn(),
  };
  return [
    { provide: TURNSTILE_SITE_KEY, useValue: 'test-site-key' },
    { provide: TurnstileLoader, useValue: { load: vi.fn(async () => api) } },
  ];
}
