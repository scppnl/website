# Scouting Petrus & Paulus

Angular 22 with prerendered HTML and client hydration. Cloudflare Workers Static
Assets serves this site; Angular's server bootstrap runs only during the build.
There is no deployed JavaScript Worker or Express server.

## Development and validation

Use Node 24.22.1 (`nvm use` at the repository root; minimum 24.15) and npm 11.19.1.
From `src/apps/frontpage-association`:

```sh
npm ci
npm start
npm run build
npm run check:hosting
npm run preview -- --port 8787
```

`npm start` runs Angular's development server. `preview` builds, checks and serves the assets
through local Wrangler at `http://localhost:8787`; restart it after source changes.
`check:hosting` verifies every prerendered route, hydration markers, the root
`404.html`, Wrangler's static-only settings, and Workers Free asset limits.
`npm run check:ssr` remains a compatibility alias for `check:hosting`.
The repository Nx `test` target builds first and includes these hosting checks.

## Cloudflare deployment

The committed `wrangler.json` names this Worker **`scpp-association`** and publishes only
`dist/client/`. The other site has its own Worker, build directory and deployment;
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

The build preserves the Nx output location. Routes `/`, `/speltakken`, `/verhuur`, `/contact`, `/downloads` each have real HTML.
The `404` Angular route is copied to root `404.html` for Workers' `404-page`
handling, so unknown direct URLs return HTTP 404 with the site's own content.
Client navigation also renders the not-found component. `drop-trailing-slash`
redirects route URLs to the version without a trailing slash. Footer years and the rental date minimum
use the prerendered value during hydration and refresh to the visitor's local
date after hydration, so old builds remain current without a mismatch.
Static asset requests are free and unlimited on Workers, with no Worker CPU
execution here. The Free plan permits 20,000 files per deployment and 25 MiB per
file; `check:hosting` enforces those limits. See [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
and [limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets).

## Forms


The contact and rental forms use native required-field/email validation. Submission is prevented and displays an explicit not-sent message. No information is transmitted or persisted. Replace this behavior only when a submission service is intentionally added.

## Content provenance

Content was retrieved from the exact user-provided Wayback pages:

- https://web.archive.org/web/20260516211624/https://scpp.nl/
- https://web.archive.org/web/20260617044726/https://scpp.nl/verhuur/
- https://www.facebook.com/scppnl/ (public search index; direct access restricted)

Age groups, three free introductory visits, founding year, rental facilities, rental restrictions, address, emergency telephone, and social links are taken from those archived pages. No rental prices or meeting times are invented. Older approximate membership counts were deliberately omitted. Reconfirm historical contact details and rental rules before a public launch.

The original logo and photos are retrieved from archived scpp.nl assets for this organization's redesign. Original paths: `/wp-content/uploads/2023/05/SCPP-logo-1.png`, `/wp-content/uploads/2023/10/Brug.png`, `/wp-content/uploads/2023/10/Blokhut.png`. The downloads page labels its documents as archived versions; their external availability depends on Wayback. Facebook is linked, not embedded, and no unverified recent posts are reproduced.
