import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Header } from './header';

describe('Header', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should toggle the mobile menu', async () => {
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector(
      '.menu-toggle',
    ) as HTMLButtonElement;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
