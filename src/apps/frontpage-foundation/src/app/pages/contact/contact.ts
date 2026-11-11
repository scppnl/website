import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

  protected readonly content = contactPage;
  protected readonly links = contactPage.links;
  protected readonly status = signal<SubmitStatus>('idle');

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    subject: ['question' as ContactSubject],
    message: ['', Validators.required],
  });

  protected showError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && control.touched;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.status.set('submitting');
    try {
      await this.contactService.submit(this.toMessage());
      this.status.set('success');
      this.form.reset();
    } catch {
      this.status.set('error');
    }
  }

  private toMessage(): ContactMessage {
    return this.form.getRawValue();
  }
}
