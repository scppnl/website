/**
 * Lock access periods are clubhouse wall-clock times: Europe/Amsterdam, whatever time zone the
 * visitor's browser is in. The request carries `YYYY-MM-DDTHH:mm` without an offset, so every
 * check and every displayed value uses the clubhouse zone too.
 */
export const CLUBHOUSE_TIME_ZONE = 'Europe/Amsterdam';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})(?::\d{2})?$/;

const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];
const WEEKDAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

let clubhouseParts: Intl.DateTimeFormat | undefined;

/** The clubhouse calendar date and clock time of an instant. */
function wallClockAt(instant: number): { date: string; time: string; utc: number } {
  clubhouseParts ??= new Intl.DateTimeFormat('en-US', {
    timeZone: CLUBHOUSE_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const part = Object.fromEntries(
    clubhouseParts.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${part['year']}-${part['month']}-${part['day']}`,
    time: `${part['hour']}:${part['minute']}`,
    // The same wall-clock reading, as if it were UTC.
    utc: Date.UTC(
      Number(part['year']),
      Number(part['month']) - 1,
      Number(part['day']),
      Number(part['hour']),
      Number(part['minute']),
      Number(part['second']),
    ),
  };
}

/** How far the clubhouse clock is ahead of UTC at an instant, in milliseconds. */
function clubhouseOffset(instant: number): number {
  const whole = instant - (instant % 1000);
  return wallClockAt(whole).utc - whole;
}

/** The current clubhouse date (`YYYY-MM-DD`) and time (`HH:mm`). */
export function clubhouseNow(now = Date.now()): { date: string; time: string } {
  const { date, time } = wallClockAt(now);
  return { date, time };
}

/** A wall-clock reading as if it were UTC, or `null` when the date or time is missing or impossible. */
function wallClockAsUtc(date: string, time: string): number | null {
  const day = DATE.exec(date);
  const clock = TIME.exec(time);
  if (!day || !clock) {
    return null;
  }
  const [year, month, dom] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const [hours, minutes] = [Number(clock[1]), Number(clock[2])];
  const value = new Date(Date.UTC(year, month - 1, dom, hours, minutes));
  const exact =
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === dom &&
    value.getUTCHours() === hours &&
    value.getUTCMinutes() === minutes;
  return exact ? value.getTime() : null;
}

/**
 * The instant a clubhouse date and time refer to, or `null` when either is missing or invalid.
 * A time skipped by the spring clock change moves forward by the hour it skips; a time that
 * occurs twice in autumn means the second occurrence.
 */
export function clubhouseInstant(date: string, time: string): Date | null {
  const wall = wallClockAsUtc(date, time);
  if (wall === null) {
    return null;
  }
  const first = wall - clubhouseOffset(wall);
  const second = wall - clubhouseOffset(first);
  return new Date(second);
}

/** `2026-11-25T19:00`, the wall-clock time the API receives. */
export function toLocalIso(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}`;
}

/** `woensdag 25 november`, or with `withYear` `woensdag 25 november 2026`. */
export function formatDay(date: string, withYear = false): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`;
}

/** `woensdag 25 november, 19:00 – 21:30`, or both days in full when the period spans days. */
export function formatPeriod(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): string {
  const [from, to] = [startTime.slice(0, 5), endTime.slice(0, 5)];
  return startDate === endDate
    ? `${formatDay(startDate)}, ${from} – ${to}`
    : `${formatDay(startDate)} ${from} – ${formatDay(endDate)} ${to}`;
}

/** Elapsed time in whole minutes: `45 minuten`, `2 uur en 30 minuten`, `1 dag, 23 uur en 45 minuten`. */
export function formatDuration(start: Date, end: Date): string {
  const total = Math.round((end.getTime() - start.getTime()) / 60_000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts = [
    days ? `${days} ${days === 1 ? 'dag' : 'dagen'}` : '',
    hours ? `${hours} uur` : '',
    minutes ? `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}` : '',
  ].filter(Boolean);
  if (parts.length === 0) {
    return '0 minuten';
  }
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} en ${parts[parts.length - 1]}`;
}
