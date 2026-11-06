import { Injectable } from '@angular/core';
import { ContactMessage } from './contact-message';

@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  /**
   * TODO: POST the message to the contact API once it exists. Until then nothing is sent,
   * so the site must not go live with this stub in place.
   */
  async submit(_message: ContactMessage): Promise<void> {
    console.warn('ContactMessageService: the contact API is not connected yet; nothing was sent.');
  }
}
