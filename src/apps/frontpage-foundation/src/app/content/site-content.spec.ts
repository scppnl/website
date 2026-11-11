import {
  building,
  bundleSaving,
  dayparts,
  deposit,
  formatEuro,
  freeCancellationWeeks,
  lowestRate,
  rentalOption,
  rentalOptions,
  home,
  bookingPage,
  ratesPage,
} from './site-content';

describe('site content', () => {
  it('formats euros with and without cents', () => {
    expect(formatEuro(75)).toBe('€ 75');
    expect(formatEuro(75, true)).toBe('€ 75,00');
    expect(formatEuro(deposit, true)).toBe('€ 250,00');
  });

  it('derives the cheapest rate and the bundle saving from the rental options', () => {
    expect(lowestRate()).toBe(40);
    expect(bundleSaving()).toBe(20);
    expect(rentalOption('beide').amount).toBe(100);
  });

  it('uses unique option ids', () => {
    const ids = rentalOptions.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reads every displayed price from the rental options', () => {
    const fact = home.facts.find((item) => item.icon === 'tag');
    expect(fact?.title.long).toBe(`Vanaf ${formatEuro(lowestRate())}`);
    expect(ratesPage.savingLabel.long).toContain(formatEuro(bundleSaving()));
    expect(bookingPage.payment.returned.text).toContain(formatEuro(deposit, true));
  });

  it('keeps the dagdelen unique, in day order and inside the opening hours', () => {
    const ids = dayparts.map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(dayparts[0].from).toBe(building.earliestStart);
    expect(dayparts[dayparts.length - 1].to).toBe(building.latestEnd);
    dayparts.forEach((part, index) => {
      expect(part.from < part.to).toBe(true);
      if (index > 0) {
        expect(part.from >= dayparts[index - 1].to).toBe(true);
      }
    });
  });

  it('uses the free cancellation window in the FAQ answer', () => {
    const answer = ratesPage.faq.find((item) => item.question.includes('annuleren'))?.answer;
    expect(answer?.long).toContain(`${freeCancellationWeeks} weken`);
  });
});
