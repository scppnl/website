import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { SeoTitleStrategy } from './seo-title-strategy';

describe('SeoTitleStrategy', () => {
  async function navigate(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: TitleStrategy, useClass: SeoTitleStrategy }],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return { title: TestBed.inject(Title), meta: TestBed.inject(Meta) };
  }

  afterEach(() => document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove()));

  it('appends the foundation name to the page title', async () => {
    const { title } = await navigate('/contact');

    expect(title.getTitle()).toBe('Contact | Stichting Blokhut De Wildert');
  });

  it('asks search engines to skip the sign-in pages', async () => {
    const { meta } = await navigate('/inloggen');

    expect(meta.getTag('name="robots"')?.content).toBe('noindex');
  });

  it('asks the same for the no-access page', async () => {
    const { meta } = await navigate('/inloggen/geen-toegang');

    expect(meta.getTag('name="robots"')?.content).toBe('noindex');
  });

  it('removes the robots tag again on public pages', async () => {
    const { meta } = await navigate('/inloggen');
    expect(meta.getTag('name="robots"')).toBeTruthy();

    await TestBed.inject(Router).navigateByUrl('/contact');

    expect(meta.getTag('name="robots"')).toBeNull();
  });
});
