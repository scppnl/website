# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Protect booking submissions with a separate Turnstile widget and fresh-token
  retries; preserve form input on failure and keep pricing usable when unavailable.

### Removed

- Remove the deposit (borg) from the rates page, price calculation, total bar and
  payment timeline; the rent is the full amount.

## [0.0.2] - 2026-11-12

### Changed

- Submit contact requests to `/contact` and booking requests to `/bookings`, removing the `/api` prefix from both API paths.

## [0.0.1] - 2026-11-12

### Added

- Established application versioning and a changelog.
