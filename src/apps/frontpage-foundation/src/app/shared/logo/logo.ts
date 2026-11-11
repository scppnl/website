import { booleanAttribute, Component, input } from '@angular/core';

/** The pine mark. `reversed` swaps it for use on dark backgrounds. */
@Component({
  selector: 'app-logo',
  host: { 'aria-hidden': 'true' },
  styles: ':host { display: inline-flex; flex-shrink: 0; line-height: 0; }',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" focusable="false">
      <circle cx="20" cy="20" r="20" [attr.fill]="reversed() ? '#ffffff' : '#2f5d3a'" />
      <path
        d="M20 7l7.5 11h-4.5l6.5 9H10.5l6.5-9h-4.5z"
        [attr.fill]="reversed() ? '#2f5d3a' : '#ffffff'"
      />
      <rect x="18.4" y="27" width="3.2" height="6" fill="#d9902f" />
    </svg>
  `,
})
export class Logo {
  readonly size = input(40);
  readonly reversed = input(false, { transform: booleanAttribute });
}
