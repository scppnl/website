import { HttpErrorResponse } from '@angular/common/http';
import {
  contactError,
  requiredText,
  trimmedEmail,
  trimmedMaxLength,
} from '../../contact/contact-validation';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactMessage, ContactSubject } from '../../contact/contact-message';
import { ContactMessageService } from '../../contact/contact-message.service';
import { contactPage } from '../../content/site-content';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { Photo } from '../../shared/photo/photo';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, PageHeader, RouterLink, Icon, Photo],
  styleUrl: './contact.scss',
  templateUrl: './contact.html',
})
export class Contact {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly contactService = inject(ContactMessageService);

  protected readonly available = this.contactService.available;

  protected readonly content = contactPage;
  protected readonly links = contactPage.links;
  protected readonly status = signal<SubmitStatus>('idle');

  protected readonly form = this.fb.group({
    name: ['', [requiredText, trimmedMaxLength(200)]],
    email: ['', [requiredText, trimmedEmail, trimmedMaxLength(254)]],
    phone: ['', trimmedMaxLength(50)],
    subject: [
      'question' as ContactSubject,
      (control: AbstractControl) =>
        ['question', 'viewing', 'other'].includes(control.value) ? null : { subject: true },
    ],
    message: ['', [requiredText, trimmedMaxLength(10000)]],
  });

  protected showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && control.touched;
  }

  protected errorMessage(controlName: string): string {
    return contactError(this.form.get(controlName));
  }

  protected async submit(): Promise<void> {
    if (!this.available || this.status() === 'submitting') return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const message = this.toMessage();
    this.status.set('submitting');
    this.form.disable();
    try {
      await this.contactService.submit(message);
      this.status.set('success');
      this.form.reset();
    } catch (error) {
      this.form.enable();
      if (error instanceof HttpErrorResponse && error.status === 400) {
        for (const key of Object.keys(error.error?.errors ?? {})) {
          const control = this.form.get(key);
          control?.setErrors({ server: true });
          control?.markAsTouched();
        }
      }
      this.status.set('error');
    } finally {
      if (this.form.disabled) this.form.enable();
    }
  }

  private toMessage(): ContactMessage {
    return this.form.getRawValue();
  }
}
