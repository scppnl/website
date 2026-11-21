/** A local date (`YYYY-MM-DD`) and time (`HH:mm`) as a `Date`, or `null` when either is missing or invalid. */
export function parseLocalDateTime(date: string, time: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!day || !clock) {
    return null;
  }
  const [year, month, dom] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const [hours, minutes] = [Number(clock[1]), Number(clock[2])];
  const value = new Date(year, month - 1, dom, hours, minutes);
  const exact =
    value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === dom &&
    value.getHours() === hours &&
    value.getMinutes() === minutes;
  return exact ? value : null;
}

/** `2026-11-25T19:00`, the wall-clock time the API receives. */
export function toLocalIso(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}`;
}

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

/** `woensdag 25 november` */
export function dayLong(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `woensdag 25 november 2026` */
export function dayLongWithYear(date: Date): string {
  return `${dayLong(date)} ${date.getFullYear()}`;
}

/** `19:00` */
export function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `woensdag 25 november, 19:00 – 21:30`, or both days in full when the period spans days. */
export function formatPeriod(start: Date, end: Date): string {
  return sameDay(start, end)
    ? `${dayLong(start)}, ${clock(start)} – ${clock(end)}`
    : `${dayLong(start)} ${clock(start)} – ${dayLong(end)} ${clock(end)}`;
}

/** `2,5 uur`, `1 dag`, `2 dagen en 3 uur`. */
export function formatDuration(start: Date, end: Date): string {
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  if (hours < 24) {
    return `${String(Math.round(hours * 10) / 10).replace('.', ',')} uur`;
  }
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return `${days} ${days === 1 ? 'dag' : 'dagen'}${rest ? ` en ${rest} uur` : ''}`;
}
