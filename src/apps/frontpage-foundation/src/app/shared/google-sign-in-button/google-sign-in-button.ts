import { NgTemplateOutlet } from '@angular/common';
import { Component, input, signal } from '@angular/core';

/**
 * "Inloggen met Google" button. It is a plain link, so it also works before hydration.
 * Without a `href` (no auth API configured) it renders disabled.
 */
@Component({
  selector: 'app-google-sign-in-button',
  imports: [NgTemplateOutlet],
  host: {
    // Coming back with the browser's Back button must not leave the button spinning.
    '(window:pageshow)': 'pending.set(false)',
  },
  styleUrl: './google-sign-in-button.scss',
  template: `
    @if (href(); as url) {
      <a
        class="google-btn"
        [class.google-btn--pending]="pending()"
        [href]="url"
        [attr.aria-busy]="pending() ? 'true' : null"
        (click)="onClick($event)"
      >
        @if (pending()) {
          <svg
            class="google-btn__spinner"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M21 12a9 9 0 1 1-9-9" />
          </svg>
          <span>Doorsturen naar Google…</span>
        } @else {
          <ng-container *ngTemplateOutlet="logo" />
          <span>{{ label() }}</span>
        }
      </a>
    } @else {
      <button type="button" class="google-btn" disabled>
        <ng-container *ngTemplateOutlet="logo" />
        <span>{{ label() }}</span>
      </button>
    }

    <ng-template #logo>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </ng-template>
  `,
})
export class GoogleSignInButton {
  /** Where the sign-in flow starts, or `null` while it is not available. */
  readonly href = input<string | null>(null);
  readonly label = input('Inloggen met Google');

  protected readonly pending = signal(false);

  protected onClick(event: MouseEvent): void {
    // Opening the link in a new tab or window leaves this page as it is.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.pending.set(true);
  }
}
