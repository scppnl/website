import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BookingRequest } from './booking-request';
import { BOOKING_TURNSTILE_SITE_KEY } from './booking-turnstile';
import { BOOKING_API_BASE_URL, BookingRequestService } from './booking-request.service';

const request: BookingRequest = {
  name: 'Test Renter',
  organisation: 'Test Organisation',
  email: 'renter@example.org',
  phone: '0123456789',
  building: 'beide',
  groupType: 'family',
  date: '2027-03-13',
  dayparts: ['ochtend', 'middag'],
  guests: 30,
  remarks: 'Booking test',
};

describe('BookingRequestService', () => {
  let service: BookingRequestService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BOOKING_TURNSTILE_SITE_KEY, useValue: 'booking-key' },
        { provide: BOOKING_API_BASE_URL, useValue: 'https://booking.example.org/' },
      ],
    });
  });

  afterEach(() => http.verify());

  it('posts the exact payload to the configured host and waits for success', async () => {
    service = TestBed.inject(BookingRequestService);
    http = TestBed.inject(HttpTestingController);
    let resolved = false;
    const result = service.submit(request, 'fresh-token').then(() => {
      resolved = true;
    });
    const pending = http.expectOne('https://booking.example.org/bookings');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual({ ...request, turnstileToken: 'fresh-token' });
    expect(resolved).toBe(false);
    pending.flush(null, { status: 204, statusText: 'No Content' });
    await result;
    expect(resolved).toBe(true);
  });

  it.each([400, 403, 503, 500])('rejects HTTP %i responses', async (status) => {
    service = TestBed.inject(BookingRequestService);
    http = TestBed.inject(HttpTestingController);
    const result = expect(service.submit(request, 'fresh-token')).rejects.toMatchObject({ status });
    http
      .expectOne('https://booking.example.org/bookings')
      .flush({ errors: {} }, { status, statusText: 'Error' });
    await result;
  });

  it('rejects network failures', async () => {
    service = TestBed.inject(BookingRequestService);
    http = TestBed.inject(HttpTestingController);
    const result = expect(service.submit(request, 'fresh-token')).rejects.toMatchObject({ status: 0 });
    http.expectOne('https://booking.example.org/bookings').error(new ProgressEvent('error'));
    await result;
  });

  it('rejects an unconfigured host without sending a request', async () => {
    TestBed.overrideProvider(BOOKING_API_BASE_URL, { useValue: '  ' });
    service = TestBed.inject(BookingRequestService);
    http = TestBed.inject(HttpTestingController);
    await expect(service.submit(request, 'fresh-token')).rejects.toThrow('not configured');
    http.expectNone(() => true);
  });

  it('rejects a missing booking key without sending a request', async () => {
    TestBed.overrideProvider(BOOKING_TURNSTILE_SITE_KEY, { useValue: '' });
    service = TestBed.inject(BookingRequestService);
    http = TestBed.inject(HttpTestingController);
    expect(service.available).toBe(false);
    await expect(service.submit(request, 'fresh-token')).rejects.toThrow('not configured');
    http.expectNone(() => true);
  });
});
