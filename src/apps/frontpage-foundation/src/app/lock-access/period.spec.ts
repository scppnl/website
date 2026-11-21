import {
  clubhouseInstant,
  clubhouseNow,
  formatDay,
  formatDuration,
  formatPeriod,
  toLocalIso,
} from './period';

describe('period helpers', () => {
  const at = (date: string, time: string) => clubhouseInstant(date, time)!;

  it('reads dates and times as clubhouse time, whatever the browser time zone', () => {
    // Winter is UTC+1, summer UTC+2. These hold in any process time zone.
    expect(at('2099-01-15', '10:00').toISOString()).toBe('2099-01-15T09:00:00.000Z');
    expect(at('2099-07-15', '10:00').toISOString()).toBe('2099-07-15T08:00:00.000Z');
  });

  it('handles the clock changes', () => {
    // 02:30 does not exist on the spring change and moves to 03:30 summer time.
    expect(at('2099-03-29', '02:30').toISOString()).toBe('2099-03-29T01:30:00.000Z');
    // 02:30 happens twice on the autumn change; the second, winter-time one counts.
    expect(at('2099-10-25', '02:30').toISOString()).toBe('2099-10-25T01:30:00.000Z');
    // The spring night is one hour shorter.
    expect(formatDuration(at('2099-03-28', '22:00'), at('2099-03-29', '06:00'))).toBe('7 uur');
  });

  it('rejects missing or impossible values', () => {
    expect(clubhouseInstant('', '19:00')).toBeNull();
    expect(clubhouseInstant('2026-11-25', '')).toBeNull();
    expect(clubhouseInstant('2026-02-31', '10:00')).toBeNull();
    expect(clubhouseInstant('2026-11-25', '25:00')).toBeNull();
  });

  it('gives the clubhouse date and time of an instant', () => {
    // 23:30 UTC on 31 December is already New Year at the clubhouse.
    expect(clubhouseNow(Date.UTC(2098, 11, 31, 23, 30))).toEqual({
      date: '2099-01-01',
      time: '00:30',
    });
  });

  it('builds the wall-clock ISO string without seconds', () => {
    expect(toLocalIso('2026-11-25', '19:00')).toBe('2026-11-25T19:00');
    expect(toLocalIso('2026-11-25', '19:00:30')).toBe('2026-11-25T19:00');
  });

  it('formats days and periods', () => {
    expect(formatDay('2026-11-25')).toBe('woensdag 25 november');
    expect(formatDay('2026-11-25', true)).toBe('woensdag 25 november 2026');
    expect(formatPeriod('2026-11-25', '19:00', '2026-11-25', '21:30')).toBe(
      'woensdag 25 november, 19:00 – 21:30',
    );
    expect(formatPeriod('2026-11-25', '19:00', '2026-11-26', '10:00')).toBe(
      'woensdag 25 november 19:00 – donderdag 26 november 10:00',
    );
  });

  it('formats durations from whole minutes', () => {
    const duration = (from: string, to: string) =>
      formatDuration(at('2099-01-12', from), at(to.split(' ')[0], to.split(' ')[1]));
    expect(duration('09:00', '2099-01-12 09:45')).toBe('45 minuten');
    expect(duration('09:00', '2099-01-12 10:00')).toBe('1 uur');
    expect(duration('19:00', '2099-01-12 21:30')).toBe('2 uur en 30 minuten');
    expect(duration('09:00', '2099-01-13 09:00')).toBe('1 dag');
    expect(duration('09:00', '2099-01-13 09:15')).toBe('1 dag en 15 minuten');
    expect(duration('09:00', '2099-01-14 08:45')).toBe('1 dag, 23 uur en 45 minuten');
    expect(duration('09:00', '2099-01-15 12:00')).toBe('3 dagen en 3 uur');
  });
});
