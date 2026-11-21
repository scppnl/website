import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LockAccessRequestService } from '../../lock-access/lock-access-request.service';
import { LockAccess } from './lock-access';

/** Far enough ahead that the "not in the past" rule never trips these tests. */
const DAY = '2099-06-04';
const NEXT_DAY = '2099-06-05';

describe('LockAccess', () => {
  const submit = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    submit.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [LockAccess],
      providers: [provideRouter([]), { provide: LockAccessRequestService, useValue: { submit } }],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(LockAccess);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    const field = (selector: string) => element.querySelector(selector) as HTMLInputElement;
    const setValue = async (selector: string, value: string) => {
      const input = field(selector);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await stable();
    };
    const locks = () => Array.from(element.querySelectorAll<HTMLInputElement>('.lock input'));
    const toggleLock = async (index: number) => {
      locks()[index].click();
      await stable();
    };
    const setPeriod = async (start = '19:00', end = '21:30', date = DAY, endDate = date) => {
      await setValue('[formControlName="startDate"]', date);
      await setValue('[formControlName="startTime"]', start);
      await setValue('[formControlName="endDate"]', endDate);
      await setValue('[formControlName="endTime"]', end);
    };
    const fillValidForm = async () => {
      await toggleLock(2);
      await toggleLock(3);
      await setPeriod();
      await setValue('#reason', 'Tenten drogen en opbergen na het najaarskamp.');
    };
    const submitForm = async () => {
      (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await stable();
    };
    const click = async (text: string) => {
      const button = Array.from(element.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(text),
      ) as HTMLButtonElement;
      button.click();
      await stable();
    };
    const text = (selector: string) =>
      (element.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      fixture,
      element,
      field,
      locks,
      toggleLock,
      setValue,
      setPeriod,
      fillValidForm,
      submitForm,
      click,
      text,
    };
  }

  it('has a single h1 and no errors before the first submit', async () => {
    const { element } = await setup();

    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('.summary')).toBeNull();
    expect(element.querySelector('app-member-bar')).toBeTruthy();
  });

  it('lists every problem of an empty form and does not submit', async () => {
    const { element, submitForm, text } = await setup();
    await submitForm();

    expect(text('.summary__title')).toBe('Nog 4 dingen voor je kunt versturen');
    expect(element.querySelectorAll('.summary li').length).toBe(4);
    expect(text('#field-locks .error')).toBe('Kies minstens één slot.');
    expect(text('#field-start .error')).toBe('Vul een startdatum en starttijd in.');
    expect(text('#field-end .error')).toBe('Vul een einddatum en eindtijd in.');
    expect(text('#field-reason .error')).toBe('Vertel kort waarvoor je toegang nodig hebt.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('marks invalid fields and lets the summary links focus them', async () => {
    const { element, field, submitForm } = await setup();
    await submitForm();

    expect(field('[formControlName="startDate"]').getAttribute('aria-invalid')).toBe('true');
    expect(field('#reason').getAttribute('aria-invalid')).toBe('true');
    const link = element.querySelector('.summary li:last-child a') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(link.getAttribute('href')).toBe('/toegang-aanvragen#field-reason');
  });

  it('switches between choosing all locks and none', async () => {
    const { locks, click, text } = await setup();
    expect(text('.link-button')).toBe('Alle sloten kiezen');

    await click('Alle sloten kiezen');
    expect(locks().every((lock) => lock.checked)).toBe(true);
    expect(text('.link-button')).toBe('Alles deselecteren');

    await click('Alles deselecteren');
    expect(locks().some((lock) => lock.checked)).toBe(false);
  });

  it('refuses an end that is not after the start', async () => {
    const { toggleLock, setPeriod, setValue, submitForm, text } = await setup();
    await toggleLock(0);
    await setPeriod('21:30', '19:00');
    await setValue('#reason', 'Tenten drogen en opbergen.');
    await submitForm();

    expect(text('#field-end .error')).toBe('De eindtijd moet na de starttijd liggen.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('refuses a start in the past', async () => {
    const { toggleLock, setPeriod, setValue, submitForm, text } = await setup();
    await toggleLock(0);
    await setPeriod('08:00', '09:00', '2020-01-01');
    await setValue('#reason', 'Tenten drogen en opbergen.');
    await submitForm();

    expect(text('#field-start .error')).toBe('De starttijd ligt in het verleden.');
  });

  it('wants a reason of at least ten characters and counts them', async () => {
    const { toggleLock, setPeriod, setValue, submitForm, text } = await setup();
    await toggleLock(0);
    await setPeriod();
    await setValue('#reason', 'te kort');
    expect(text('.reason__count')).toBe('7 / 500');
    await submitForm();

    expect(text('#field-reason .error')).toBe('Vertel kort waarvoor je toegang nodig hebt.');
    expect(submit).not.toHaveBeenCalled();
  });

  it('moves the end date along with the start date', async () => {
    const { setValue, field } = await setup();
    await setValue('[formControlName="startDate"]', DAY);
    expect(field('[formControlName="endDate"]').value).toBe(DAY);

    await setValue('[formControlName="endDate"]', NEXT_DAY);
    await setValue('[formControlName="startDate"]', '2099-06-03');
    expect(field('[formControlName="endDate"]').value).toBe(NEXT_DAY);

    await setValue('[formControlName="startDate"]', '2099-06-10');
    expect(field('[formControlName="endDate"]').value).toBe('2099-06-10');
  });

  it('summarises the period once it is valid', async () => {
    const { setPeriod, text, element } = await setup();
    expect(element.querySelector('.period__summary')).toBeNull();

    await setPeriod();
    expect(text('.period__summary')).toBe('donderdag 4 juni, 19:00 – 21:30 · 2,5 uur');
  });

  it('submits the request, then shows what was sent', async () => {
    const { fillValidForm, submitForm, text, element } = await setup();
    await fillValidForm();
    await submitForm();

    expect(submit).toHaveBeenCalledWith({
      locks: ['magazijn-binnendeur', 'magazijn-buitendeur'],
      start: `${DAY}T19:00`,
      end: `${DAY}T21:30`,
      reason: 'Tenten drogen en opbergen na het najaarskamp.',
    });
    expect(element.querySelector('form')).toBeNull();
    expect(text('.sent h2')).toBe('Aanvraag verstuurd');
    const details = text('.sent__details');
    expect(details).toContain('Magazijn binnendeur, Magazijn buitendeur');
    expect(details).toContain('Tenten drogen en opbergen na het najaarskamp.');
    expect(text('.sent__status')).toContain('Openstaand');
    expect(text('.sent__status')).toContain('Ingediend vandaag om');
  });

  it('keeps the locks for a new period', async () => {
    const { fillValidForm, submitForm, click, locks, field, element } = await setup();
    await fillValidForm();
    await submitForm();
    await click('Zelfde sloten, andere periode');

    expect(element.querySelector('form')).toBeTruthy();
    expect(locks().map((lock) => lock.checked)).toEqual([false, false, true, true]);
    expect(field('[formControlName="startDate"]').value).toBe('');
    expect(field('#reason').value).toBe('');
    expect(element.querySelector('.summary')).toBeNull();
  });

  it('starts over with an empty form', async () => {
    const { fillValidForm, submitForm, click, locks, element } = await setup();
    await fillValidForm();
    await submitForm();
    await click('Nog een aanvraag indienen');

    expect(element.querySelector('form')).toBeTruthy();
    expect(locks().some((lock) => lock.checked)).toBe(false);
  });

  it('keeps the input and says so when sending fails', async () => {
    submit.mockRejectedValue(new Error('down'));
    const { fillValidForm, submitForm, element, field, text } = await setup();
    await fillValidForm();
    await submitForm();

    expect(text('.alert--error')).toBe('Het versturen is niet gelukt. Probeer het later opnieuw.');
    expect(element.querySelector('.sent')).toBeNull();
    expect(field('#reason').value).toBe('Tenten drogen en opbergen na het najaarskamp.');
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
