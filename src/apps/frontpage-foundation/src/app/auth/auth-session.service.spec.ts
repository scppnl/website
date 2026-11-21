import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUTH_API_BASE_URL } from './auth-api-config';
import { AuthSessionService } from './auth-session.service';

const url = 'https://auth.example.nl/auth/session';
const session = { email: 'jan@scpp.nl', name: 'Jan Jansen', expiresAt: '2026-11-21T20:00:00Z' };

describe('AuthSessionService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTH_API_BASE_URL, useValue: 'https://auth.example.nl/' },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reads the session with credentials', async () => {
    const pending = TestBed.inject(AuthSessionService).current();
    const request = TestBed.inject(HttpTestingController).expectOne(url);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(session);

    expect(await pending).toEqual(session);
  });

  it('resolves null when nobody is signed in or the API cannot be reached', async () => {
    for (const network of [false, true]) {
      const pending = TestBed.inject(AuthSessionService).current();
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      if (network) request.error(new ProgressEvent('error'));
      else request.flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(await pending).toBeNull();
    }
  });

  it('does not call the API when it is not configured', async () => {
    TestBed.overrideProvider(AUTH_API_BASE_URL, { useValue: '' });
    const service = TestBed.inject(AuthSessionService);

    expect(service.available).toBe(false);
    expect(await service.current()).toBeNull();
    await expect(service.signOut()).rejects.toThrow('not configured');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('signs out with a credentialed DELETE', async () => {
    const pending = TestBed.inject(AuthSessionService).signOut();
    const request = TestBed.inject(HttpTestingController).expectOne(url);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects when signing out fails', async () => {
    for (const network of [false, true]) {
      const pending = TestBed.inject(AuthSessionService).signOut();
      const assertion = expect(pending).rejects.toBeTruthy();
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      if (network) request.error(new ProgressEvent('error'));
      else request.flush(null, { status: 403, statusText: 'Forbidden' });

      await assertion;
    }
  });
});
