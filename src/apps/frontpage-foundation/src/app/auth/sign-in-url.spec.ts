import { signInUrl } from './sign-in-url';

describe('signInUrl', () => {
  it('returns null when no auth API is configured', () => {
    expect(signInUrl('')).toBeNull();
    expect(signInUrl('   ')).toBeNull();
  });

  it('points at the Google sign-in endpoint', () => {
    expect(signInUrl('https://auth.example.nl')).toBe('https://auth.example.nl/auth/google');
  });

  it('ignores trailing slashes', () => {
    expect(signInUrl('https://auth.example.nl//')).toBe('https://auth.example.nl/auth/google');
  });

  it('can ask for the account picker', () => {
    expect(signInUrl('https://auth.example.nl', { selectAccount: true })).toBe(
      'https://auth.example.nl/auth/google?prompt=select_account',
    );
  });
});
