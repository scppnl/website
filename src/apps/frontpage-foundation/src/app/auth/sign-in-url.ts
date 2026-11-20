export interface SignInUrlOptions {
  /** Ask Google to show its account picker instead of reusing the current account. */
  readonly selectAccount?: boolean;
}

/** URL that starts the Google sign-in flow, or `null` while no auth API is configured. */
export function signInUrl(baseUrl: string, options: SignInUrlOptions = {}): string | null {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/auth/google${options.selectAccount ? '?prompt=select_account' : ''}`;
}
