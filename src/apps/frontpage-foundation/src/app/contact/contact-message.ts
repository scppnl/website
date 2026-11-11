export type ContactSubject = 'question' | 'viewing' | 'other';

export interface ContactMessage {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly subject: ContactSubject;
  readonly message: string;
}
