import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { BookingRequest, GroupType } from '../../booking/booking-request';
import { BookingRequestService } from '../../booking/booking-request.service';
import { bookingPage, building, foundation } from '../../content/site-content';
import { PageHeader } from '../../shared/page-header/page-header';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

/** The rental is a single day: the end time has to be after the start time and both within opening hours. */
function timeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start: string = group.get('startTime')?.value;
  const end: string = group.get('endTime')?.value;
  if (!start || !end) {
    return null;
  }
  if (end <= start) {
    return { timeOrder: true };
  }
  if (start < building.earliestStart || end > building.latestEnd) {
    return { openingHours: true };
  }
  return null;
}

@Component({
  selector: 'app-booking',
  imports: [ReactiveFormsModule, PageHeader],
  styleUrl: './booking.scss',
  templateUrl: './booking.html',
})
export class Booking {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly bookingService = inject(BookingRequestService);

  protected readonly content = bookingPage;
  protected readonly foundation = foundation;
  protected readonly capacity = building.capacity;
  protected readonly earliestStart = building.earliestStart;
  protected readonly latestEnd = building.latestEnd;
  protected readonly status = signal<SubmitStatus>('idle');

  protected readonly form = this.fb.group(
    {
      name: ['', Validators.required],
      organisation: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      groupType: ['' as GroupType | '', Validators.required],
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      guests: [
        null as number | null,
        [Validators.required, Validators.min(1), Validators.max(building.capacity)],
      ],
      remarks: [''],
      acceptRules: [false, Validators.requiredTrue],
    },
    { validators: timeRangeValidator },
  );

  protected showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && control.touched;
  }

  protected timeRangeError(): 'timeOrder' | 'openingHours' | null {
    if (!this.form.get('endTime')?.touched) {
      return null;
    }
    if (this.form.hasError('timeOrder')) {
      return 'timeOrder';
    }
    return this.form.hasError('openingHours') ? 'openingHours' : null;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.status.set('submitting');
    try {
      await this.bookingService.submit(this.toRequest());
      this.status.set('success');
      this.form.reset();
    } catch {
      this.status.set('error');
    }
  }

  private toRequest(): BookingRequest {
    const { acceptRules: _acceptRules, groupType, guests, ...rest } = this.form.getRawValue();
    return { ...rest, groupType: groupType as GroupType, guests: guests as number };
  }
}
