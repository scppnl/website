/** The signed-in user, as returned by the auth API's `GET /auth/session`. */
export interface AuthSession {
  readonly email: string;
  /** Null when Google did not send a name. */
  readonly name: string | null;
  readonly expiresAt: string;
}
