# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2026-11-14

### Added

- Send validated, Turnstile-verified booking requests from `noreply@scpp.nl` to
  `verhuur@scpp.nl` through Gmail API OAuth, with the applicant in Reply-To.
- Cache and refresh access tokens, enforce an email deadline, and return `503`
  without a successful receipt when delivery is unavailable.
- Add Secret Manager runtime configuration and staged production form activation
  through the public `BOOKING_API_BASE_URL` build setting.

## [0.0.3] - 2026-11-12

### Added

- Require booking Turnstile tokens with server-side action and hostname checks,
  startup configuration validation, and token-free receipt logging.

## [0.0.2] - 2026-11-12

### Changed

- Move the booking endpoint from `POST /api/bookings` to `POST /bookings`. The old route is no longer available.

## [0.0.1] - 2026-11-12

### Added

- Established application versioning and a changelog.
