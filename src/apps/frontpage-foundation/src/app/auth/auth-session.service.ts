import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_BASE_URL } from './auth-api-config';
import { AuthSession } from './auth-session';

/**
 * Reads and ends the session at the auth API. The session cookie is HttpOnly, so the page can only
 * ask the API whose session it is. That works only when the API and this site are the same site.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(AUTH_API_BASE_URL).trim().replace(/\/+$/, '');
  readonly available = this.baseUrl.length > 0;

  /** The signed-in user, or `null` when nobody is signed in or the API cannot be reached. */
  async current(): Promise<AuthSession | null> {
    if (!this.available) return null;
    try {
      return await firstValueFrom(
        this.http.get<AuthSession>(`${this.baseUrl}/auth/session`, { withCredentials: true }),
      );
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (!this.available) throw new Error('Auth API is not configured');
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/auth/session`, { withCredentials: true }),
    );
  }
}
