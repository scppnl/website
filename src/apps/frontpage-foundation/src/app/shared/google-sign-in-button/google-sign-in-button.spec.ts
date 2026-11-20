import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GoogleSignInButton } from './google-sign-in-button';

@Component({
  imports: [GoogleSignInButton],
  template: `<app-google-sign-in-button [href]="href()" [label]="label" />`,
})
class Host {
  readonly href = signal<string | null>('https://auth.example.nl/auth/google');
  label = 'Inloggen met Google';
}

describe('GoogleSignInButton', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  const link = (el: HTMLElement) => el.querySelector('a.google-btn') as HTMLAnchorElement | null;
  const click = (el: HTMLElement, init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    // jsdom would try to navigate; the button only needs to see the click.
    event.preventDefault();
    link(el)!.dispatchEvent(event);
  };

  it('is a link to the sign-in endpoint with the Google logo and label', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    expect(link(element)?.getAttribute('href')).toBe('https://auth.example.nl/auth/google');
    expect(link(element)?.textContent).toContain('Inloggen met Google');
    expect(element.querySelectorAll('svg path').length).toBe(4);
    expect(link(element)?.getAttribute('aria-busy')).toBeNull();
  });

  it('shows a busy state after a click and resets when the page is shown again', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    click(element);
    await fixture.whenStable();
    expect(link(element)?.getAttribute('aria-busy')).toBe('true');
    expect(link(element)?.textContent).toContain('Doorsturen naar Google…');

    window.dispatchEvent(new Event('pageshow'));
    await fixture.whenStable();
    expect(link(element)?.getAttribute('aria-busy')).toBeNull();
    expect(link(element)?.textContent).toContain('Inloggen met Google');
  });

  it('stays idle when the link is opened in a new tab', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    click(element, { ctrlKey: true });
    click(element, { metaKey: true });
    await fixture.whenStable();

    expect(link(element)?.getAttribute('aria-busy')).toBeNull();
  });

  it('renders a disabled button while no sign-in URL is configured', async () => {
    const fixture = await render();
    fixture.componentInstance.href.set(null);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(link(element)).toBeNull();
    expect(element.querySelector('button.google-btn')?.hasAttribute('disabled')).toBe(true);
  });
});
