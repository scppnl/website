/** Every time on the access-request pages is shown in the foundation's own time zone. */
export const TIME_ZONE = 'Europe/Amsterdam';

export interface CalendarDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

function wallClock(instant: number): number {
  const parts = partsFormat.formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
}

/** The calendar day in Amsterdam at the given instant. */
export function amsterdamDay(instant: Date | number | string): CalendarDay {
  const wall = new Date(wallClock(new Date(instant).getTime()));
  return { year: wall.getUTCFullYear(), month: wall.getUTCMonth() + 1, day: wall.getUTCDate() };
}

/** The instant at which Amsterdam's clocks show the given date and time. */
export function amsterdamInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - (wallClock(guess) - guess);
  return new Date(guess - (wallClock(first) - first));
}

/** Whole days from one Amsterdam calendar day to another. */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  const ms = Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
  return Math.round(ms / 86_400_000);
}
