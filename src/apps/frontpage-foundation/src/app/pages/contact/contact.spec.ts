import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ContactMessageService } from '../../contact/contact-message.service';
import { Contact } from './contact';

describe('Contact', () => {
  const submit = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    submit.mockClear();
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: [provideRouter([]), { provide: ContactMessageService, useValue: { submit } }],
    }).compileComponents();
  });

  async function setup() {
    const fixture = TestBed.createComponent(Contact);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const setValue = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const submitForm = async () => {
      (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { element, setValue, submitForm };
  }

  it('does not show the e-mail address', async () => {
    const { element } = await setup();

    expect(element.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('shows required-field errors and does not submit an empty form', async () => {
    const { element, submitForm } = await setup();
    await submitForm();

    expect(element.querySelectorAll('.error').length).toBe(4);
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits a valid message and shows the success message', async () => {
    const { element, setValue, submitForm } = await setup();
    setValue('name', 'Jan Jansen');
    setValue('email', 'jan@example.nl');
    setValue('subject', 'viewing');
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
});
