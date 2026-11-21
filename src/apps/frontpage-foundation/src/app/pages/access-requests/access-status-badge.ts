import { Component, computed, input } from '@angular/core';
import { AccessRequestStatus } from '../../access-requests/access-request';
import { accessRequestsPage } from '../../content/site-content';
import { Icon, IconName } from '../../shared/icon/icon';

const ICONS: Record<AccessRequestStatus, IconName> = {
  pending: 'clock',
  approved: 'check',
  rejected: 'close',
};

/** The status as a coloured label. The icon repeats the word, so colour is never the only cue. */
@Component({
  selector: 'app-access-status-badge',
  imports: [Icon],
  host: { '[class]': '"badge badge--" + status()' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      flex: none;
      padding: 0.1875rem 0.75rem 0.1875rem 0.5625rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.4;
    }
    :host(.badge--pending) {
      background: var(--color-pending-bg);
      color: var(--color-pending);
    }
    :host(.badge--approved) {
      background: var(--color-approved-bg);
      color: var(--color-primary-dark);
    }
    :host(.badge--rejected) {
      background: var(--color-rejected-bg);
      color: var(--color-rejected);
    }
  `,
  template: `<app-icon [name]="icon()" [size]="15" [strokeWidth]="2.4" />{{ label() }}`,
})
export class AccessStatusBadge {
  readonly status = input.required<AccessRequestStatus>();
  protected readonly icon = computed(() => ICONS[this.status()]);
  protected readonly label = computed(() => accessRequestsPage.statusLabels[this.status()]);
}
