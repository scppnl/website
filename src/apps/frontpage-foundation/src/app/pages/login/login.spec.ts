import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AUTH_API_BASE_URL } from '../../auth/auth-api-config';
import { routes } from '../../app.routes';

const sessionUrl = 'https://auth.example.nl/auth/session';
const signedIn = { email: 'jan@scpp.nl', name: 'Jan Jansen', expiresAt: '2026-11-21T20:00:00Z' };

/** Lets the service's promise chain finish, then renders what it changed. */
async function settle(harness: RouterTestingHarness) {
  await new Promise((resolve) => setTimeout(resolve));
  await harness.fixture.whenStable();
  harness.detectChanges();
}

describe('foundation /inloggen page', () => {
  /** Renders the page and answers its session check: a session object, or null for 401. */
  async function render(authApi: string, session: object | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTH_API_BASE_URL, useValue: authApi },
      ],
    });
    const harness = await RouterTestingHarness.create('/inloggen');
    await harness.fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    if (authApi) {
      const request = http.expectOne(sessionUrl);
      if (session) request.flush(session);
      else request.flush(null, { status: 401, statusText: 'Unauthorized' });
      await settle(harness);
    }
    return { element: harness.routeNativeElement as HTMLElement, harness, http };
  }

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('offers Google sign-in only, without any password field', async () => {
    const { element } = await render('https://auth.example.nl');

    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('h1')?.textContent).toContain('Welkom terug');
    expect(element.querySelector('a.google-btn')?.getAttribute('href')).toBe(
      'https://auth.example.nl/auth/google',
    );
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('form')).toBeNull();
  });

  it('names both Workspace domains', async () => {
    const { element } = await render('https://auth.example.nl');

    expect(element.textContent).toContain('@scpp.nl of @blokhutdewildert.nl');
  });

  it('is rendered without the site header and footer, and has its own main landmark', async () => {
    const { element } = await render('https://auth.example.nl');

    expect(element.querySelector('app-header, app-footer')).toBeNull();
    expect(element.querySelector('main#main')).toBeTruthy();
    expect(element.querySelector('a[href="/"]')).toBeTruthy();
    expect(element.querySelector('a[href="/contact"]')).toBeTruthy();
  });

  it('is disabled with a notice when no auth API is configured', async () => {
    const { element, http } = await render('');

    expect(element.querySelector('a.google-btn')).toBeNull();
    expect(element.querySelector('button.google-btn')?.hasAttribute('disabled')).toBe(true);
    expect(element.textContent).toContain('Inloggen is tijdelijk niet beschikbaar');
    http.expectNone(() => true);
  });

  describe('when already signed in', () => {
    it('shows as whom, and offers another account and sign-out instead of sign-in', async () => {
      const { element } = await render('https://auth.example.nl', signedIn);

      expect(element.querySelector('h1')?.textContent).toContain('Je bent ingelogd');
      expect(element.querySelector('.login__identity')?.textContent).toContain('Jan Jansen');
      expect(element.querySelector('.login__identity')?.textContent).toContain('jan@scpp.nl');
      expect(element.querySelector('a.google-btn')?.getAttribute('href')).toBe(
        'https://auth.example.nl/auth/google?prompt=select_account',
      );
      expect(element.querySelector('a.google-btn')?.textContent).toContain('Ander account kiezen');
      expect(element.textContent).not.toContain('Inloggen met Google');
      expect(element.textContent).not.toContain('Welkom terug');
      expect(element.querySelector('button.btn')?.textContent).toContain('Uitloggen');
    });

    it('shows only the email when Google sent no name', async () => {
      const { element } = await render('https://auth.example.nl', { ...signedIn, name: null });

      const identity = element.querySelector('.login__identity')?.textContent ?? '';
      expect(identity).toContain('jan@scpp.nl');
      expect(identity).not.toContain('(');
    });

    it('signs out and shows the sign-in button again', async () => {
      const { element, harness, http } = await render('https://auth.example.nl', signedIn);

      (element.querySelector('button.btn') as HTMLButtonElement).click();
      const request = http.expectOne(sessionUrl);
      expect(request.request.method).toBe('DELETE');
      expect(request.request.withCredentials).toBe(true);
      request.flush(null, { status: 204, statusText: 'No Content' });
      await settle(harness);

      expect(element.querySelector('h1')?.textContent).toContain('Welkom terug');
      expect(element.querySelector('a.google-btn')?.getAttribute('href')).toBe(
        'https://auth.example.nl/auth/google',
      );
      expect(element.textContent).toContain('Je bent uitgelogd');
    });

    it('stays signed in and shows an error when signing out fails', async () => {
      const { element, harness, http } = await render('https://auth.example.nl', signedIn);

      (element.querySelector('button.btn') as HTMLButtonElement).click();
      http.expectOne(sessionUrl).flush(null, { status: 403, statusText: 'Forbidden' });
      await settle(harness);

      expect(element.querySelector('h1')?.textContent).toContain('Je bent ingelogd');
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Uitloggen is mislukt',
      );
      expect(element.querySelector('button.btn')?.hasAttribute('disabled')).toBe(false);
    });
  });
});
