import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let root: HTMLElement;
  let toggle: HTMLButtonElement;
  let desktop: MediaQueryList;

  beforeEach(async () => {
    desktop = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(desktop));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([
          { path: '', component: Header },
          { path: 'contact', component: Header },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    root = fixture.nativeElement as HTMLElement;
    document.body.append(root);
    await fixture.whenStable();
    TestBed.tick();
    toggle = root.querySelector('.menu-toggle') as HTMLButtonElement;
  });

  afterEach(() => {
    fixture?.destroy();
    root?.remove();
    vi.unstubAllGlobals();
  });

  async function openMenu() {
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  }

  function expectClosed() {
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('.nav--open')).toBeNull();
  }

  it('starts collapsed and toggles the controlled navigation', async () => {
    expectClosed();
    expect(toggle.getAttribute('aria-controls')).toBe(root.querySelector('nav')?.id);
    expect(toggle.getAttribute('aria-label')).toBe('Menu openen');
    await openMenu();
    expect(toggle.getAttribute('aria-label')).toBe('Menu sluiten');
    expect(document.documentElement.classList.contains('menu-open')).toBe(true);
    toggle.click();
    await fixture.whenStable();
    expectClosed();
    expect(document.documentElement.classList.contains('menu-open')).toBe(false);
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    await openMenu();
    const link = root.querySelector('nav a') as HTMLAnchorElement;
    link.focus();
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expectClosed();
    expect(document.activeElement).toBe(toggle);
  });

  it('does not move focus on Escape when already closed', async () => {
    const brand = root.querySelector('.brand') as HTMLAnchorElement;
    brand.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(brand);
  });

  it('links to the contact page instead of showing an e-mail address', () => {
    expect(root.querySelector('.nav__contact a[href="/contact"]')).toBeTruthy();
    expect(root.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('closes after a navigation link is selected', async () => {
    await openMenu();
    (root.querySelector('a[href="/contact"]') as HTMLAnchorElement).click();
    await fixture.whenStable();
    expectClosed();
  });

  it('closes on programmatic navigation', async () => {
    await openMenu();
    await TestBed.inject(Router).navigateByUrl('/contact');
    await fixture.whenStable();
    expectClosed();
  });

  it('keeps inside clicks open and closes on outside clicks', async () => {
    await openMenu();
    root.querySelector('nav')?.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    document.body.click();
    await fixture.whenStable();
    expectClosed();
  });

  it('closes when keyboard focus leaves the header', async () => {
    await openMenu();
    root.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
    await fixture.whenStable();
    expectClosed();
  });

  it('resets the mobile menu when the desktop breakpoint is reached', async () => {
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 68.75rem)');
    await openMenu();
    Object.assign(desktop, { matches: true });
    desktop.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expectClosed();
    Object.assign(desktop, { matches: false });
    desktop.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expectClosed();
  });
});
