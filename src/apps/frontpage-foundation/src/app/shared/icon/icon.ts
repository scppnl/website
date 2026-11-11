import { Component, computed, input } from '@angular/core';

/** Stroke paths on a 24×24 grid, taken from the design. */
const PATHS = {
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  ],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  tag: ['M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z', 'M7 7h.01'],
  'map-pin': [
    'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z',
    'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  heart: [
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  ],
  book: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  briefcase: [
    'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
    'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  ],
  check: ['M20 6L9 17l-5-5'],
  plus: ['M12 5v14M5 12h14'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  close: ['M6 6l12 12M18 6L6 18'],
  mail: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 7l9 6 9-6'],
  shield: ['M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z', 'M9 12l2 2 4-4'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v5M12 16h.01'],
  expand: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
  room: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M12 4v16'],
  kitchen: [
    'M4 21V10h16v11',
    'M4 14h16',
    'M9 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M15 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  ],
  toilet: ['M7 3v18', 'M17 3v18', 'M3 12h18'],
  drop: ['M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z'],
} as const;

export type IconName = keyof typeof PATHS;

/** Decorative inline icon; it inherits the text colour. Pair it with real text. */
@Component({
  selector: 'app-icon',
  host: { 'aria-hidden': 'true' },
  styles: ':host { display: inline-flex; flex-shrink: 0; line-height: 0; }',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @for (d of paths(); track d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);
  readonly strokeWidth = input(1.8);
  protected readonly paths = computed(() => PATHS[this.name()]);
}
