# Contact API

The .NET 10 minimal API accepts contact requests from both frontends. It currently
validates and logs normalized contact fields through structured console
logging, using Serilog through Microsoft `ILogger<T>` with readable console output.
An additional request completion event records method, path, status, and duration.
It does not send email or persist requests. Logs contain submitted names,
email addresses and message text. A successful response confirms receipt only.

## Structure

The component uses separate .NET projects with these responsibilities:

| Project | Responsibility | Project dependencies |
| --- | --- | --- |
| `Scpp.Shared.Contact.Api` | HTTP endpoints, validation, submission orchestration, result models, service interfaces, JSON serialization and host configuration | Domain, Infrastructure, Models |
| `Scpp.Shared.Contact.Models` | Public `ContactRequest` JSON contract | None |
| `Scpp.Shared.Contact.Domain` | Immutable normalized `ContactSubmission` model | None |
| `Scpp.Shared.Contact.Infrastructure` | Turnstile Siteverify client and structured logging submission destination | Domain |

Within the API, `Endpoints`, `Serialization` and `Configuration` separate HTTP
handling from host configuration. The API also owns `Interfaces`, `Services`,
`Models`, `Validation` and `Verification`; Domain owns submission `Models`, and
Infrastructure owns `Logging`, `Verification` and its provider JSON `Serialization`.
All projects live under `src/` and belong to both the component and repository solutions.

`ContactApi.Build` is the composition root. It registers scoped
`IContactSubmissionService` and `IContactSubmissionSink` implementations.
The endpoint passes the request, trace identifier and request cancellation token
to the submission service. Validation produces either field errors or a normalized
domain submission. The submission service verifies valid requests through
`IContactVerificationService`; only accepted submissions reach the sink. The endpoint
maps validation errors to `400`, rejected verification to `403`, unavailable
verification to `503`, and returns `204` after the sink completes.
Unexpected sink failures propagate to the existing server error handling.
The API's service adapters connect its interfaces to concrete Infrastructure
implementations. Infrastructure references Domain only and never references the API.

Submission events use the logger category
`Scpp.Shared.Contact.Infrastructure.Logging.LoggingContactSubmissionSink`.
The message template and named properties retain the established submission log
contract. Serilog configuration and request completion logging stay in the API host;
the sink uses Microsoft `ILogger<T>`. Verification debug events use
`Scpp.Shared.Contact.Infrastructure.Verification.TurnstileVerifier`. Tokens stay in
the request contract and verification flow and are excluded from the domain submission
and submission logs. Turnstile settings validation remains in the API configuration.

## Local development

From the repository root, with the SDK selected by `global.json`:

```sh
DOTNET_ENVIRONMENT=Development dotnet run --project src/shared/contact-api/src/Scpp.Shared.Contact.Api -- --urls http://localhost:5081
```

The API now requires Turnstile settings at startup, including in Development.
Create a separate development widget (see below), then configure its secret through
your local secret manager or environment as `CONTACT_TURNSTILE_SECRET_KEY`. Set
`Turnstile__AllowedHostnames__0=localhost` and optionally index `1` to `127.0.0.1`.
Do not put real secrets in committed appsettings or shell command arguments.

Development CORS permits `http://localhost` on ports 4173, 4200, 8787 and 8788.
Start either frontend with its `npm start`; the development build connects to
`http://localhost:5081`. For a static Wrangler preview against this API, first
build with `npm run build -- --configuration development`, then run
`npx wrangler dev --port 8787` (association) or `--port 8788` (foundation).
Do not use the `preview` script for this: it rebuilds the production configuration.

```sh
curl -i http://localhost:5081/contact \
  -H 'Content-Type: application/json' \
  -d '{"source":"association","name":"Jan","email":"jan@example.nl","childName":"Piet","message":"Kunnen we kennismaken?","turnstileToken":"<fresh-token>"}'
curl -i http://localhost:5081/contact \
  -H 'Content-Type: application/json' \
  -d '{"source":"foundation","name":"Jan","email":"jan@example.nl","phone":"","subject":"viewing","message":"Kunnen we het clubhuis bekijken?","turnstileToken":"<fresh-token>"}'
```

## Contract

`GET /` returns the existing plain-text identity. `POST /contact` accepts JSON:

| Field | Validation |
| --- | --- |
| `turnstileToken` | Required, nonblank, at most 2,048 characters; obtain a fresh token from the widget for each attempt |
| `source` | Required: `association` or `foundation` |
| `name` | Required, at most 200 characters |
| `email` | Required email address, at most 254 characters |
| `message` | Required, at most 10,000 characters |
| `childName` | Optional association form field, at most 200 characters |
| `phone` | Optional foundation form field, at most 50 characters |
| `subject` | Required for foundation: `question`, `viewing`, `other`; omitted for association |

Surrounding whitespace is trimmed before validation and logging. Whitespace-only
required fields are rejected; blank optional fields become null. Internal message
formatting is preserved. After field validation, the API calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
It requires `success: true`, action `contact`, and an exact configured frontend
hostname match before accepting the request. Accepted requests produce one structured log entry with
all contact fields (excluding the verification token), UTC timestamp and trace identifier, then return `204 No Content`.
Invalid fields return `400 application/problem+json` with an `errors` dictionary
keyed by camelCase field names. Malformed JSON returns `400`; unsupported content
types return `415`. Failed verification (including wrong hostname/action or expired/reused tokens)
returns `403 application/problem+json`. Verification network failures, timeouts
(10 seconds), non-success HTTP responses, and malformed responses return `503`.
Verification does not automatically retry. Rejected request bodies and verification
tokens are not logged. Verification outcome categories are available at Debug level
in the contact handler logs. Cancellation propagates to the verification request.

## Production configuration

The production API runs on Cloud Run at
`https://contact-api-979979719406.europe-west4.run.app`; `GET /` returns HTTP 200
with `Contact API`, and the submission endpoint is `POST /contact`.
Both frontends use an injectable
`CONTACT_API_BASE_URL`, whose default is their Angular environment's
`contactApiBaseUrl`. Configuring a frontend to use this service is a separate
change: set its API base URL to the HTTPS origin above (without `/contact`) and
rebuild. Submissions then reach that origin's `/contact` endpoint. The development replacement
is `environment.development.ts`. The public Turnstile site key is supplied at build time as `TURNSTILE_SITE_KEY`.
A Worker runtime variable cannot configure these static Angular assets.
Production defaults to an empty API URL; the forms
show an unavailable notice and disable submission until configured. No requests
are sent during prerendering or hydration.

The API's default CORS allowlist is empty. Set `Cors:AllowedOrigins` through
configuration, for example these environment variables when starting the hosted API:

```sh
Cors__AllowedOrigins__0=https://scpp-association.de-wildert-penp.workers.dev
Cors__AllowedOrigins__1=https://scpp-foundation.de-wildert-penp.workers.dev
```

CORS permits JSON POST preflights for configured origins without credentials.
Update the allowlist when custom frontend domains are added. It is a browser
access policy, not authentication of the client-provided `source` field.

## Verification

```sh
npm run nx -- run contact-api:test
npm run nx -- run-many -t test -p frontpage-association frontpage-foundation
dotnet publish src/shared/contact-api/src/Scpp.Shared.Contact.Api -c Release -r linux-x64 --self-contained -o artifacts/publish/contact-api
```

Publishing requires the platform's native compiler and zlib development libraries.
HTTP tests start a local Kestrel server to verify actual binding, status codes,
Problem Details serialization, logging and CORS. Frontend tests cover request
mapping, validation, pending state, successful reset, failure/retry and an absent
API URL. Service tests verify validation and submission orchestration without
starting a web host. Later delivery behavior belongs behind `IContactSubmissionSink`,
after validation; the current implementation only logs submissions.

## Turnstile: GitHub and Cloudflare deployment setup

CI builds the native container and publishes affected images on pushes to `main`;
manual CI runs on `main` publish both APIs. The contact image is
`scppnl/contact-api:<Version>`, using the API `.csproj` version. Existing tags
require a version bump. Repository variable `DOCKER_HUB_USER` must be `scppnl`,
and repository secret `DOCKER_HUB_KEY` must permit pushes. See the root
[Docker Hub publication instructions](../../../README.md#publish-api-images-to-docker-hub)
for setup and retry behavior. CI deploys the verified digest to the existing
`contact-api` Cloud Run service through the Artifact Registry `dockerhub` mirror,
then smoke-checks `GET /`. Only main pushes and manual main runs deploy; no API
selection skips deployment. Verified partial publication successes still deploy
while the workflow remains failed; any selected tag already pushed needs a
`.csproj` version bump before repeating publication.

See [Cloud Run deployments](../../../README.md#cloud-run-api-deployments) for the
service/revision/digest/commit outcome summary, independent failures, deployment
retries and rollback to a retained revision. Frontend URL settings are separate.

### 1. Create the production Cloudflare widget

In the existing **De Wildert PenP** Cloudflare account, open **Turnstile → Add
widget**, name it `scpp-contact-production`, select **Managed**, and leave
pre-clearance disabled. Register these hostnames (no scheme, port or path):

- `scpp-association.de-wildert-penp.workers.dev`
- `scpp-foundation.de-wildert-penp.workers.dev`
- `scpp.nl`
- `blokhutdewildert.nl`

Use this widget for both forms, with action `contact`. Turnstile domain settings
alone do not configure DNS or Worker custom domains. The backend allowlist below
accepts only these exact hostnames, even where Turnstile permits subdomains.
If a `www` hostname will serve a form, explicitly add it to the backend and CORS
configuration too. Do not allow localhost on the production widget/backend.

### 2. Configure GitHub Actions

In **Repository → Settings → Secrets and variables → Actions → Secrets → New
repository secret**, keep the contact widget site key:

| GitHub repository secret | Cloudflare value | Destination |
| --- | --- | --- |
| `CONTACT_TURNSTILE_SITE_KEY` | Site key | Frontend build; public in browser assets |

The build/check job on `main` maps `CONTACT_TURNSTILE_SITE_KEY` to the frontend
build environment variable `TURNSTILE_SITE_KEY`. Add the site-key secret before
merging; PR checks use dummy keys, but production frontend builds require a real key.

The contact verification secret is already stored as
`contact-turnstile-secret-key:latest` in Google Secret Manager and attached to
Cloud Run as `CONTACT_TURNSTILE_SECRET_KEY`. No GitHub repository secret with
that name is needed. CI never reads the runtime secret.

Keep the existing `production` environment configuration:

- Variable `CLOUDFLARE_ACCOUNT_ID` for the existing account.
- Secret `CLOUDFLARE_API_TOKEN` with deployment access to the two existing Workers.
- Variable `GCP_WORKLOAD_IDENTITY_PROVIDER` set to `projects/979979719406/locations/global/workloadIdentityPools/github/providers/scppnl-website`.
- Variable `GCP_SERVICE_ACCOUNT` set to `github-deployer@websites-514515.iam.gserviceaccount.com`.

The API job uses keyless Workload Identity Federation in this main-only
production environment. No Google credential secret is required.

No Turnstile-management permission is needed on the deployment API token because
the widget is created in the dashboard. Never put the widget's **secret key** in
frontend builds, GitHub artifacts, or the static frontend Workers.

Production frontend builds fail if the site key is missing or a Cloudflare test
key. PR/non-main CI builds use a dummy site key and mocks, without production
secrets. Changing the GitHub secret does not trigger a build: run **Actions → CI →
Run workflow → main** to rebuild and deploy both frontends. This also publishes
and deploys both APIs, so bump any already-published selected API versions first.
Nx's frontend build inputs include the site key and release-validation flag to
avoid stale cached builds.

### 3. Existing Google Cloud runtime configuration

The Cloud Run service already attaches the Secret Manager secret as runtime
variable `CONTACT_TURNSTILE_SECRET_KEY` and stores the hostname and CORS values
below. Runtime configuration is managed in Google Cloud and carried over to new
revisions. CI updates only the image and does not set or clear these values,
secret attachments, service account, scaling or ingress.

```text
Turnstile__AllowedHostnames__0=scpp-association.de-wildert-penp.workers.dev
Turnstile__AllowedHostnames__1=scpp-foundation.de-wildert-penp.workers.dev
Turnstile__AllowedHostnames__2=scpp.nl
Turnstile__AllowedHostnames__3=blokhutdewildert.nl
Cors__AllowedOrigins__0=https://scpp-association.de-wildert-penp.workers.dev
Cors__AllowedOrigins__1=https://scpp-foundation.de-wildert-penp.workers.dev
Cors__AllowedOrigins__2=https://scpp.nl
Cors__AllowedOrigins__3=https://blokhutdewildert.nl
```

The secret/hostname list must be present at startup; official test secrets and
loopback hostnames are rejected outside Development. Allow outbound HTTPS to
`challenges.cloudflare.com:443` and expose the API over HTTPS. The API deliberately
omits optional `remoteip` until the host's proxy trust model is configured.

### 4. Enable the frontends and verify

Set `contactApiBaseUrl` in **each** app's `src/environments/environment.ts` to the
hosted HTTPS API origin (without `/contact`). Deploy the protected API first,
then commit the frontend URL configuration and let CI rebuild/deploy both sites.
Until both URL and site key exist, forms remain disabled with an unavailable notice.

Check both `/contact` pages with real widget tokens: a valid submission returns
`204` and produces one receipt log; invalid/missing tokens produce no receipt log.
Verify expiry, retry after error, and replay rejection after redemption propagation.
Turnstile's replay detection is eventually consistent; it is not application-level
exactly-once processing. Existing receipt logging contains personal data; Turnstile
does not change its retention or introduce email delivery.

### Development and automated tests

Create a separate Managed widget permitting `localhost` and `127.0.0.1`. Set its
site key as `TURNSTILE_SITE_KEY` in the frontend development process and its secret
only in the Development API environment. Run the frontend with `npm start`;
the wrapper also accepts normal Angular serve arguments. Development builds and
local production builds accept an absent site key and then disable submission.
Set `REQUIRE_TURNSTILE_SITE_KEY=true` locally to exercise release validation.

Unit/HTTP tests mock the SDK and Siteverify transport; they enforce hostname and
action checks without contacting Cloudflare. Official dummy keys can test the UI
but cannot pass this backend's strict checks unchanged: dummy Siteverify success
returns hostname `example.com` and no action. Do not weaken those checks to make
dummy tokens work. Use real development keys for end-to-end verification.

References: [server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[widget lifecycle](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/),
[testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
