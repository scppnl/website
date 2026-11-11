import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatEuro, rentalOptions } from '../../content/site-content';
import { Rates } from './rates';

describe('Rates', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rates],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Rates);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows one price card per rental option, with the price on one line', () => {
    const amounts = Array.from(element.querySelectorAll('.price-card__amount')).map((node) =>
      node.textContent?.trim(),
    );
    expect(amounts).toEqual(rentalOptions.map((option) => formatEuro(option.amount)));
  });

  it('highlights the bundle price and its saving', () => {
    const featured = element.querySelector('.price-card--featured');
    expect(featured?.textContent).toContain('Beide gebouwen');
    expect(featured?.textContent).toContain('€ 20 voordeliger');
  });

  it('renders the FAQ as details elements with the first one open', () => {
    const items = element.querySelectorAll('details.faq:not(.rules__details)');
    expect(items.length).toBe(5);
    expect(items[0].hasAttribute('open')).toBe(true);
    expect(items[1].hasAttribute('open')).toBe(false);
  });
});
