import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { foundation, navItems } from '../../content/site-content';
import { Footer } from './footer';

describe('Footer', () => {
  async function render() {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Footer);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the name and address but no e-mail address', async () => {
    const element = await render();

    expect(element.textContent).toContain(foundation.name);
    expect(element.textContent).toContain(foundation.address.street);
    expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('lists the menu pages and the booking page', async () => {
    const element = await render();
    const links = Array.from(element.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));

    expect(links).toEqual([...navItems.map((item) => item.path), '/reserveren']);
  });
});
