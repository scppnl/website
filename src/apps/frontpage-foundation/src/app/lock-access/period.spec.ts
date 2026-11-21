import { clock, formatDuration, formatPeriod, parseLocalDateTime, toLocalIso } from './period';

describe('period helpers', () => {
  const at = (date: string, time: string) => parseLocalDateTime(date, time)!;

  it('parses a local date and time and rejects missing or impossible values', () => {
    expect(clock(at('2026-11-25', '19:00'))).toBe('19:00');
    expect(parseLocalDateTime('', '19:00')).toBeNull();
    expect(parseLocalDateTime('2026-11-25', '')).toBeNull();
    expect(parseLocalDateTime('2026-02-31', '10:00')).toBeNull();
    expect(parseLocalDateTime('2026-11-25', '25:00')).toBeNull();
  });

  it('builds the wall-clock ISO string without seconds', () => {
    expect(toLocalIso('2026-11-25', '19:00')).toBe('2026-11-25T19:00');
    expect(toLocalIso('2026-11-25', '19:00:30')).toBe('2026-11-25T19:00');
  });

  it('formats a period within one day', () => {
    expect(formatPeriod(at('2026-11-25', '19:00'), at('2026-11-25', '21:30'))).toBe(
      'woensdag 25 november, 19:00 – 21:30',
    );
  });

  it('formats a period across days', () => {
    expect(formatPeriod(at('2026-11-25', '19:00'), at('2026-11-26', '10:00'))).toBe(
      'woensdag 25 november 19:00 – donderdag 26 november 10:00',
    );
  });

  it('formats durations', () => {
    expect(formatDuration(at('2026-11-25', '19:00'), at('2026-11-25', '21:30'))).toBe('2,5 uur');
    expect(formatDuration(at('2026-11-25', '19:00'), at('2026-11-25', '20:00'))).toBe('1 uur');
    expect(formatDuration(at('2026-11-25', '19:00'), at('2026-11-26', '19:00'))).toBe('1 dag');
    expect(formatDuration(at('2026-11-25', '19:00'), at('2026-11-27', '22:00'))).toBe(
      '2 dagen en 3 uur',
    );
    expect(formatDuration(at('2026-11-25', '19:00'), at('2026-11-26', '22:00'))).toBe(
      '1 dag en 3 uur',
    );
  });
});
