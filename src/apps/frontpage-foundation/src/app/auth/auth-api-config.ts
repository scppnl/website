import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

export const AUTH_API_BASE_URL = new InjectionToken<string>('AUTH_API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.authApiBaseUrl,
});
