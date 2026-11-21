import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { currentDate } from '../../../current-date';
import { lockAccessPage } from '../../content/site-content';
import { LockAccessRequest, LockId } from '../../lock-access/lock-access-request';
import { LockAccessRequestService } from '../../lock-access/lock-access-request.service';
import {
  clubhouseInstant,
  clubhouseNow,
  formatDay,
  formatDuration,
  formatPeriod,
  toLocalIso,
} from '../../lock-access/period';
import { MemberBar } from '../../layout/member-bar/member-bar';
import { Icon } from '../../shared/icon/icon';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
type FieldKey = 'locks' | 'start' | 'end' | 'reason';
type Errors = Partial<Record<FieldKey, string>>;

interface FormValue {
  readonly locks: Readonly<Record<LockId, boolean>>;
  readonly period: {
    readonly startDate: string;
    readonly startTime: string;
    readonly endDate: string;
    readonly endTime: string;
  };
  readonly reason: string;
}

interface SentRequest {
  readonly locks: string;
  readonly start: string;
  readonly end: string;
  readonly reason: string;
  readonly submittedAt: string;
}

/** The error summary lists problems in the order the fields appear on the page. */
const FIELD_ORDER: readonly FieldKey[] = ['locks', 'start', 'end', 'reason'];

@Component({
  selector: 'app-lock-access',
  imports: [ReactiveFormsModule, MemberBar, Icon],
  styleUrl: './lock-access.scss',
  templateUrl: './lock-access.html',
})
export class LockAccess {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(LockAccessRequestService);
  private readonly injector = inject(Injector);

  protected readonly content = lockAccessPage;
  /** Prerendered with the build's date, then the clubhouse date in the browser. */
  protected readonly minDate = signal(currentDate()().today);
  protected readonly status = signal<SubmitStatus>('idle');
  protected readonly sent = signal<SentRequest | null>(null);
  /** Errors only show once the visitor tried to submit. */
  private readonly submitted = signal(false);
  /** Bumped on every submit, so the shown errors are re-checked against the clock each time. */
  private readonly attempt = signal(0);

  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');

  protected readonly form = this.fb.group({
    locks: this.fb.group(
      Object.fromEntries(
        this.content.locks.map((lock) => [lock.id, this.fb.control(false)]),
      ) as Record<LockId, FormControl<boolean>>,
    ),
    period: this.fb.group({
      startDate: [''],
      startTime: [''],
      endDate: [''],
      endTime: [''],
    }),
    reason: [''],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  private readonly chosenLocks = computed(() =>
    this.content.locks.filter((lock) => this.value().locks[lock.id]),
  );

  protected readonly allChosen = computed(
    () => this.chosenLocks().length === this.content.locks.length,
  );

  /** Shown once both ends are valid and in the right order. */
  protected readonly summaryLine = computed(() => {
    const { startDate, startTime, endDate, endTime } = this.value().period;
    const [start, end] = [
      clubhouseInstant(startDate, startTime),
      clubhouseInstant(endDate, endTime),
    ];
    return start && end && end > start
      ? {
          period: formatPeriod(startDate, startTime, endDate, endTime),
          duration: formatDuration(start, end),
        }
      : null;
  });

  protected readonly reasonCount = computed(
    () => `${this.value().reason.length} / ${this.content.reasonMaxLength}`,
  );

  protected readonly errors = computed<Errors>(() => {
    this.attempt();
    return this.submitted() ? this.validate(this.value()) : {};
  });

  protected readonly errorList = computed(() => {
    const errors = this.errors();
    return FIELD_ORDER.filter((key) => errors[key]).map((key) => ({
      id: `field-${key}`,
      text: errors[key] as string,
    }));
  });

  protected readonly errorTitle = computed(() => {
    const count = this.errorList().length;
    return count === 1
      ? 'Nog één ding voor je kunt versturen'
      : `Nog ${count} dingen voor je kunt versturen`;
  });

  constructor() {
    // A period can only end after it starts, so the end date follows the start date.
    const { startDate, endDate } = this.form.controls.period.controls;
    const subscription = startDate.valueChanges.subscribe((date) => {
      if (date && (!endDate.value || endDate.value < date)) {
        endDate.setValue(date);
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    afterNextRender(() => this.minDate.set(clubhouseNow().date));
  }

  /** Checked against the clubhouse clock at the moment of asking, so a stale page cannot pass a past start. */
  private validate(value: FormValue): Errors {
    const errors: Errors = {};
    const messages = this.content.errors;
    const { locks, period, reason } = value;
    const start = clubhouseInstant(period.startDate, period.startTime);
    const end = clubhouseInstant(period.endDate, period.endTime);

    if (!this.content.locks.some((lock) => locks[lock.id])) {
      errors.locks = messages.locks;
    }
    if (!start) {
      errors.start = messages.startMissing;
    } else if (start.getTime() < Date.now()) {
      errors.start = messages.startPast;
    }
    if (!end) {
      errors.end = messages.endMissing;
    } else if (start && end <= start) {
      errors.end = messages.endBeforeStart;
    }
    if (reason.trim().length < this.content.reasonMinLength) {
      errors.reason = messages.reason;
    }
    return errors;
  }

  protected toggleAll(): void {
    const on = !this.allChosen();
    this.form.controls.locks.setValue(
      Object.fromEntries(this.content.locks.map((lock) => [lock.id, on])) as Record<
        LockId,
        boolean
      >,
    );
  }

  /** The summary links point at a field's group; focus its first control. */
  protected focusField(event: Event, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id)?.querySelector<HTMLElement>('input, textarea');
    target?.focus();
  }

  protected async submit(): Promise<void> {
    if (this.status() === 'submitting') {
      return;
    }
    this.submitted.set(true);
    this.attempt.update((count) => count + 1);
    if (Object.keys(this.errors()).length > 0) {
      afterNextRender(() => this.summary()?.nativeElement.focus(), { injector: this.injector });
      return;
    }

    const request = this.toRequest();
    this.status.set('submitting');
    this.form.disable();
    try {
      await this.service.submit(request);
    } catch {
      this.status.set('error');
      return;
    } finally {
      this.form.enable({ emitEvent: false });
    }
    this.sent.set(this.toSent(request));
    this.status.set('success');
    afterNextRender(() => this.sentHeading()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Start over with nothing filled in. */
  protected again(): void {
    this.form.reset();
    this.back();
  }

  /** Keep the chosen locks, ask for another period. */
  protected sameLocks(): void {
    this.form.controls.period.reset();
    this.form.controls.reason.reset();
    this.back();
  }

  private back(): void {
    this.submitted.set(false);
    this.sent.set(null);
    this.status.set('idle');
  }

  private toRequest(): LockAccessRequest {
    const { period, reason } = this.form.getRawValue();
    return {
      locks: this.chosenLocks().map((lock) => lock.id),
      start: toLocalIso(period.startDate, period.startTime),
      end: toLocalIso(period.endDate, period.endTime),
      reason: reason.trim(),
    };
  }

  /** Built from what was sent, not from the form, which the visitor may have changed meanwhile. */
  private toSent(request: LockAccessRequest): SentRequest {
    const moment = (value: string) => {
      const [date, time] = value.split('T');
      return `${formatDay(date, true)}, ${time}`;
    };
    return {
      locks: request.locks
        .map((id) => this.content.locks.find((lock) => lock.id === id)?.name ?? id)
        .join(', '),
      start: moment(request.start),
      end: moment(request.end),
      reason: request.reason,
      submittedAt: clubhouseNow().time,
    };
  }
}
