import { TestBed } from '@angular/core/testing';
import { TurnstileWidget } from './turnstile-widget';
import { TURNSTILE_SITE_KEY, TurnstileLoader, WidgetOptions } from './turnstile-loader';

describe('Turnstile widget lifecycle', () => {
  let options: WidgetOptions;
  const api = {
    render: vi.fn((_element: HTMLElement, value: WidgetOptions) => {
      options = value;
      return 'widget-id';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  const load = vi.fn(async () => api);

  beforeEach(() => {
    vi.clearAllMocks();
    load.mockResolvedValue(api);
    TestBed.configureTestingModule({
      providers: [
        { provide: TURNSTILE_SITE_KEY, useValue: 'test-key' },
        { provide: TurnstileLoader, useValue: { load } },
      ],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(TurnstileWidget);
    const tokens: (string | null)[] = [];
    fixture.componentInstance.tokenChange.subscribe((token) => tokens.push(token));
    await fixture.whenStable();
    return { fixture, tokens, element: fixture.nativeElement as HTMLElement };
  }

  it('uses the expected action and invalidates expired, failed and spent tokens', async () => {
    const { fixture, tokens } = await setup();
    expect(options.action).toBe('contact');
    expect(options.appearance).toBe('interaction-only');
    options.callback('first-token');
    expect(tokens.at(-1)).toBe('first-token');
    options['expired-callback']();
    expect(tokens.at(-1)).toBe(null);
    options.callback('second-token');
    fixture.componentInstance.reset();
    expect(tokens.at(-1)).toBe(null);
    expect(api.reset).toHaveBeenCalledWith('widget-id');
    options['error-callback']();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    options.callback('third-token');
    options['timeout-callback']();
    expect(tokens.at(-1)).toBe(null);
  });

  it('allows retry after blocked scripts and removes the widget on navigation', async () => {
    load.mockRejectedValueOnce(new Error('blocked'));
    const { fixture, element } = await setup();
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
    element.querySelector('button')!.click();
    await fixture.whenStable();
    expect(api.render).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(api.remove).toHaveBeenCalledWith('widget-id');
  });

  it('does not render if navigation finishes before the script loads', async () => {
    let finish!: (value: typeof api) => void;
    load.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { fixture } = await setup();
    fixture.destroy();
    finish(api);
    await Promise.resolve();
    expect(api.render).not.toHaveBeenCalled();
  });
});
