import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Contact } from './contact';
import { CONTACT_API_BASE_URL } from '../../contact/contact-api-config';

const url = 'http://localhost:5081/api/contact';

describe('foundation contact submission', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Contact],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONTACT_API_BASE_URL, useValue: 'http://localhost:5081' },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function setup() {
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const set = (key: string, value: string) => {
      const input = element.querySelector(`[formControlName="${key}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = () => element.querySelector('form')!.dispatchEvent(new Event('submit'));
    const fill = () => {
      set('name', 'Jan');
      set('email', 'jan@example.nl');
      set('message', 'Hallo');
    };
    return { fixture, element, set, submit, fill, http: TestBed.inject(HttpTestingController) };
  }

  it('rejects empty, whitespace, invalid email and oversized fields locally', async () => {
    const { fixture, set, submit, fill, http, element } = await setup();
    submit();
    await fixture.whenStable();
    expect(element.querySelectorAll('.error').length).toBe(3);
    fill();
    set('name', '   ');
    submit();
    set('name', 'x'.repeat(201));
    submit();
    set('name', 'Jan');
    set('email', 'bad');
    submit();
    set('email', 'jan@example.nl');
    set('message', 'x'.repeat(10001));
    submit();
    http.expectNone(url);
  });

  it('posts once while pending and resets only after receipt', async () => {
    const { fixture, element, fill, submit, http } = await setup();
    fill();
    submit();
    submit();
    await fixture.whenStable();
    const request = http.expectOne(url);
    expect(request.request.body.source).toBe('foundation');
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((element.querySelector('[formControlName="name"]') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(element.textContent).not.toContain('bericht is ontvangen');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    await vi.waitFor(() => expect(element.textContent).toContain('bericht is ontvangen'));
    expect((element.querySelector('[formControlName="name"]') as HTMLInputElement).value).toBe('');
    expect((element.querySelector('input[value="question"]') as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('preserves input on failure and allows retry', async () => {
    const { fixture, element, fill, submit, http } = await setup();
    fill();
    submit();
    http.expectOne(url).error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
    expect((element.querySelector('[formControlName="name"]') as HTMLInputElement).value).toBe(
      'Jan',
    );
    submit();
    http.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    await vi.waitFor(() => expect(element.textContent).toContain('bericht is ontvangen'));
  });

  it('maps server field errors and submits again after correction', async () => {
    const { fixture, element, fill, set, submit, http } = await setup();
    fill();
    submit();
    http
      .expectOne(url)
      .flush({ errors: { name: ['invalid'] } }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(element.querySelector('[formControlName="name"]')!.getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(element.textContent).toContain('Controleer dit veld');
    submit();
    http.expectNone(url);
    set('name', 'Jan Jansen');
    submit();
    http.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    await vi.waitFor(() => expect(element.textContent).toContain('bericht is ontvangen'));
  });

  it('disables submissions when unconfigured', async () => {
    TestBed.overrideProvider(CONTACT_API_BASE_URL, { useValue: '' });
    const { fixture, element, fill, submit, http } = await setup();
    fill();
    submit();
    await fixture.whenStable();
    expect(element.textContent).toContain('tijdelijk niet beschikbaar');
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
    http.expectNone(url);
  });
});
