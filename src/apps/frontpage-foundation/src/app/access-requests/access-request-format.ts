import { AccessRequest, AccessRequestHistoryEntry } from './access-request';
import { amsterdamDay, daysBetween, TIME_ZONE } from './amsterdam-time';

const shortDay = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const longDay = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dateWithYear = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const clock = new Intl.DateTimeFormat('nl-NL', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const HOUR = 3_600_000;

function sameDay(a: string, b: string): boolean {
  const first = amsterdamDay(a);
  const second = amsterdamDay(b);
  return daysBetween(first, second) === 0;
}

/** "wo 25 nov · 19:00 – 21:30", or "wo 25 nov 19:00 – do 26 nov 08:00" across days. */
export function formatPeriod(start: string, end: string): string {
  const from = `${shortDay.format(new Date(start))}`;
  if (sameDay(start, end)) {
    return `${from} · ${clock.format(new Date(start))} – ${clock.format(new Date(end))}`;
  }
  return `${from} ${clock.format(new Date(start))} – ${shortDay.format(new Date(end))} ${clock.format(new Date(end))}`;
}

/** "zaterdag 19 december, 08:00". */
export function formatDateTime(instant: string): string {
  const date = new Date(instant);
  return `${longDay.format(date)}, ${clock.format(date)}`;
}

/** "19 nov 2026 om 16:40". */
export function formatMoment(instant: string): string {
  const date = new Date(instant);
  return `${dateWithYear.format(date)} om ${clock.format(date)}`;
}

function decimal(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

/** "2,5 uur", or "1 dag en 3 uur" from a day on. */
export function formatDuration(start: string, end: string): string {
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / HOUR;
  if (hours < 24) return `${decimal(hours)} uur`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return `${days} ${days === 1 ? 'dag' : 'dagen'}${rest ? ` en ${rest} uur` : ''}`;
}

/** "vandaag", "morgen", "over 5 dagen" or "al voorbij", by Amsterdam calendar day. */
export function formatRelativeStart(start: string, now: Date): string {
  const days = daysBetween(amsterdamDay(now), amsterdamDay(start));
  if (days < 0) return 'al voorbij';
  if (days === 0) return 'vandaag';
  if (days === 1) return 'morgen';
  return `over ${days} dagen`;
}

/** The duration, plus when an open request begins: "2,5 uur · begint over 5 dagen". */
export function formatLength(
  request: Pick<AccessRequest, 'start' | 'end' | 'status'>,
  now: Date,
): string {
  const duration = formatDuration(request.start, request.end);
  return request.status === 'pending'
    ? `${duration} · begint ${formatRelativeStart(request.start, now)}`
    : duration;
}

/**
 * "Goedgekeurd door Karin Willems · e-mail verstuurd", or the matching line for the other events.
 * An e-mail that was only simulated says so.
 */
export function historyLabel(entry: AccessRequestHistoryEntry): string {
  if (entry.event === 'submitted') return 'Ingediend via het formulier';
  const verb = entry.event === 'approved' ? 'goedgekeurd' : 'afgewezen';
  const lead = entry.revised ? `Herzien naar ${verb}` : verb.replace(/^./, (c) => c.toUpperCase());
  const mail = !entry.notified
    ? ''
    : entry.simulated
      ? ' · e-mail niet verstuurd (voorbeeld)'
      : ' · e-mail verstuurd';
  return `${lead} door ${entry.by}${mail}`;
}
