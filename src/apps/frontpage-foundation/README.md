# Stichting Clubhuis De Wildert

Angular 22 with prerendered HTML and client hydration. Cloudflare Workers Static
Assets serves this site; Angular's server bootstrap runs only during the build.
There is no deployed JavaScript Worker or Express server.

## Development and validation

Use Node 24.22.1 (`nvm use` at the repository root; minimum 24.15) and npm 11.19.1.
From `src/apps/frontpage-foundation`:

```sh
npm ci
npm start
npm run build
npm run check:hosting
npm run preview -- --port 8788
```

`npm start` runs Angular's development server. `preview` builds, checks and serves the assets
through local Wrangler at `http://localhost:8788`; restart it after source changes.
`check:hosting` verifies every prerendered route, hydration markers, the root
`404.html`, Wrangler's static-only settings, and Workers Free asset limits.
`npm test -- --watch=false` runs the foundation unit tests.
The repository Nx `test` target builds first and includes these hosting checks.

## Cloudflare deployment

The committed `wrangler.json` names this Worker **`scpp-foundation`** and publishes only
`dist/frontpage-foundation/browser/`. The other site has its own Worker, build directory and deployment;
neither deployment overwrites the other. Both apps pin the same Wrangler release.

```sh
npx wrangler login
npm run build
npm run check:hosting
npx wrangler deploy --dry-run
npm run deploy
```

`deploy` rebuilds and checks the site before uploading. Authenticate with your own
Cloudflare account using Wrangler login or a scoped `CLOUDFLARE_API_TOKEN` in CI;
keep tokens out of the repository. GitHub Actions publishes affected websites
after checks pass on `main`; see the [repository deployment guide](../../../README.md#production-deployments)
for credentials, manual redeployment, verification and rollback.
The initial deployment can use its `workers.dev` address. To attach a production
hostname, add a **Custom Domain** to this Worker in the Cloudflare dashboard, or
commit the intended custom-domain `routes` configuration after confirming the
zone and hostname. Use a different domain for each site. Angular does not need a
hostname allowlist for prerendered static hosting.

The build preserves the Nx output location. Routes `/`, `/gebouw`, `/ligging`, `/tarieven`, `/reserveren`, `/contact` each have real HTML.
The `404` Angular route is copied to root `404.html` for Workers' `404-page`
handling, so unknown direct URLs return HTTP 404 with the site's own content.
Client navigation also renders the not-found component. `drop-trailing-slash`
redirects route URLs to the version without a trailing slash. Footer years
use the prerendered value during hydration and refresh to the visitor's local
date after hydration, so old builds remain current without a mismatch.
Static asset requests are free and unlimited on Workers, with no Worker CPU
execution here. The Free plan permits 20,000 files per deployment and 25 MiB per
file; `check:hosting` enforces those limits. See [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
and [limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets).

## Forms

The contact form validates inputs and posts through `ContactMessageService` to the
shared contact API. Accepted requests are currently logged, and the UI confirms
receipt after the API succeeds. Development builds use `http://localhost:5081`;
production submissions stay disabled until an API URL is configured. See the
[contact API guide](../../shared/contact-api/README.md) for startup and configuration.

The booking form posts to the .NET booking API and retains its existing validation,
success, and error presentation. Run the API in Development on port 5080 (see the
[booking API guide](../../foundation/booking-api/README.md)) alongside `npm start`.
The development build uses `http://localhost:5080`; the API allows the development
frontend origin `http://localhost:4200`.

Before a production build, set `BOOKING_API_BASE_URL` in the process environment
(repository Actions variable in CI) to the separately hosted API origin and configure
that API's `Cors:AllowedOrigins` with the frontend origin. An empty URL, the default
in production, rejects submission without sending a request. This configuration is
compiled into the static assets; changing it requires a rebuild.

The API validates and verifies requests, emails the rental team, and then logs a
receipt. HTTP 204 triggers the existing success state only after Gmail accepts the
notification. Email failures return 503, preserve entered values, and require a fresh
Turnstile token. A booking is still a request awaiting confirmation. Follow the
[Gmail rollout guide](../../foundation/booking-api/README.md#gmail-configuration-and-rollout)
and verify real delivery before setting the production URL. Clear the variable and
rebuild to disable submissions if email delivery fails persistently.

## Turnstile protection

Contact submissions require a current Turnstile token. Set the public site key
through the frontend process environment (`TURNSTILE_SITE_KEY`); CI reads it from
the GitHub repository secret `CONTACT_TURNSTILE_SITE_KEY`. Keep the hosted API origin in
`src/environments/environment.ts`. The `CONTACT_TURNSTILE_SECRET_KEY` verification
secret belongs only in the
.NET API runtime; it must never be supplied to the frontend build.

See the [contact API deployment/setup guide](../../shared/contact-api/README.md#turnstile-github-and-cloudflare-deployment-setup)
for Cloudflare widget creation, GitHub settings, the four production hostnames,
API runtime configuration, local development, and the deployment checklist.

Booking submissions use a separate widget with action `booking`. Set its public
key as `BOOKING_TURNSTILE_SITE_KEY` in the frontend process; CI reads the GitHub
repository secret with the same name. The matching `BOOKING_TURNSTILE_SECRET_KEY`
belongs only in the booking API runtime. Production foundation builds require
both contact and booking site keys. An absent booking URL or site key disables
submission while leaving the calculator usable. Verification resets after every
request and form values are preserved after failures.

See the [booking API setup guide](../../foundation/booking-api/README.md) for widget
creation, GitHub secrets, API configuration, development keys, and rollout order.
