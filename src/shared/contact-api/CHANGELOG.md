# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2026-11-14

### Changed

- Reserve a fresh image version for the release selected by shared booking frontend
  activation tooling and CI changes. The contact API HTTP behavior is unchanged.

## [0.0.3] - 2026-11-12

### Changed

- Organize the contact API into API, Domain, Infrastructure and shared Models projects, with validation, service interfaces, submission orchestration and result models inside the API project and folders matching each responsibility.
- Introduced normalized submission and result models, injectable submission and verification services, and a logging destination while preserving the HTTP contract and Turnstile verification behavior.
- Moved submission logging to `Scpp.Shared.Contact.Infrastructure.Logging.LoggingContactSubmissionSink`; the message template and named properties are unchanged. Verification debug events now use the `Scpp.Shared.Contact.Infrastructure.Verification.TurnstileVerifier` category.
- Updated solution references, architecture documentation and tests for validation, verification and submission orchestration.

## [0.0.2] - 2026-11-12

### Changed

- Move the contact endpoint from `POST /api/contact` to `POST /contact`. The old route is no longer available.

## [0.0.1] - 2026-11-12

### Added

- Established application versioning and a changelog.
