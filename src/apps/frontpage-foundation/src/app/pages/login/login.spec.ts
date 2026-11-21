import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AUTH_API_BASE_URL } from '../../auth/auth-api-config';
import { routes } from '../../app.routes';

describe('foundation /inloggen page', () => {
  async function render(authApi: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AUTH_API_BASE_URL, useValue: authApi }],
    });
    const harness = await RouterTestingHarness.create('/inloggen');
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  it('offers Google sign-in only, without any password field', async () => {
    const element = await render('https://auth.example.nl');

    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('h1')?.textContent).toContain('Welkom terug');
    expect(element.querySelector('a.google-btn')?.getAttribute('href')).toBe(
      'https://auth.example.nl/auth/google',
    );
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('form')).toBeNull();
  });

  it('names both Workspace domains', async () => {
    const element = await render('https://auth.example.nl');

    expect(element.textContent).toContain('@scpp.nl of @blokhutdewildert.nl');
  });

  it('is rendered without the site header and footer, and has its own main landmark', async () => {
    const element = await render('https://auth.example.nl');

    expect(element.querySelector('app-header, app-footer')).toBeNull();
    expect(element.querySelector('main#main')).toBeTruthy();
    expect(element.querySelector('a[href="/"]')).toBeTruthy();
    expect(element.querySelector('a[href="/contact"]')).toBeTruthy();
  });

  it('is disabled with a notice when no auth API is configured', async () => {
    const element = await render('');

    expect(element.querySelector('a.google-btn')).toBeNull();
    expect(element.querySelector('button.google-btn')?.hasAttribute('disabled')).toBe(true);
    expect(element.textContent).toContain('Inloggen is tijdelijk niet beschikbaar');
  });
});
