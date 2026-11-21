import { amsterdamDay, amsterdamInstant, daysBetween } from './amsterdam-time';
import {
  formatDateTime,
  formatDuration,
  formatLength,
  formatMoment,
  formatPeriod,
  formatRelativeStart,
  historyLabel,
} from './access-request-format';

/** An Amsterdam wall-clock time as the ISO instant the API would send. */
const at = (month: number, day: number, hour: number, minute = 0) =>
  amsterdamInstant(2026, month, day, hour, minute).toISOString();

describe('Amsterdam time', () => {
  it('maps wall-clock times to instants in winter and summer time', () => {
    expect(amsterdamInstant(2026, 12, 1, 12, 0).toISOString()).toBe('2026-12-01T11:00:00.000Z');
    expect(amsterdamInstant(2026, 7, 1, 12, 0).toISOString()).toBe('2026-07-01T10:00:00.000Z');
  });

  it('reads the calendar day in Amsterdam, not in UTC', () => {
    expect(amsterdamDay('2026-11-20T23:30:00Z')).toEqual({ year: 2026, month: 11, day: 21 });
  });

  it('counts days across month ends', () => {
    expect(daysBetween({ year: 2026, month: 11, day: 28 }, { year: 2026, month: 12, day: 2 })).toBe(4);
  });
});

describe('formatPeriod', () => {
  it('shows one day with a time range', () => {
    expect(formatPeriod(at(11, 25, 19), at(11, 25, 21, 30))).toBe('wo 25 nov · 19:00 – 21:30');
  });

  it('shows both days when the period spans midnight', () => {
    expect(formatPeriod(at(11, 25, 19), at(11, 26, 8))).toBe('wo 25 nov 19:00 – do 26 nov 08:00');
  });

  it('uses the Amsterdam day for times late in the evening', () => {
    expect(formatPeriod(at(11, 25, 23, 30), at(11, 26, 1))).toBe('wo 25 nov 23:30 – do 26 nov 01:00');
  });
});

describe('moments', () => {
  it('writes the long date with the time', () => {
    expect(formatDateTime(at(12, 19, 8))).toBe('zaterdag 19 december, 08:00');
  });

  it('writes when something happened', () => {
    expect(formatMoment(at(11, 19, 16, 40))).toBe('19 nov 2026 om 16:40');
  });
});

describe('formatDuration', () => {
  it('uses hours with a decimal comma under a day', () => {
    expect(formatDuration(at(11, 25, 19), at(11, 25, 21, 30))).toBe('2,5 uur');
    expect(formatDuration(at(12, 19, 8), at(12, 19, 23))).toBe('15 uur');
  });

  it('switches to days from 24 hours', () => {
    expect(formatDuration(at(11, 25, 8), at(11, 26, 11))).toBe('1 dag en 3 uur');
    expect(formatDuration(at(11, 25, 8), at(11, 27, 8))).toBe('2 dagen');
  });
});

describe('formatRelativeStart', () => {
  const now = new Date(at(11, 20, 14));

  it('counts calendar days', () => {
    expect(formatRelativeStart(at(11, 20, 18), now)).toBe('vandaag');
    expect(formatRelativeStart(at(11, 21, 9), now)).toBe('morgen');
    expect(formatRelativeStart(at(11, 25, 9), now)).toBe('over 5 dagen');
    expect(formatRelativeStart(at(11, 19, 9), now)).toBe('al voorbij');
  });

  it('treats a start just after midnight as tomorrow, late in the evening', () => {
    expect(formatRelativeStart(at(11, 21, 0, 30), new Date(at(11, 20, 23, 30)))).toBe('morgen');
  });
});

describe('formatLength', () => {
  const now = new Date(at(11, 20, 14));
  const base = { start: at(11, 25, 19), end: at(11, 25, 21, 30) };

  it('adds the start for open requests only', () => {
    expect(formatLength({ ...base, status: 'pending' }, now)).toBe('2,5 uur · begint over 5 dagen');
    expect(formatLength({ ...base, status: 'approved' }, now)).toBe('2,5 uur');
  });
});

describe('historyLabel', () => {
  it('describes each event', () => {
    const when = at(11, 20, 14);
    expect(historyLabel({ event: 'submitted', at: when, revised: false })).toBe(
      'Ingediend via het formulier',
    );
    expect(
      historyLabel({ event: 'rejected', at: when, revised: false, by: 'Karin Willems', notified: true }),
    ).toBe('Afgewezen door Karin Willems · e-mail verstuurd');
    expect(
      historyLabel({ event: 'approved', at: when, revised: true, by: 'Ruud Hermans', notified: false }),
    ).toBe('Herzien naar goedgekeurd door Ruud Hermans');
  });
});
