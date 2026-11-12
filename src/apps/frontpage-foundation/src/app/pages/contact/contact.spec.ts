import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ContactMessageService } from '../../contact/contact-message.service';
import { Contact } from './contact';

describe('Contact', () => {
  const submit = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    submit.mockReset();
    submit.mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: [
        provideRouter([]),
        { provide: ContactMessageService, useValue: { submit, available: true } },
      ],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const setValue = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const choose = (value: string) => {
      (
        element.querySelector(`input[name="subject"][value="${value}"]`) as HTMLInputElement
      ).click();
    };
    const submitForm = async () => {
      (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { element, setValue, choose, submitForm };
  }

  it('does not show the e-mail address', async () => {
    const { element } = await setup();

    expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('offers the subjects as radio buttons with the rental question preselected', async () => {
    const { element } = await setup();
    const radios = Array.from(
      element.querySelectorAll<HTMLInputElement>('input[type="radio"][name="subject"]'),
    );

    expect(radios.map((radio) => radio.value)).toEqual(['question', 'viewing', 'other']);
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual([
      'question',
    ]);
    expect(element.querySelector('select')).toBeNull();
  });

  it('marks only the telephone number as optional', async () => {
    const { element } = await setup();

    expect(element.querySelector('label[for="phone"] .optional')?.textContent).toContain(
      'optioneel',
    );
    expect(element.querySelector('.contact-form__note')?.textContent).toContain(
      'Alle velden zijn verplicht, behalve telefoonnummer.',
    );
  });

  it('shows required-field errors and does not submit an empty form', async () => {
    const { element, submitForm } = await setup();
    await submitForm();

    expect(element.querySelectorAll('.error').length).toBe(3);
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits a valid message with the preselected subject', async () => {
    const { setValue, submitForm } = await setup();
    setValue('name', 'Jan Jansen');
    setValue('email', 'jan@example.nl');
    setValue('message', 'Wat kost het clubhuis?');
    await submitForm();

    expect(submit).toHaveBeenCalledExactlyOnceWith({
      name: 'Jan Jansen',
      email: 'jan@example.nl',
      phone: '',
      subject: 'question',
      message: 'Wat kost het clubhuis?',
    });
  });

  it('submits a valid message and shows the success message', async () => {
    const { element, setValue, choose, submitForm } = await setup();
    setValue('name', 'Jan Jansen');
    setValue('email', 'jan@example.nl');
    choose('viewing');
    setValue('message', 'Kunnen we het clubhuis komen bekijken?');
    await submitForm();

    expect(submit).toHaveBeenCalledExactlyOnceWith({
      name: 'Jan Jansen',
      email: 'jan@example.nl',
      phone: '',
      subject: 'viewing',
      message: 'Kunnen we het clubhuis komen bekijken?',
    });
    expect(element.querySelector('.alert--success')).toBeTruthy();
  });

  it('links to the location and booking pages', async () => {
    const { element } = await setup();
    const hrefs = Array.from(element.querySelectorAll<HTMLAnchorElement>('aside a')).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual(['/ligging', '/reserveren']);
  });
});
