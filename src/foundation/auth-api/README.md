# Foundation auth API

The .NET 10 Native AOT API behind the foundation website's **Inloggen met Google**
button. Google Workspace is the only identity provider; there are no local accounts. It
runs the OAuth authorization code flow with PKCE, validates the Google ID token on the
server, applies the domain rules and issues a short-lived session cookie. The API is for
the foundation site only (`blokhutdewildert.nl`); the association site is not a client.

## Endpoints

All paths are lowercase with no `/api` segment. `AUTH_API_BASE_URL` (frontend) is the
HTTPS origin of this API with no path.

| Method and path | Result | Status |
| --- | --- | --- |
| `GET /` | plain text `Auth API` (deployment smoke check) | 200 |
| `GET /auth/google` | sets the flow cookie, redirects to Google | 302 |
| `GET /auth/google?prompt=select_account` | same, forcing Google's account picker. No other `prompt` value, and nothing else from the query, is forwarded | 302 |
| `GET /auth/google` on a host other than `Auth:ApiOrigin` | redirects to `Auth:ApiOrigin/auth/google`, because the flow cookie is host-only | 302 |
| `GET /auth/google/callback` | success: session cookie, redirect to `Auth:FrontendOrigin` + `Auth:PostSignInPath` | 302 |
| | wrong domain, unverified email, or not on `Auth:AllowedEmails`: redirect to `/inloggen/geen-toegang` | 302 |
| | invalid, missing or expired flow cookie, state mismatch, Google `error` (such as cancel), rejected code or invalid ID token: redirect to `/inloggen` | 302 |
| | Google unreachable, timed out or answering unusably | 503 |
| `GET /auth/session` | `{"email":"…","expiresAt":"…"}` for a valid session | 200 |
| | no, invalid or expired session, or an account that is no longer allowed | 401 |

The no-access redirect never carries the email: the frontend page does not show which
account was used. There is no return-URL parameter. Every redirect target and the OAuth
`redirect_uri` come from configuration. Responses under `/auth` are `Cache-Control: no-store`;
the callback also sends `Referrer-Policy: no-referrer`.

There is no `POST /auth/sign-out` yet because no page can call it. Sessions last eight
hours, and signing in again (**Ander account kiezen**) replaces the session. Add sign-out,
with an `Origin` check, together with the first admin page that has a sign-out button.

## Sign-in and validation

1. `GET /auth/google` creates 32-byte random `state`, `nonce` and PKCE verifier, stores
   them in the encrypted flow cookie (10 minutes) and redirects to Google with
   `scope=openid email`, `code_challenge_method=S256` and the hint `hd=*`. The hint is not
   a check: Google's `hd` request parameter accepts one domain, so the server validates.
2. The callback requires the flow cookie and a `state` equal to the stored one
   (fixed-time comparison), then exchanges `code` with the client secret and PKCE
   verifier. The state is checked before anything else in the query. Without a matching
   flow, the request is sent to `/inloggen` and **no cookie is set or deleted**: another
   site can send a visitor to the callback (`SameSite=Lax` cookies travel on top-level
   navigations), and that must neither sign them out nor abort a sign-in in progress. After
   a matching state, the flow cookie is always cleared, and so is the session on any failure.
3. The ID token must have an RS256 signature from Google's cached JWKS (a refresh is
   requested once for an unknown key id), issuer `https://accounts.google.com` or
   `accounts.google.com`, audience equal to the client ID (and `azp`, when present), a
   valid `exp` and `iat` (one minute of clock skew), and the stored `nonce`.
4. `email_verified` must be true.
5. The `hd` claim **and** the email domain must each exactly equal an entry of
   `Auth:AllowedDomains`: ASCII only, a case-insensitive ordinal comparison, an email with
   exactly one `@`, and no suffix matching (`x.scpp.nl`, `evilscpp.nl` and look-alikes with
   non-ASCII letters fail). A
   Workspace with secondary domains reports its primary domain in `hd`, so the two values
   are checked separately, not against each other.
6. When `Auth:AllowedEmails` is not empty, the email must be listed (case-insensitive).

`GET /auth/session` repeats steps 5 and 6 on the stored values, so removing an address
from the allow-list ends its sessions at the next revision.

Failures log one event, `Google sign-in finished with {Outcome}`, where the outcome is
`Success`, `WrongDomain`, `NotAuthorized`, `EmailUnverified`, `InvalidState`,
`Cancelled`, `CodeRejected`, `InvalidToken` or `ProviderUnavailable`. Provider failures also log a
`FailureCategory` (network, timeout, provider error or invalid response). Codes, tokens,
secrets, state, nonces, cookies and email addresses are never logged by the API, and its
request logs record the path without its query string. That covers the API's own logs:
Cloud Run's platform request log records the full URL, including the callback's `code` and
`state`. They are single use and bound to the PKCE verifier and the browser's flow cookie,
so they are not usable on their own, but keep access to those logs limited.

## Session cookies

Both cookies are host-only (`__Host-` prefix, Secure, `Path=/`, no `Domain`), HttpOnly and
`SameSite=Lax`, which is what lets the flow cookie come back on Google's top-level redirect.
Their content is encrypted with AES-256-GCM
(`base64url(version, key id, nonce, ciphertext, tag)`) and the cookie name is
authenticated, so one cookie cannot be replayed as the other.

| Cookie | Lifetime | Content |
| --- | --- | --- |
| `__Host-scpp-auth-flow` | 10 minutes | state, nonce, PKCE verifier, creation time |
| `__Host-scpp-session` | 8 hours, not sliding | subject, email, `hd`, issue and expiry time |

The key ring is `AUTH_SESSION_KEYS`:

```json
{"activeKeyId":"2026-11","keys":{"2026-11":"<base64 of 32 random bytes>"}}
```

New cookies use the active key; every listed key still decrypts. To rotate, add a new
key, make it active, keep the old one, deploy a new revision (`latest` is read when a
revision starts) and remove the old key after eight hours. Replacing the whole ring ends
every session. Generate a key without echoing it, for example
`openssl rand -base64 32`, and put it only in Secret Manager.

## Configuration

Settings are required at startup in every environment; the host does not start with
invalid values.

| Setting | Source | Rule |
| --- | --- | --- |
| `AUTH_GOOGLE_CLIENT_SECRET` | Secret Manager `auth-google-client-secret` | required |
| `AUTH_SESSION_KEYS` | Secret Manager `auth-session-keys` | required key ring, 32-byte keys |
| `Auth__Google__ClientId` | Cloud Run env | must end in `.apps.googleusercontent.com` |
| `Auth__ApiOrigin` | Cloud Run env | this API's HTTPS origin, no path |
| `Auth__FrontendOrigin` | Cloud Run env | the foundation site's HTTPS origin, no path |
| `Auth__PostSignInPath` | Cloud Run env | a local path, default `/`; `/beheer` once that page exists |
| `Auth__AllowedDomains__0..n` | Cloud Run env | `scpp.nl`, `blokhutdewildert.nl`; exact hostnames, no wildcards |
| `Auth__AllowedEmails__0..n` | Cloud Run env | optional; empty allows every account in the allowed domains |
| `Cors__AllowedOrigins__0..n` | Cloud Run env | explicit origins; must include `Auth:FrontendOrigin`; no `*` |

Origins must be `https` and not loopback outside Development. `/inloggen` and
`/inloggen/geen-toegang` are fixed: they are the frontend's contract. CORS allows `GET`
with credentials for the listed origins only.

## Google client setup (administrator, once)

1. In the **De Wildert / P&P APIs** OAuth app (an **Internal** app, which only admits
   accounts of this Workspace; `blokhutdewildert.nl` is a secondary domain of `scpp.nl`),
   create a **Web application** client for sign-in. The scopes are `openid` and `email`
   only, which need no verification. Gmail scopes belong to the mailbox clients, not this one.
2. Add the authorized redirect URIs for the hosts you use:
   - `https://auth-api-979979719406.europe-west4.run.app/auth/google/callback`
   - later `https://auth.blokhutdewildert.nl/auth/google/callback`
3. Create a separate client for development with redirect URI
   `http://localhost:5082/auth/google/callback`.
4. Store the client secret and a generated key ring in Secret Manager. Use the
   operator's Google Cloud account, keep the values out of command arguments, chat,
   GitHub, images and Terraform state, and delete local files afterwards. In PowerShell:

   ```powershell
   gcloud auth login
   gcloud secrets versions add auth-google-client-secret --project=websites-514515 --data-file="C:\secure\auth-google-client-secret.txt"
   gcloud secrets versions add auth-session-keys --project=websites-514515 --data-file="C:\secure\auth-session-keys.json"
   gcloud secrets versions list auth-session-keys --project=websites-514515 --filter="state=ENABLED" --format="table(name,state,createTime)"
   ```

With an Internal app, Google itself stops accounts outside the Workspace before the
callback runs, so they see Google's error page rather than `/inloggen/geen-toegang`. The
server checks still apply and are tested on their own. The no-access page appears for
Workspace accounts that fail them: an address not on `Auth:AllowedEmails`, an unverified
email, or a domain added to the Workspace but not to `Auth:AllowedDomains`. Using an
**External** production app would send every outside account to the no-access page, but
lets anyone attempt sign-in; Internal is the recommended setting.

## Hosting and rollout

Terraform (`infra/production/auth.tf`) owns the two secret containers. The Cloud Run
service itself is added only after the OAuth client exists, because its client ID is a
configuration value. Merge in this order, so production is never asked to attach an empty
secret or to deploy to a service that does not exist:

1. **Infrastructure containers.** The Cloud Run module's Turnstile secret is now optional
   (the auth API has no Turnstile) and `auth.tf` adds the secret containers. The module's
   `moved` blocks only re-address the existing contact and booking secret resources:
   the plan of this change must show moves and the two new containers, with no destroy or
   replacement. Review the pull request's plan before approving.
2. **Operator steps** above: OAuth client, secret values, Docker Hub repository
   `scppnl/auth-api` (see the root README's publication section).
3. **Infrastructure service.** Add this entry to `local.apis` in `infra/production/apis.tf`
   with the real client ID, apply it (the first image is only a placeholder; CI replaces it):

   ```hcl
   "auth-api" = {
     additional_env = {
       Auth__Google__ClientId  = "<client id>.apps.googleusercontent.com"
       Auth__ApiOrigin         = "https://auth-api-979979719406.europe-west4.run.app"
       Auth__FrontendOrigin    = "https://scpp-foundation.de-wildert-penp.workers.dev"
       Auth__PostSignInPath    = "/"
       Auth__AllowedDomains__0 = "scpp.nl"
       Auth__AllowedDomains__1 = "blokhutdewildert.nl"
     }
     additional_secrets = {
       AUTH_GOOGLE_CLIENT_SECRET = google_secret_manager_secret.auth_google_client_secret.secret_id
       AUTH_SESSION_KEYS         = google_secret_manager_secret.auth_session_keys.secret_id
     }
     image = "us-docker.pkg.dev/cloudrun/container/hello"
     cors_allowed_origins = [
       "https://scpp-foundation.de-wildert-penp.workers.dev",
       "https://blokhutdewildert.nl",
     ]
   }
   ```

4. **Application.** Merging this component publishes `scppnl/auth-api:<Version>` and CI
   deploys the verified digest to the existing service; the smoke check expects
   `GET /` to return `Auth API`. Merging it before step 3 fails only the deployment job,
   because CI never creates services.

### Which URL to use

- **Development URLs work for the flow.** The Cloud Run URL and the foundation Worker
  URL can drive the whole sign-in, the domain check and the redirect to
  `/inloggen/geen-toegang`: each step is a top-level navigation. Open
  `<api>/auth/session` directly in the browser to see the session.
- **They cannot serve the session to the frontend.** `run.app` and `workers.dev` are on
  the Public Suffix List, so the API and the site are different sites and the `Lax`
  cookie is not sent on a `fetch` from the frontend. `SameSite=None` would rely on
  third-party cookies, which Safari and Firefox block (and Chrome can too), so it is not used.
- **Before any admin page reads the session,** serve the API from a hostname on the same
  registrable domain as the site, such as `auth.blokhutdewildert.nl`: add a Cloud Run
  domain mapping (a DNS-only `auth` CNAME to `ghs.googlehosted.com` in Cloudflare; domain
  mappings have limited availability, so confirm europe-west4 support and domain
  ownership first; a global external load balancer with a serverless NEG is the fallback),
  add its redirect URI to the Google client, set `Auth__ApiOrigin` and
  `AUTH_API_BASE_URL` to it, switch `Auth__FrontendOrigin` from the foundation Worker URL
  to `https://blokhutdewildert.nl` once that domain is live, and set `Auth__PostSignInPath`
  to `/beheer` when that page exists.

### Enabling the button

After the API is deployed and a sign-in has been verified end to end, set repository
**Actions variable** `AUTH_API_BASE_URL` to the API origin (HTTPS, no path), for example
`https://auth-api-979979719406.europe-west4.run.app` first and
`https://auth.blokhutdewildert.nl` later. A variable change starts no build: run
**CI → Run workflow → main** with **sites_only** enabled to rebuild and deploy the website.
Until then the button is disabled with an "Inloggen is tijdelijk niet beschikbaar" notice.

```powershell
gh workflow run ci.yml --repo=scppnl/website --ref=main -f sites_only=true
```

Verify, from the live site, with an allowed account (lands on the post-sign-in page, and
`/auth/session` returns the email), with **Ander account kiezen**, and with an account
outside the Workspace.

## Local development

Run the API with the development client and a local key ring injected as environment
variables, never as files in the checkout:

```sh
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/foundation/auth-api/src/Scpp.Foundation.Auth.Api -- --urls http://localhost:5082
```

with `AUTH_GOOGLE_CLIENT_SECRET`, `AUTH_SESSION_KEYS` and `Auth__Google__ClientId` set.
`appsettings.Development.json` sets the API origin `http://localhost:5082`, the frontend
`http://localhost:4200`, the post-sign-in path `/` and the allowed domains. `localhost`
on different ports is one site, so `fetch('http://localhost:5082/auth/session', { credentials: 'include' })`
works from the frontend. Cookies are always Secure: Chrome and Firefox accept them on
`http://localhost`; Safari does not, so use another browser for local sign-in.

## Tests and build quality

`npm run nx -- run auth-api:test` builds in Release, where warnings are errors, and runs
the MSTest suite. It stubs all Google endpoints (discovery, JWKS and the token endpoint),
so no credentials or network are needed. It covers a valid sign-in, wrong domains and
look-alike domains, tampered, missing, expired and replayed state and cookies, tampered nonce,
expired, forged, unsigned and mismatched tokens, unverified emails, the email allow-list, Google
failures, sessions (expiry, tampering, key rotation, CORS), startup validation, and logging
that never contains secrets.

`npm run nx -- run auth-api:docker` publishes the Native AOT executable with no trimming
or AOT warnings and builds the image. The host avoids ASP.NET's OpenID Connect and cookie
authentication handlers, which are not AOT-compatible or need a persisted key ring.

## Failures and rollback

On `503` the user can simply try again. Persistent provider failures show up as
`ProviderUnavailable` events with a `FailureCategory`. A bad secret or setting stops the
revision from starting; fix the secret or Terraform value and deploy a new revision.

To switch sign-in off, clear `AUTH_API_BASE_URL` and run the websites-only workflow;
the button is disabled again. To undo an API deployment, move traffic to an earlier
revision as described in the root README's Cloud Run section.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[OAuth for server-side web apps](https://developers.google.com/identity/protocols/oauth2/web-server)
and [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636).
