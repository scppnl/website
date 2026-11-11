import { afterNextRender, inject, makeStateKey, signal, TransferState } from '@angular/core';

interface CalendarDate { year: number; today: string }
const dateKey = makeStateKey<CalendarDate>('prerender-date');

function localDate(): CalendarDate {
  const date = new Date();
  const year = date.getFullYear();
  return {
    year,
    today: [year, String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')].join('-'),
  };
}

/** Hydrate the exact prerendered values, then use the visitor's local calendar. */
export function currentDate() {
  const state = inject(TransferState);
  const initial = state.get(dateKey, localDate());
  state.set(dateKey, initial);
  const date = signal(initial);
  afterNextRender(() => {
    state.remove(dateKey);
    date.set(localDate());
  });
  return date.asReadonly();
}
