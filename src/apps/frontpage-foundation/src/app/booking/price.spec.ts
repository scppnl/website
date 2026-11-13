import {
  bundleUpgrade,
  daypartRanges,
  formatLongDate,
  freeCancellationDeadline,
  parseIsoDate,
  quote,
} from './price';

describe('price', () => {
  describe('quote', () => {
    it('multiplies the rate by the number of dagdelen', () => {
      expect(quote('groot', ['ochtend', 'middag'])).toMatchObject({ count: 2, rent: 150 });
      expect(quote('beide', ['ochtend', 'middag', 'avond'])).toMatchObject({
        count: 3,
        rent: 300,
      });
      expect(quote('terrein', ['avond'])).toMatchObject({ rent: 40 });
    });

    it('charges no deposit on top of the rent', () => {
      expect(Object.keys(quote('groot', ['ochtend'])!).sort()).toEqual(['count', 'option', 'rent']);
    });

    it('is not available until a building and a dagdeel are chosen', () => {
      expect(quote('', ['ochtend'])).toBeNull();
      expect(quote(null, ['ochtend'])).toBeNull();
      expect(quote('groot', [])).toBeNull();
    });

    it('counts a dagdeel once', () => {
      expect(quote('klein', ['middag', 'middag'])?.count).toBe(1);
    });
  });

  describe('daypartRanges', () => {
    it('joins neighbouring dagdelen', () => {
      expect(daypartRanges(['ochtend'])).toBe('08:00 – 12:00');
      expect(daypartRanges(['ochtend', 'middag'])).toBe('08:00 – 17:00');
      expect(daypartRanges(['middag', 'avond'])).toBe('12:00 – 22:00');
      expect(daypartRanges(['ochtend', 'middag', 'avond'])).toBe('08:00 – 22:00');
    });

    it('keeps a gap between dagdelen that do not touch', () => {
      expect(daypartRanges(['avond', 'ochtend'])).toBe('08:00 – 12:00 en 17:00 – 22:00');
    });

    it('is empty without dagdelen', () => {
      expect(daypartRanges([])).toBe('');
    });
  });

  describe('bundleUpgrade', () => {
    it('is the extra cost per dagdeel of renting both buildings', () => {
      expect(bundleUpgrade('groot')).toBe(25);
      expect(bundleUpgrade('klein')).toBe(55);
    });

    it('only applies to a single building', () => {
      expect(bundleUpgrade('beide')).toBeNull();
      expect(bundleUpgrade('terrein')).toBeNull();
      expect(bundleUpgrade('')).toBeNull();
    });
  });

  describe('dates', () => {
    it('parses an ISO date and rejects anything else', () => {
      const date = parseIsoDate('2027-03-13');
      expect([date?.getFullYear(), date?.getMonth(), date?.getDate()]).toEqual([2027, 2, 13]);
      expect(parseIsoDate('')).toBeNull();
      expect(parseIsoDate(null)).toBeNull();
      expect(parseIsoDate('13-03-2027')).toBeNull();
      expect(parseIsoDate('2027-02-31')).toBeNull();
    });

    it('allows free cancellation until four weeks before the rental day', () => {
      const deadline = freeCancellationDeadline('2027-03-13');
      expect([deadline?.getFullYear(), deadline?.getMonth(), deadline?.getDate()]).toEqual([
        2027, 1, 13,
      ]);
    });

    it('does not drift over the daylight saving change', () => {
      // 28 days before 5 April 2027 is 8 March, with the clocks changing on 28 March in between.
      const deadline = freeCancellationDeadline('2027-04-05');
      expect([deadline?.getMonth(), deadline?.getDate()]).toEqual([2, 8]);
    });

    it('has no deadline without a date', () => {
      expect(freeCancellationDeadline('')).toBeNull();
    });

    it('writes a date out in Dutch', () => {
      const text = formatLongDate(parseIsoDate('2027-03-13') as Date);
      expect(text).toContain('zaterdag');
      expect(text).toContain('13 maart 2027');
    });
  });
});
