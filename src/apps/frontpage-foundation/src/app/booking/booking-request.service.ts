import { Injectable } from '@angular/core';
import { BookingRequest } from './booking-request';

@Injectable({ providedIn: 'root' })
export class BookingRequestService {
  /**
   * TODO: POST the request to the booking API once it exists. Until then nothing is sent,
   * so the site must not go live with this stub in place.
   */
  async submit(_request: BookingRequest): Promise<void> {
    console.warn('BookingRequestService: the booking API is not connected yet; nothing was sent.');
  }
}
