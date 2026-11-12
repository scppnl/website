import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { BookingRequest } from './booking-request';
import { BOOKING_TURNSTILE_SITE_KEY } from './booking-turnstile';

export const BOOKING_API_BASE_URL = new InjectionToken<string>('Booking API base URL', {
  providedIn: 'root',
  factory: () => environment.bookingApiBaseUrl,
});

@Injectable({ providedIn: 'root' })
export class BookingRequestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BOOKING_API_BASE_URL);

  readonly available = this.baseUrl.trim().length > 0 && inject(BOOKING_TURNSTILE_SITE_KEY).length > 0;

  async submit(request: BookingRequest, turnstileToken: string): Promise<void> {
    const baseUrl = this.baseUrl.trim().replace(/\/+$/, '');
    if (!this.available) {
      throw new Error('The booking API base URL is not configured.');
    }
    await firstValueFrom(this.http.post<void>(`${baseUrl}/bookings`, { ...request, turnstileToken }));
  }
}
