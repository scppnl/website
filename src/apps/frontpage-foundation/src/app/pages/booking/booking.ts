import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { currentDate } from '../../../current-date';
import {
  BookingRequest,
  BuildingChoice,
  DaypartId,
  GroupType,
} from '../../booking/booking-request';
import { BookingRequestService } from '../../booking/booking-request.service';
import { BOOKING_TURNSTILE_SITE_KEY } from '../../booking/booking-turnstile';
import { TurnstileWidget } from '../../contact/turnstile-widget';
import {
  bundleUpgrade,
  countLabel,
  daypartRanges,
  formatLongDate,
  formatShortDate,
  freeCancellationDeadline,
  parseIsoDate,
  quote,
} from '../../booking/price';
import {
  bookingPage,
  building,
  dayparts,
  formatEuro,
  ratesPage,
  rentalOptions,
} from '../../content/site-content';
import { CopyText } from '../../shared/copy/copy';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { PaymentTimeline } from './payment-timeline';
import { PriceBreakdown } from './price-breakdown';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

/** The price is per dagdeel, so at least one has to be chosen. */
function atLeastOneDaypart(group: AbstractControl): ValidationErrors | null {
  const chosen = Object.values(group.value as Record<string, boolean>).some(Boolean);
  return chosen ? null : { noDaypart: true };
}

@Component({
  selector: 'app-booking',
  imports: [
    TurnstileWidget,
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    Icon,
    CopyText,
    PriceBreakdown,
    PaymentTimeline,
  ],
  styleUrl: './booking.scss',
  templateUrl: './booking.html',
})
export class Booking {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly bookingService = inject(BookingRequestService);
  protected readonly available = this.bookingService.available;
  protected readonly bookingSitekey = inject(BOOKING_TURNSTILE_SITE_KEY);
  protected readonly turnstileToken = signal<string | null>(null);
  private readonly widget = viewChild(TurnstileWidget);
  private readonly sheet = viewChild<ElementRef<HTMLDialogElement>>('sheet');

  protected readonly content = bookingPage;
  protected readonly options = rentalOptions;
  protected readonly dayparts = dayparts;
  protected readonly countLabel = countLabel;
  protected readonly savingLabel = ratesPage.savingLabel;
  protected readonly formatEuro = formatEuro;
  protected readonly capacity = building.capacity;
  protected readonly today = currentDate();
  protected readonly status = signal<SubmitStatus>('idle');
  protected readonly breakdownOpen = signal(false);
  /** Errors for the dagdelen only show once the renter tried to submit. */
  private readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    organisation: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    building: ['' as BuildingChoice | '', Validators.required],
    groupType: ['' as GroupType | '', Validators.required],
    date: ['', [Validators.required, (control: AbstractControl) => this.pastDate(control)]],
    dayparts: this.fb.group(
      Object.fromEntries(dayparts.map((part) => [part.id, this.fb.control(false)])) as Record<
        DaypartId,
        FormControl<boolean>
      >,
      { validators: atLeastOneDaypart },
    ),
    guests: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(building.capacity)],
    ],
    remarks: [''],
    acceptRules: [false, Validators.requiredTrue],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  private readonly selectedDayparts = computed(() => {
    const chosen = this.value().dayparts;
    return dayparts.filter((part) => chosen[part.id]).map((part) => part.id);
  });

  /** `null` until a building and at least one dagdeel are chosen. */
  protected readonly price = computed(() => quote(this.value().building, this.selectedDayparts()));

  protected readonly ranges = computed(() => daypartRanges(this.selectedDayparts()));

  private readonly rentalDate = computed(() => parseIsoDate(this.value().date));

  /** `3 dagdelen op zaterdag 13 maart 2027 · 08:00 – 17:00` */
  protected readonly daypartSummary = computed(() => {
    const count = this.selectedDayparts().length;
    if (count === 0) {
      return '';
    }
    const date = this.rentalDate();
    return `${countLabel(count)}${date ? ` op ${formatLongDate(date)}` : ''} · ${this.ranges()}`;
  });

  /** `za 13 mrt 2027 · 08:00 – 17:00 · 30 personen` */
  protected readonly headerLine = computed(() => {
    const date = this.rentalDate();
    const guests = this.value().guests;
    const bits = [
      date ? formatShortDate(date) : '',
      this.ranges(),
      guests ? `${guests} personen` : '',
    ].filter(Boolean);
    return bits.length ? bits.join(' · ') : this.content.price.nothingChosen;
  });

  protected readonly cancelBy = computed(() => {
    const deadline = freeCancellationDeadline(this.value().date);
    return deadline ? formatLongDate(deadline) : null;
  });

  /** Extra cost per dagdeel of the whole clubhouse; only offered with a single building. */
  protected readonly upgrade = computed(() =>
    this.price() ? bundleUpgrade(this.value().building) : null,
  );

  protected readonly emptyHint = computed(() => {
    const { price } = this.content;
    if (this.value().building && this.selectedDayparts().length === 0) {
      return price.emptyDayparts;
    }
    return this.value().building === '' && this.selectedDayparts().length > 0
      ? price.emptyBuilding
      : price.emptyBoth;
  });

  protected readonly guestsTooMany = computed(() => (this.value().guests ?? 0) > building.capacity);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // The sheet is hidden on wide screens. A modal dialog that stays open there would keep the page inert.
    afterNextRender(() => {
      if (typeof matchMedia !== 'function') {
        return;
      }
      const wide = matchMedia('(min-width: 64rem)');
      const onChange = (event: MediaQueryListEvent) => event.matches && this.closeBreakdown();
      wide.addEventListener('change', onChange);
      destroyRef.onDestroy(() => wide.removeEventListener('change', onChange));
    });
  }

  protected showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && control.touched;
  }

  protected showDaypartsError(): boolean {
    return this.submitted() && this.form.controls.dayparts.invalid;
  }

  protected chooseBundle(): void {
    this.form.controls.building.setValue('beide');
  }

  protected openBreakdown(): void {
    const dialog = this.sheet()?.nativeElement;
    if (!dialog || dialog.open) {
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    this.breakdownOpen.set(true);
  }

  protected closeBreakdown(): void {
    const dialog = this.sheet()?.nativeElement;
    if (!dialog) {
      return;
    }
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    this.breakdownOpen.set(false);
  }

  /** A click on the dimmed backdrop lands on the dialog itself, not on its content. */
  protected onSheetClick(event: MouseEvent): void {
    if (event.target === this.sheet()?.nativeElement) {
      this.closeBreakdown();
    }
  }

  protected async submit(): Promise<void> {
    if (!this.available || this.status() === 'submitting') return;
    if (this.form.invalid) {
      this.submitted.set(true);
      this.form.markAllAsTouched();
      return;
    }

    const token = this.turnstileToken();
    if (!token) return;
    const request = this.toRequest();
    this.status.set('submitting');
    this.form.disable();
    try {
      await this.bookingService.submit(request, token);
      this.status.set('success');
      this.submitted.set(false);
      this.form.reset();
    } catch {
      this.status.set('error');
    } finally {
      this.turnstileToken.set(null);
      this.widget()?.reset();
      this.form.enable();
    }
  }

  private pastDate(control: AbstractControl): ValidationErrors | null {
    const date: string = control.value;
    return date && date < this.today().today ? { pastDate: true } : null;
  }

  private toRequest(): BookingRequest {
    const {
      acceptRules: _acceptRules,
      building: choice,
      groupType,
      guests,
      dayparts: chosen,
      ...rest
    } = this.form.getRawValue();
    return {
      ...rest,
      building: choice as BuildingChoice,
      groupType: groupType as GroupType,
      guests: guests as number,
      dayparts: dayparts.filter((part) => chosen[part.id]).map((part) => part.id),
    };
  }
}
