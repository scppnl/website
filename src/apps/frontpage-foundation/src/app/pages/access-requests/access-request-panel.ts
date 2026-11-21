import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessDecisionDraft, AccessRequest } from '../../access-requests/access-request';
import {
  formatDateTime,
  formatLength,
  formatMoment,
  formatPeriod,
  historyLabel,
} from '../../access-requests/access-request-format';
import {
  AccessOverlap,
  displayName,
  hasAllLocks,
} from '../../access-requests/access-request-queries';
import { accessRequestsPage } from '../../content/site-content';
import { Icon } from '../../shared/icon/icon';
import { AccessDecisionForm } from './access-decision-form';
import { AccessStatusBadge } from './access-status-badge';

/** The details of one request, with the decision form while it is open, or the decision once made. */
@Component({
  selector: 'app-access-request-panel',
  imports: [RouterLink, Icon, AccessStatusBadge, AccessDecisionForm],
  styleUrl: './access-request-panel.scss',
  template: `
    <aside class="panel" aria-labelledby="panel-title">
      <a
        class="panel__back"
        routerLink="."
        [queryParams]="{ aanvraag: null }"
        queryParamsHandling="merge"
      >
        <app-icon name="chevron-left" [size]="22" [strokeWidth]="2.2" />
        Aanvragen
      </a>

      <div class="panel__head">
        <p class="eyebrow">{{ eyebrow() }}</p>
        <app-access-status-badge [status]="request().status" />
      </div>
      <h2 id="panel-title" #title tabindex="-1">{{ name() }}</h2>
      @if (request().name) {
        <a class="panel__mail" [href]="'mailto:' + request().email">
          <app-icon name="mail" [size]="16" [strokeWidth]="2" />
          {{ request().email }}
        </a>
      } @else {
        <p class="panel__note">Bij dit e-mailadres is geen naam gevonden.</p>
      }
      <p class="panel__note">Ingediend {{ submitted() }} via het formulier</p>

      <dl class="facts">
        <div>
          <dt>{{ allLocks() ? 'Sloten · alle vier' : 'Sloten' }}</dt>
          <dd class="facts__locks">
            @for (lock of request().locks; track lock) {
              <span class="lock">
                <app-icon name="lock" [size]="15" [strokeWidth]="2.2" />
                {{ lock }}
              </span>
            }
          </dd>
        </div>
        <div class="facts__times">
          <div>
            <dt>Starttijd</dt>
            <dd>{{ start() }}</dd>
          </div>
          <div>
            <dt>Eindtijd</dt>
            <dd>{{ end() }}</dd>
          </div>
        </div>
        <div>
          <dt>Duur</dt>
          <dd class="facts__plain">{{ length() }}</dd>
        </div>
        <div>
          <dt>Reden</dt>
          <dd class="facts__plain">{{ request().reason }}</dd>
        </div>
      </dl>

      @if (overlaps().length > 0) {
        <div class="overlaps">
          <p class="overlaps__title">
            <app-icon name="users" [size]="18" [strokeWidth]="2" />
            Ook toegang in deze periode
          </p>
          @for (overlap of overlaps(); track overlap.request.id) {
            <p>
              <strong>{{ displayName(overlap.request) }}</strong> ·
              {{ period(overlap.request) }} · {{ overlap.locks.join(', ') }}
            </p>
          }
        </div>
      }

      <div class="decision">
        @if (editing()) {
          <app-access-decision-form
            [request]="request()"
            [siblings]="siblings()"
            [reconsidering]="reconsidering()"
            (decided)="decided.emit($event)"
            (cancelled)="cancelled.emit()"
          />
        } @else {
          <div class="record record--{{ request().status }}">
            <p class="record__title">
              <app-icon
                [name]="request().status === 'approved' ? 'check' : 'close'"
                [size]="20"
                [strokeWidth]="2.6"
              />
              {{ statusLabel() }} door {{ request().decidedBy }}
            </p>
            <p class="record__at">{{ decidedAt() }}</p>
          </div>

          <div>
            <p class="decision__label">Toelichting voor de aanvrager</p>
            @if (request().comment) {
              <blockquote>{{ request().comment }}</blockquote>
            } @else {
              <p class="panel__note">Geen toelichting gegeven.</p>
            }
          </div>

          <div>
            <p class="decision__label">Geschiedenis</p>
            <ol class="history">
              @for (entry of request().history; track entry.at + entry.event) {
                <li>
                  <span class="history__dot" aria-hidden="true"></span>
                  <span class="history__text">
                    <span class="history__label">{{ historyLabel(entry) }}</span>
                    <span class="history__at">{{ moment(entry.at) }}</span>
                  </span>
                </li>
              }
            </ol>
          </div>

          <div class="decision__actions">
            <button type="button" class="btn btn--outline" (click)="reopen.emit()">
              Besluit herzien
            </button>
            @if (nextId(); as next) {
              <a
                class="btn btn--accent"
                routerLink="."
                [queryParams]="{ aanvraag: next }"
                queryParamsHandling="merge"
                replaceUrl
              >
                Volgende openstaande
                <app-icon name="arrow-right" [size]="18" [strokeWidth]="2.2" />
              </a>
            }
          </div>
        }
      </div>
    </aside>
  `,
})
export class AccessRequestPanel {
  readonly request = input.required<AccessRequest>();
  /** The person's other open requests. */
  readonly siblings = input<readonly AccessRequest[]>([]);
  readonly overlaps = input<readonly AccessOverlap[]>([]);
  /** The open request to continue with, if there is one. */
  readonly nextId = input<string | undefined>();
  /** The admin is changing a decision that was already made. */
  readonly reconsidering = input(false);
  readonly now = input.required<Date>();

  readonly decided = output<AccessDecisionDraft>();
  readonly reopen = output<void>();
  readonly cancelled = output<void>();

  protected readonly displayName = displayName;
  protected readonly historyLabel = historyLabel;
  protected readonly moment = formatMoment;
  protected readonly period = (request: AccessRequest) => formatPeriod(request.start, request.end);

  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  protected readonly name = computed(() => displayName(this.request()));
  protected readonly editing = computed(
    () => this.request().status === 'pending' || this.reconsidering(),
  );
  protected readonly eyebrow = computed(() =>
    this.request().status === 'pending'
      ? 'Aanvraag beoordelen'
      : this.reconsidering()
        ? 'Besluit herzien'
        : 'Aanvraag',
  );
  protected readonly allLocks = computed(() => hasAllLocks(this.request()));
  protected readonly submitted = computed(() => formatMoment(this.request().submittedAt));
  protected readonly start = computed(() => formatDateTime(this.request().start));
  protected readonly end = computed(() => formatDateTime(this.request().end));
  protected readonly length = computed(() => formatLength(this.request(), this.now()));
  protected readonly statusLabel = computed(
    () => accessRequestsPage.statusLabels[this.request().status],
  );
  protected readonly decidedAt = computed(() => {
    const at = this.request().decidedAt;
    return at ? formatMoment(at) : '';
  });

  constructor() {
    // Opening another request moves focus to its name, so keyboard and screen reader users land on it.
    const requestId = computed(() => this.request().id);
    afterRenderEffect(() => {
      requestId();
      this.title()?.nativeElement.focus();
    });
  }
}
