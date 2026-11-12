import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ContactMessageService } from './contact-message.service';
import { CONTACT_API_BASE_URL } from './contact-api-config';

const message = {
  name: 'Jan',
  email: 'jan@example.nl',
  message: 'Hallo',
  phone: '',
  subject: 'question' as const,
};

describe('ContactMessageService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONTACT_API_BASE_URL, useValue: 'http://localhost:5081/' },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('posts the complete payload and fixed source, awaiting the response', async () => {
    let done = false;
    const pending = TestBed.inject(ContactMessageService)
      .submit(message)
      .then(() => {
        done = true;
      });
    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:5081/contact',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ ...message, source: 'foundation' });
    expect(done).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    expect(done).toBe(true);
  });

  it('rejects HTTP and network failures', async () => {
    for (const network of [false, true]) {
      const pending = TestBed.inject(ContactMessageService).submit(message);
      const assertion = expect(pending).rejects.toBeTruthy();
      const request = TestBed.inject(HttpTestingController).expectOne(
        'http://localhost:5081/contact',
      );
      if (network) request.error(new ProgressEvent('error'));
      else
        request.flush(
          { errors: { name: ['invalid'] } },
          { status: 400, statusText: 'Bad Request' },
        );
      await assertion;
    }
  });

  it('does not post when the API URL is unconfigured', async () => {
    TestBed.overrideProvider(CONTACT_API_BASE_URL, { useValue: '' });
    const service = TestBed.inject(ContactMessageService);
    expect(service.available).toBe(false);
    await expect(service.submit(message)).rejects.toThrow('not configured');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
