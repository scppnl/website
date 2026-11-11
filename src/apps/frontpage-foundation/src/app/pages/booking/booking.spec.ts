import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BookingRequestService } from '../../booking/booking-request.service';
import { Booking } from './booking';

describe('Booking', () => {
  const submit = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    submit.mockClear();
    await TestBed.configureTestingModule({
      imports: [Booking],
      providers: [provideRouter([]), { provide: BookingRequestService, useValue: { submit } }],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(Booking);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const setValue = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const fillValidForm = () => {
      setValue('name', 'Jan Jansen');
      setValue('email', 'jan@example.nl');
      (element.querySelector('input[name="building"][value="beide"]') as HTMLInputElement).click();
      setValue('groupType', 'business');
      setValue('guests', '20');
      setValue('date', '2027-06-04');
      setValue('startTime', '10:00');
      setValue('endTime', '16:00');
      (element.querySelector('#acceptRules') as HTMLInputElement).click();
    };
    return { fixture, element, setValue, fillValidForm };
  }

  it('shows required-field errors and does not submit an empty form', async () => {
    const { fixture, element } = await setup();
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.querySelectorAll('.error').length).toBeGreaterThan(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it('requires a building choice', async () => {
    const { fixture, element, fillValidForm } = await setup();
    fillValidForm();
    const checked = element.querySelector('input[name="building"]:checked') as HTMLInputElement;
    expect(checked.value).toBe('beide');
    // A fresh form has no building selected, so the request cannot be submitted.
    const fresh = await setup();
    fresh.setValue('name', 'Jan Jansen');
    (fresh.element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fresh.fixture.whenStable();
    expect(fresh.element.textContent).toContain('Kies het gebouw dat u wilt huren.');
    expect(fresh.element.querySelector('input[name="building"]:checked')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    await fixture.whenStable();
  });

  it('rejects an end time before the start time', async () => {
    const { fixture, element, fillValidForm, setValue } = await setup();
    fillValidForm();
    setValue('endTime', '09:00');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.textContent).toContain('De eindtijd moet na de starttijd liggen.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects times outside the opening hours', async () => {
    const { fixture, element, fillValidForm, setValue } = await setup();
    fillValidForm();
    setValue('endTime', '23:30');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.textContent).toContain('Het clubhuis is te huur tussen');
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits a valid request and shows the success message', async () => {
    const { fixture, element, fillValidForm } = await setup();
    fillValidForm();
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0]).toMatchObject({
      name: 'Jan Jansen',
      building: 'beide',
      groupType: 'business',
      date: '2027-06-04',
      startTime: '10:00',
      endTime: '16:00',
      guests: 20,
    });
    expect(element.querySelector('.alert--success')).toBeTruthy();
  });
});
