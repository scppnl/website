# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2026-11-21

### Added

- Group-based permissions. `Auth:Permissions` maps permission names to Google Workspace
  security groups; the API looks a user's groups up through the Cloud Identity Groups API as
  its own Cloud Run service account (scope `cloud-identity.groups.readonly`, role Groups
  Reader) and `GET /auth/session` returns the resulting `permissions`. Groups are looked up at
  sign-in and remembered for 10 minutes. Nothing changes without configured permissions: Google
  is not called and `permissions` is `[]`.

### Changed

- `GET /auth/session` answers `503` when the groups cannot be looked up, and the callback
  refuses the sign-in with `503`, instead of granting nothing silently.

## [0.0.2] - 2026-11-21

### Added

- `GET /auth/session` also returns the signed-in user's `name` (`null` when Google sent
  none), so the foundation site can show as whom you are signed in.
- `DELETE /auth/session` ends the session by deleting its cookie (`204`). It is
  idempotent and only accepts the `Origin` of `Auth:FrontendOrigin` (`403` otherwise).

### Changed

- Google is asked for the `profile` scope next to `openid email`; the name is kept in the
  session cookie.
- CORS allows `DELETE` as well as `GET` for the listed origins.
- Session cookies are version 2: sessions issued by 0.0.1 end once and the user signs in
  again.

## [0.0.1] - 2026-11-21

### Added

- Google Workspace sign-in for the foundation website's management area: authorization
  code flow with PKCE, `state` and `nonce` at `GET /auth/google`, finished at
  `GET /auth/google/callback`.
- Server-side ID token validation (RS256 signature from Google's JWKS, issuer, audience,
  authorized party, expiry, issue time, nonce and `email_verified`) and an exact domain
  check of both the `hd` claim and the email domain against a configured allow-list, with
  an optional per-email allow-list.
- A stateless, encrypted, HttpOnly, Secure, SameSite=Lax session cookie valid for eight
  hours, protected by a rotatable AES-256-GCM key ring, and `GET /auth/session` to read it.
- Redirects only to configured frontend URLs: `/inloggen/geen-toegang` for accounts that
  fail the access rules (without the email), `/inloggen` for failed or cancelled attempts
  and a configured post-sign-in page on success.
- Serilog logging through `ILogger<T>` with request completion events. Only the sign-in
  outcome is logged; codes, tokens, secrets, state, nonces and emails never are.
