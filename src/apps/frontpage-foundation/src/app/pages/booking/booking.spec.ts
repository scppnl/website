import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BookingRequestService } from '../../booking/booking-request.service';
import { BOOKING_TURNSTILE_SITE_KEY } from '../../booking/booking-turnstile';
import { TurnstileLoader, WidgetOptions } from '../../contact/turnstile-loader';
import { Booking } from './booking';

/** Far enough ahead that the "not in the past" rule never trips these tests. */
const RENTAL_DATE = '2099-06-04';

describe('Booking', () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  let options: WidgetOptions;
  const api = {
    render: vi.fn((_element: HTMLElement, value: WidgetOptions) => {
      options = value;
      return 'booking-widget';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    submit.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [Booking],
      providers: [
        provideRouter([]),
        { provide: BookingRequestService, useValue: { submit, available: true } },
        { provide: BOOKING_TURNSTILE_SITE_KEY, useValue: 'booking-key' },
        { provide: TurnstileLoader, useValue: { load: async () => api } },
      ],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(Booking);
    await fixture.whenStable();
    options.callback('fresh-token');
    const element = fixture.nativeElement as HTMLElement;
    const setValue = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const chooseBuilding = (id: string) =>
      (element.querySelector(`input[name="building"][value="${id}"]`) as HTMLInputElement).click();
    /** The dagdelen in day order: 0 is ochtend, 1 is middag, 2 is avond. */
    const toggleDaypart = (index: number) =>
      (element.querySelectorAll('.daypart-card input')[index] as HTMLInputElement).click();
    const fillValidForm = () => {
      setValue('name', 'Jan Jansen');
      setValue('email', 'jan@example.nl');
      chooseBuilding('beide');
      setValue('groupType', 'business');
      setValue('guests', '20');
      setValue('date', RENTAL_DATE);
      toggleDaypart(0);
      toggleDaypart(1);
      (element.querySelector('#acceptRules') as HTMLInputElement).click();
    };
    const submitForm = async () => {
      (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    const text = (selector: string) =>
      (element.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      fixture,
      element,
      setValue,
      chooseBuilding,
      toggleDaypart,
      fillValidForm,
      submitForm,
      text,
    };
  }

  it('shows required-field errors and does not submit an empty form', async () => {
    const { element, submitForm } = await setup();
    await submitForm();

    expect(element.querySelectorAll('.error').length).toBeGreaterThan(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it('requires a building choice', async () => {
    const { element, setValue, submitForm } = await setup();
    setValue('name', 'Jan Jansen');
    await submitForm();

    expect(element.textContent).toContain('Kies het gebouw dat u wilt huren.');
    expect(element.querySelector('input[name="building"]:checked')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it('requires at least one dagdeel', async () => {
    const { element, fillValidForm, toggleDaypart, submitForm } = await setup();
    fillValidForm();
    toggleDaypart(0);
    toggleDaypart(1);
    await submitForm();

    expect(element.textContent).toContain('Kies minstens één dagdeel.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects a date in the past', async () => {
    const { element, fillValidForm, setValue, submitForm } = await setup();
    fillValidForm();
    setValue('date', '2001-01-01');
    await submitForm();

    expect(element.textContent).toContain('Kies een datum in de toekomst.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects more guests than the clubhouse holds', async () => {
    const { element, fillValidForm, setValue, submitForm } = await setup();
    fillValidForm();
    setValue('guests', '46');
    await submitForm();

    expect(element.textContent).toContain(
      'Er kunnen maximaal 45 personen tegelijk op het terrein.',
    );
    expect(submit).not.toHaveBeenCalled();
  });

  describe('price calculator', () => {
    it('asks for a building and a dagdeel before it shows a price', async () => {
      const { fixture, text, chooseBuilding, toggleDaypart } = await setup();
      expect(text('.summary__calc .price-total__amount')).toBe('€ –');
      expect(text('.summary__calc .price-hint')).toContain(
        'Kies een gebouw en minstens één dagdeel',
      );

      chooseBuilding('groot');
      await fixture.whenStable();
      expect(text('.summary__calc .price-hint')).toContain('Kies nog minstens één dagdeel');

      toggleDaypart(0);
      await fixture.whenStable();
      expect(text('.summary__calc .price-total__amount')).toBe('€ 75,00');
    });

    it('works out the rent, the deposit and the total while the renter chooses', async () => {
      const { fixture, text, chooseBuilding, toggleDaypart, setValue } = await setup();
      chooseBuilding('groot');
      setValue('date', RENTAL_DATE);
      toggleDaypart(0);
      toggleDaypart(1);
      await fixture.whenStable();

      const summary = text('.summary__calc');
      expect(text('.summary__calc .price-total__amount')).toBe('€ 150,00');
      expect(summary).toContain('2 dagdelen × € 75,00');
      expect(text('.summary__calc .price-row--muted')).toContain('Gas, water en elektra');
      expect(text('.summary__calc .price-row--muted')).toContain('inbegrepen');
      expect(text('.summary__calc .price-row--divided .price-row__label')).toContain(
        'krijgt u terug na oplevering',
      );
      expect(text('.summary__calc .price-row--divided .price-row__amount')).toBe('€ 250,00');
      expect(summary).toContain('U maakt in totaal € 400,00 over');
      expect(summary).toContain('08:00 – 17:00');
      expect(summary).toContain('Huur € 150,00');

      toggleDaypart(2);
      await fixture.whenStable();
      expect(text('.summary__calc .price-total__amount')).toBe('€ 225,00');
      expect(text('.summary__calc')).toContain('U maakt in totaal € 475,00 over');
      expect(text('.dayparts__summary')).toContain('3 dagdelen');
    });

    it('prices a single dagdeel in the singular', async () => {
      const { fixture, text, chooseBuilding, toggleDaypart } = await setup();
      chooseBuilding('terrein');
      toggleDaypart(2);
      await fixture.whenStable();

      expect(text('.summary__calc')).toContain('1 dagdeel × € 40,00');
      expect(text('.summary__calc .price-total__amount')).toBe('€ 40,00');
    });

    it('shows the same price in the total bar on phones', async () => {
      const { fixture, text, chooseBuilding, toggleDaypart } = await setup();
      expect(text('.total-bar__amount')).toBe('€ –');

      chooseBuilding('klein');
      toggleDaypart(0);
      toggleDaypart(1);
      await fixture.whenStable();

      expect(text('.total-bar__amount')).toBe('€ 90,00');
      expect(text('.total-bar__note')).toContain('+ € 250 borg (krijgt u terug)');
    });

    it('offers the whole clubhouse when a single building is chosen', async () => {
      const { fixture, element, text, chooseBuilding, toggleDaypart } = await setup();
      chooseBuilding('groot');
      toggleDaypart(0);
      await fixture.whenStable();

      expect(text('.summary__calc .price-note--upsell')).toContain('Voor € 25,00 meer per dagdeel');

      (element.querySelector('.summary__calc .link-button') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(
        (element.querySelector('input[name="building"]:checked') as HTMLInputElement).value,
      ).toBe('beide');
      expect(text('.summary__calc .price-total__amount')).toBe('€ 100,00');
      expect(element.querySelector('.summary__calc .price-note--upsell')).toBeNull();
    });

    it('shows the last day for free cancellation once a date is chosen', async () => {
      const { fixture, text, setValue } = await setup();
      expect(text('.summary__calc .cancel')).toBe('');

      setValue('date', RENTAL_DATE);
      await fixture.whenStable();

      // Four weeks before 4 June 2099.
      expect(text('.summary__calc .cancel')).toContain('Kosteloos annuleren tot en met');
      expect(text('.summary__calc .cancel')).toContain('7 mei 2099');
    });

    it('opens and closes the breakdown sheet', async () => {
      const { fixture, element, chooseBuilding, toggleDaypart } = await setup();
      chooseBuilding('beide');
      toggleDaypart(1);
      await fixture.whenStable();

      const dialog = element.querySelector('dialog.sheet') as HTMLDialogElement;
      const open = element.querySelector('.total-bar__button') as HTMLButtonElement;
      expect(dialog.open).toBe(false);
      expect(open.getAttribute('aria-expanded')).toBe('false');

      open.click();
      await fixture.whenStable();
      expect(dialog.open).toBe(true);
      expect(open.getAttribute('aria-expanded')).toBe('true');
      expect(dialog.textContent).toContain('U maakt in totaal € 350,00 over');

      (element.querySelector('.sheet__close') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(dialog.open).toBe(false);
      expect(open.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('submits a valid request and shows the success message', async () => {
    const { element, fillValidForm, submitForm } = await setup();
    fillValidForm();
    await submitForm();

    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0]).toMatchObject({
      name: 'Jan Jansen',
      building: 'beide',
      groupType: 'business',
      date: RENTAL_DATE,
      dayparts: ['ochtend', 'middag'],
      guests: 20,
    });
    expect(submit.mock.calls[0][0]).not.toHaveProperty('startTime');
    expect(submit.mock.calls[0][1]).toBe('fresh-token');
    expect(api.reset).toHaveBeenCalledWith('booking-widget');
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(element.querySelector('.alert--success')).toBeTruthy();
    expect(element.querySelector('.alert--success a[href="/contact"]')).toBeTruthy();
    expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('links to the contact page instead of showing an e-mail address', async () => {
    const { element } = await setup();

    expect(element.querySelector('.summary__notice a[href="/contact"]')).toBeTruthy();
    expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('links to the contact page when sending fails', async () => {
    submit.mockRejectedValueOnce(new Error('offline'));
    const { element, fillValidForm, submitForm } = await setup();
    fillValidForm();
    await submitForm();

    expect(element.querySelector('.alert--error a[href="/contact"]')).toBeTruthy();
    expect((element.querySelector('#name') as HTMLInputElement).value).toBe('Jan Jansen');
    expect(api.reset).toHaveBeenCalledWith('booking-widget');
    expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('requires a fresh token after expiration or a failed request', async () => {
    const { fixture, element, fillValidForm, submitForm } = await setup();
    fillValidForm();
    options['expired-callback']();
    await submitForm();
    expect(submit).not.toHaveBeenCalled();
    options.callback('first-token');
    submit.mockRejectedValueOnce(new Error('rejected'));
    await submitForm();
    await submitForm();
    expect(submit).toHaveBeenCalledTimes(1);
    options.callback('second-token');
    await fixture.whenStable();
    await submitForm();
    expect(submit).toHaveBeenLastCalledWith(expect.anything(), 'second-token');
    expect(element.querySelector('.alert--success')).toBeTruthy();
  });

  it('prevents duplicate submits while waiting for the API', async () => {
    let finish!: () => void;
    submit.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const { fixture, element, fillValidForm } = await setup();
    fillValidForm();
    const form = element.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    form.dispatchEvent(new Event('submit'));
    expect(submit).toHaveBeenCalledOnce();
    finish();
    await fixture.whenStable();
  });

  it('keeps the calculator usable when submissions are unavailable', async () => {
    TestBed.overrideProvider(BookingRequestService, { useValue: { submit, available: false } });
    const fixture = TestBed.createComponent(Booking);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('tijdelijk niet beschikbaar');
    expect(element.querySelector('app-turnstile')).toBeNull();
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    (element.querySelector('input[name="building"][value="groot"]') as HTMLInputElement).click();
    (element.querySelector('.daypart-card input') as HTMLInputElement).click();
    await fixture.whenStable();
    expect(element.querySelector('.summary__calc .price-total__amount')?.textContent).toContain('75,00');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(submit).not.toHaveBeenCalled();
  });
});
