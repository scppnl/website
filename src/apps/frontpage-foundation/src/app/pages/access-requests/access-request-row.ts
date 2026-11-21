import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessRequest } from '../../access-requests/access-request';
import { formatLength, formatPeriod } from '../../access-requests/access-request-format';
import { displayName, firstName, hasAllLocks } from '../../access-requests/access-request-queries';
import { Icon } from '../../shared/icon/icon';
import { AccessStatusBadge } from './access-status-badge';

/** One request in the list. It is a link, so the address bar always says which one is open. */
@Component({
  selector: 'app-access-request-row',
  imports: [RouterLink, Icon, AccessStatusBadge],
  styleUrl: './access-request-row.scss',
  template: `
    <a
      class="row"
      routerLink="."
      [queryParams]="{ aanvraag: request().id }"
      queryParamsHandling="merge"
      [replaceUrl]="replaceUrl()"
      [attr.aria-current]="selected() ? 'true' : null"
    >
      <span class="row__who">
        <span class="row__name">{{ name() }}</span>
        <span class="row__sub">{{ request().name ? request().email : 'Naam niet gevonden' }}</span>
      </span>
      <span class="row__when">
        <span class="row__period">
          <app-icon name="calendar" [size]="18" [strokeWidth]="2" />
          {{ period() }}
        </span>
        <span class="row__meta">{{ meta() }}</span>
      </span>
      <span class="row__locks">
        @for (lock of locks(); track lock) {
          <span class="lock">
            <app-icon name="lock" [size]="14" [strokeWidth]="2.2" />
            {{ lock }}
          </span>
        }
      </span>
      <app-access-status-badge [status]="request().status" />
      <span class="row__foot">
        <span class="row__reason">{{ request().reason }}</span>
        @if (seriesSize() > 1) {
          <span class="row__series">
            <app-icon name="copy" [size]="16" [strokeWidth]="2.2" />
            {{ seriesSize() }} aanvragen van {{ first() }}
          </span>
        }
      </span>
    </a>
  `,
})
export class AccessRequestRow {
  readonly request = input.required<AccessRequest>();
  readonly selected = input(false);
  /** Requests from the same person that are still open, this one included. */
  readonly seriesSize = input(1);
  readonly now = input.required<Date>();
  /** Switching between requests should not fill the browser history. */
  readonly replaceUrl = input(false);

  protected readonly name = computed(() => displayName(this.request()));
  protected readonly first = computed(() => firstName(this.request()));
  protected readonly period = computed(() => formatPeriod(this.request().start, this.request().end));
  protected readonly locks = computed(() =>
    hasAllLocks(this.request()) ? ['Alle sloten'] : this.request().locks,
  );
  protected readonly meta = computed(() => formatLength(this.request(), this.now()));
}
