import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AUTH_API_BASE_URL } from '../../auth/auth-api-config';
import { routes } from '../../app.routes';

describe('foundation /inloggen/geen-toegang page', () => {
  async function render(authApi = 'https://auth.example.nl') {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AUTH_API_BASE_URL, useValue: authApi }],
    });
    const harness = await RouterTestingHarness.create('/inloggen/geen-toegang');
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  it('explains the refusal and names both Workspace domains', async () => {
    const element = await render();

    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('h1')?.textContent).toContain('Geen toegang');
    expect(element.textContent).toContain('@scpp.nl of @blokhutdewildert.nl');
  });

  it('does not show which account was used', async () => {
    const element = await render();

    expect(element.textContent).not.toMatch(/\S+@\S+\.\S+/);
    expect(element.textContent).not.toContain('Je probeerde in te loggen als');
  });

  it('lets people pick another Google account', async () => {
    const element = await render();
    const retry = element.querySelector('a.google-btn');

    expect(retry?.getAttribute('href')).toBe(
      'https://auth.example.nl/auth/google?prompt=select_account',
    );
    expect(retry?.textContent).toContain('Ander account kiezen');
  });

  it('links back to the website and to the contact page, without the site layout', async () => {
    const element = await render();

    expect(element.querySelector('a.btn[href="/"]')?.textContent).toContain(
      'Terug naar de website',
    );
    expect(element.querySelector('a[href="/contact"]')).toBeTruthy();
    expect(element.querySelector('app-header, app-footer')).toBeNull();
  });
});
