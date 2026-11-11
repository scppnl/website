# Scouting Petrus & Paulus

Dutch-language responsive website, built with Angular 22.2.0 and English source identifiers. Server-side rendering (SSR) with client hydration. There is no application backend, database, analytics, or form submission service.

## Development

From the repository root, enter `src/apps/frontpage-association`. Use Node.js 24 and npm.

```sh
npm ci
npm start
npm run build
npm run check:ssr
```

The build generates browser assets in `dist/client/` and an SSR Fetch handler in `dist/server/index.js`. Deploy browser assets and the SSR handler together using a compatible edge/Worker host; this is not a static-only build. The handler does not serve the static assets itself.

Configure the production hostname in `angular.json` under `security.allowedHosts` before deploying to another domain. The existing Sites hostname and local development hosts are retained. `npm run check:ssr` checks server-rendered HTML and hydration markers for all five routes.

The source includes the latest supplied scouting photographs. Sites account metadata and preview-only configuration are deliberately excluded from this repository copy.

## Forms

The contact and rental forms use native required-field/email validation. Submission is prevented and displays an explicit not-sent message. No information is transmitted or persisted. Replace this behavior only when a submission service is intentionally added.

## Content provenance

Content was retrieved from the exact user-provided Wayback pages:

- https://web.archive.org/web/20260516211624/https://scpp.nl/
- https://web.archive.org/web/20260617044726/https://scpp.nl/verhuur/
- https://www.facebook.com/scppnl/ (public search index; direct access restricted)

Age groups, three free introductory visits, founding year, rental facilities, rental restrictions, address, emergency telephone, and social links are taken from those archived pages. No rental prices or meeting times are invented. Older approximate membership counts were deliberately omitted. Reconfirm historical contact details and rental rules before a public launch.

The original logo and photos are retrieved from archived scpp.nl assets for this organization's redesign. Original paths: `/wp-content/uploads/2023/05/SCPP-logo-1.png`, `/wp-content/uploads/2023/10/Brug.png`, `/wp-content/uploads/2023/10/Blokhut.png`. The downloads page labels its documents as archived versions; their external availability depends on Wayback. Facebook is linked, not embedded, and no unverified recent posts are reproduced.
