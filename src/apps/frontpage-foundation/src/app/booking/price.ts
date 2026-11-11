import {
  dayparts,
  deposit,
  freeCancellationWeeks,
  rentalOption,
  type BuildingChoice,
  type DaypartId,
  type RentalOption,
} from '../content/site-content';

/** What a rental costs. The deposit is paid on top and comes back after handover. */
export interface Quote {
  readonly option: RentalOption;
  /** Number of dagdelen. */
  readonly count: number;
  readonly rent: number;
  readonly deposit: number;
  /** Rent plus deposit: what the renter transfers in total. */
  readonly total: number;
}

/** `null` until a building and at least one dagdeel are chosen. */
export function quote(
  building: BuildingChoice | '' | null | undefined,
  selected: readonly DaypartId[],
): Quote | null {
  const count = dayparts.filter((daypart) => selected.includes(daypart.id)).length;
  if (!building || count === 0) {
    return null;
  }
  const option = rentalOption(building);
  const rent = option.amount * count;
  return { option, count, rent, deposit, total: rent + deposit };
}

/**
 * The chosen dagdelen as time ranges. Neighbouring dagdelen join up:
 * ochtend + middag is `08:00 – 17:00`, ochtend + avond is `08:00 – 12:00 en 17:00 – 22:00`.
 */
export function daypartRanges(selected: readonly DaypartId[]): string {
  const ranges: { from: string; to: string }[] = [];
  for (const daypart of dayparts.filter((item) => selected.includes(item.id))) {
    const last = ranges[ranges.length - 1];
    if (last && last.to === daypart.from) {
      last.to = daypart.to;
    } else {
      ranges.push({ from: daypart.from, to: daypart.to });
    }
  }
  return ranges.map((range) => `${range.from} – ${range.to}`).join(' en ');
}

/** `1 dagdeel`, `2 dagdelen` */
export function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'dagdeel' : 'dagdelen'}`;
}

/** What renting both buildings costs extra per dagdeel; `null` unless a single building is chosen. */
export function bundleUpgrade(building: BuildingChoice | '' | null | undefined): number | null {
  if (building !== 'groot' && building !== 'klein') {
    return null;
  }
  return rentalOption('beide').amount - rentalOption(building).amount;
}

/** Parses `yyyy-MM-dd` at local noon, so daylight saving never moves the day. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day, 12);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

/** The last day the renter can still cancel for free. */
export function freeCancellationDeadline(iso: string | null | undefined): Date | null {
  const date = parseIsoDate(iso);
  if (!date) {
    return null;
  }
  date.setDate(date.getDate() - freeCancellationWeeks * 7);
  return date;
}

/** `zaterdag 13 maart 2027` */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** `za 13 mrt 2027` */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
