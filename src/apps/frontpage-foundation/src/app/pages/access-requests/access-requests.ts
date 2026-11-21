import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  AccessDecisionDraft,
  AccessLock,
  accessLocks,
  AccessRequest,
  StatusTab,
} from '../../access-requests/access-request';
import {
  countByStatus,
  displayName,
  filterRequests,
  firstName,
  nextPending,
  overlapsOf,
  seriesOf,
} from '../../access-requests/access-request-queries';
import { AccessRequestService } from '../../access-requests/access-request.service';
import { accessRequestsPage } from '../../content/site-content';
import { Icon } from '../../shared/icon/icon';
import { AccessRequestPanel } from './access-request-panel';
import { AccessRequestRow } from './access-request-row';

interface Toast {
  /** The requests the decision was applied to, for undoing it. */
  readonly ids: readonly string[];
  readonly text: string;
  readonly detail: string;
}

/** Review the access requests from the form: filter the list, open one, approve or reject it. */
@Component({
  selector: 'app-access-requests',
  imports: [AccessRequestRow, AccessRequestPanel, Icon],
  styleUrl: './access-requests.scss',
  templateUrl: './access-requests.html',
})
export class AccessRequests {
  /** The open request, from `?aanvraag=` in the address. */
  readonly aanvraag = input<string>();

  protected readonly content = accessRequestsPage;
  protected readonly locks = accessLocks;

  private readonly service = inject(AccessRequestService);
  private readonly router = inject(Router);
  private readonly toastElement = viewChild<ElementRef<HTMLElement>>('toastElement');

  /** Null until the requests are loaded: the page is prerendered, so it starts without them. */
  protected readonly requests = signal<readonly AccessRequest[] | null>(null);
  protected readonly now = signal(new Date());
  protected readonly tab = signal<StatusTab>('pending');
  protected readonly query = signal('');
  protected readonly lock = signal<AccessLock | 'all'>('all');
  /** The decided request that is being reconsidered. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly toast = signal<Toast | null>(null);

  private readonly all = computed(() => this.requests() ?? []);
  protected readonly counts = computed(() => countByStatus(this.all()));
  protected readonly visible = computed(() =>
    filterRequests(this.all(), { tab: this.tab(), query: this.query(), lock: this.lock() }),
  );
  protected readonly rows = computed(() =>
    this.visible().map((request) => ({
      request,
      seriesSize: seriesOf(request, this.all()).length + (request.status === 'pending' ? 1 : 0),
    })),
  );

  protected readonly selected = computed(() => {
    const id = this.aanvraag();
    return id ? this.all().find((request) => request.id === id) : undefined;
  });
  protected readonly siblings = computed(() => {
    const request = this.selected();
    return request ? seriesOf(request, this.all()) : [];
  });
  protected readonly overlaps = computed(() => {
    const request = this.selected();
    return request ? overlapsOf(request, this.all()) : [];
  });
  protected readonly nextId = computed(() => nextPending(this.all(), this.selected()?.id)?.id);

  protected readonly caption = computed(() => {
    const count = this.visible().length;
    const adjective = this.content.tabs.find((tab) => tab.id === this.tab())?.adjective;
    const noun = count === 1 ? 'aanvraag' : 'aanvragen';
    const order = this.tab() === 'pending' ? ', eerstvolgende starttijd bovenaan' : '';
    return `${count} ${adjective ? `${adjective} ` : ''}${noun}${order}`;
  });

  protected readonly empty = computed(() => {
    if (this.query().trim() || this.lock() !== 'all') {
      return {
        title: 'Geen aanvragen gevonden',
        text: 'Pas de zoekterm of het slotfilter aan.',
      };
    }
    return this.tab() === 'pending'
      ? {
          title: 'Alles is afgehandeld',
          text: 'Nieuwe aanvragen uit het formulier verschijnen hier.',
        }
      : { title: 'Geen aanvragen', text: 'Er zijn geen aanvragen met deze status.' };
  });

  constructor() {
    afterNextRender(async () => {
      const list = await this.service.list();
      this.now.set(new Date());
      this.requests.set(list);
    });

    // After saving, the form is gone: move focus to the confirmation so it is announced and found.
    afterRenderEffect(() => {
      if (this.toast()) this.toastElement()?.nativeElement.focus();
    });
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected setLock(event: Event): void {
    this.lock.set((event.target as HTMLSelectElement).value as AccessLock | 'all');
  }

  protected async decide(request: AccessRequest, draft: AccessDecisionDraft): Promise<void> {
    const targets = [request, ...(draft.applyAll ? this.siblings() : [])];
    const list = await this.service.decide({
      ids: targets.map((target) => target.id),
      outcome: draft.outcome,
      comment: draft.comment,
      notify: draft.notify,
    });
    this.requests.set(list);
    this.editingId.set(null);

    const count = targets.length;
    const who = displayName(request);
    const result = draft.outcome === 'approved' ? 'goedgekeurd' : 'afgewezen';
    const receiver = request.name ? firstName(request) : 'De aanvrager';
    this.toast.set({
      ids: targets.map((target) => target.id),
      text: `${count > 1 ? `${count} aanvragen van ${who}` : `Aanvraag van ${who}`} ${result}.`,
      detail: draft.notify
        ? `${receiver} krijgt ${count > 1 ? 'één e-mail met alle besluiten.' : 'een e-mail.'}`
        : 'Er is geen e-mail verstuurd.',
    });
  }

  protected async undo(): Promise<void> {
    const toast = this.toast();
    if (!toast) return;
    this.requests.set(await this.service.revert(toast.ids));
    this.toast.set(null);
    this.editingId.set(null);
    await this.router.navigate([], {
      queryParams: { aanvraag: toast.ids[0] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
