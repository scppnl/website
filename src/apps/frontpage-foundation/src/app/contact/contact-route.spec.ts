import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CONTACT_API_BASE_URL } from './contact-api-config';
import { turnstileProviders } from './turnstile-testing';
import { routes } from '../app.routes';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

const origin = 'https://contact-api-979979719406.europe-west4.run.app';

describe('foundation /contact page', () => {
  it('submits the routed form to Cloud Run with the foundation source', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
      provideHttpClient(),
        provideHttpClientTesting(),
        ...turnstileProviders(),
        { provide: CONTACT_API_BASE_URL, useValue: origin },
      ],
    });
    const harness = await RouterTestingHarness.create('/contact');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement!;
    const set = (name: string, value: string) => {
      const input = element.querySelector(`[formControlName="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('name', 'José');
    set('email', 'visitor@example.nl');
    set('message', 'Een vraag');
    set('phone', '0164 123456');
    const subject = element.querySelector('input[value="viewing"]') as HTMLInputElement;
    subject.checked = true;
    subject.dispatchEvent(new Event('change'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(`${origin}/contact`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(expect.objectContaining({
      source: 'foundation', name: 'José', email: 'visitor@example.nl', message: 'Een vraag', phone: '0164 123456', subject: 'viewing',
      turnstileToken: expect.any(String),
    }));
    expect(request.request.body).not.toHaveProperty('to');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();
    http.verify();
  });
});
