import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the header navigation and the footer around public pages', async () => {
    const harness = await RouterTestingHarness.create('/');
    const compiled = harness.fixture.nativeElement as HTMLElement;
    await harness.fixture.whenStable();

    expect(compiled.querySelector('nav[aria-label="Hoofdmenu"]')).toBeTruthy();
    expect(compiled.querySelector('footer')?.textContent).toContain('Huijbergsebaan 415');
    expect(compiled.querySelectorAll('main#main').length).toBe(1);
  });

  it('renders the not-found page inside the site layout', async () => {
    const harness = await RouterTestingHarness.create('/bestaat-niet');
    await harness.fixture.whenStable();
    const compiled = harness.fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Pagina niet gevonden');
    expect(compiled.querySelector('nav[aria-label="Hoofdmenu"]')).toBeTruthy();
  });

  it('gives the management pages their own header, without the public menu or footer', async () => {
    const harness = await RouterTestingHarness.create('/beheer/toegangsaanvragen');
    await harness.fixture.whenStable();
    const compiled = harness.fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('nav[aria-label="Beheermenu"]')).toBeTruthy();
    expect(compiled.querySelector('nav[aria-label="Hoofdmenu"]')).toBeNull();
    expect(compiled.querySelector('footer')).toBeNull();
    expect(compiled.querySelectorAll('main#main').length).toBe(1);
    expect(compiled.querySelector('h1')?.textContent).toContain('Toegangsaanvragen');
  });

  it('sends /beheer on to the access requests', async () => {
    const harness = await RouterTestingHarness.create('/beheer');
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/beheer/toegangsaanvragen');
  });

  it('leaves the header and footer out of the sign-in pages', async () => {
    const harness = await RouterTestingHarness.create('/inloggen');

    for (const url of ['/inloggen', '/inloggen/geen-toegang']) {
      await harness.navigateByUrl(url);
      await harness.fixture.whenStable();
      const compiled = harness.fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('nav[aria-label="Hoofdmenu"]')).toBeNull();
      expect(compiled.querySelector('footer')).toBeNull();
      expect(compiled.querySelectorAll('main#main').length).toBe(1);
    }
  });
});
