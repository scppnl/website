# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
