# Foundation booking API

The .NET 10 Native AOT API accepts `POST /bookings`. It validates booking
fields and Turnstile verification before logging one receipt and returning `204`.
It does not store bookings or send email. Receipt logs retain the existing booking
fields, including contact details and remarks; tokens and secrets are excluded.

## Cloudflare and GitHub setup

In the **De Wildert PenP** Cloudflare account, create a **Managed** Turnstile widget
named `scpp-booking-production`, with pre-clearance disabled. Allow these hostnames
(no scheme, port, or path):

- `scpp-foundation.de-wildert-penp.workers.dev`
- `blokhutdewildert.nl`

The foundation booking form uses action `booking`. Use a separate widget from
contact. If another hostname such as `www.blokhutdewildert.nl` serves the form,
explicitly add it to the widget, backend allowlist, and CORS configuration.

Keep the site key as a **repository secret** in GitHub **Settings → Secrets and variables →
Actions → Secrets**:

| Name | Value | Destination |
| --- | --- | --- |
| `BOOKING_TURNSTILE_SITE_KEY` | Widget site key | Foundation build; public in browser assets |

Existing contact site keys and the production
environment's `CLOUDFLARE_ACCOUNT_ID` variable and `CLOUDFLARE_API_TOKEN` secret
remain in use. The deployment token needs no Turnstile-management permission.

CI reads the booking site-key secret into the frontend build environment as
`BOOKING_TURNSTILE_SITE_KEY`. Production foundation builds require both contact
and booking site keys to be real, non-test keys. PR checks use dummy site keys and
mock verification. Association builds do not require the booking key. Nx includes
the booking site key in foundation build cache inputs.

The booking verification secret is already stored as
`booking-turnstile-secret-key:latest` in Google Secret Manager and attached to
Cloud Run as `BOOKING_TURNSTILE_SECRET_KEY`. No GitHub repository secret with
that name is needed. CI never reads it or passes it into frontend/image builds.

The main-only **production** environment also contains these non-secret variables:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/979979719406/locations/global/workloadIdentityPools/github/providers/scppnl-website`.
- `GCP_SERVICE_ACCOUNT`: `github-deployer@websites-514515.iam.gserviceaccount.com`.

These enable keyless Workload Identity Federation; no Google key secret is needed.

## API runtime and rollout

CI deploys each verified image digest to the existing `booking-api` Cloud Run
service in `websites-514515`, `europe-west4`, through the Artifact Registry
`dockerhub` mirror. Main pushes deploy selected APIs; manual main runs publish
and deploy both. PRs, other branches and runs with no selected APIs do not deploy.
Images use `scppnl/booking-api:<Version>` from the API `.csproj` for publication;
Cloud Run uses the verified digest, never a mutable tag or direct Docker Hub URL.

The production URL is `https://booking-api-979979719406.europe-west4.run.app`;
`GET /` must return HTTP 200 with exactly `Booking API`. Submissions use
`POST /bookings`. CI smoke-checks the root after deployment and records service,
revision, digest, commit and outcomes in the run summary. A deploy or smoke
failure fails the run; other successful API deployments stay live.

Verified partial publication successes still deploy while the publication job
and overall workflow remain failed. Before repeating publication, bump the
`.csproj` version of every selected tag already pushed, including unverified
pushes. See [publication recovery](../../../README.md#publish-api-images-to-docker-hub)
and [Cloud Run recovery and rollback](../../../README.md#cloud-run-api-deployments)
for deployment retries and moving traffic to a retained earlier revision. Follow
a rollback with a Git fix and a fresh image version before deploying again.

Cloud Run already attaches `BOOKING_TURNSTILE_SECRET_KEY` from Secret Manager
and stores the following non-secret settings. Runtime configuration is managed
in Google Cloud; image-only deployment preserves these values, secret attachments,
service account, scaling and ingress.

```text
Turnstile__AllowedHostnames__0=scpp-foundation.de-wildert-penp.workers.dev
Turnstile__AllowedHostnames__1=blokhutdewildert.nl
Cors__AllowedOrigins__0=https://scpp-foundation.de-wildert-penp.workers.dev
Cors__AllowedOrigins__1=https://blokhutdewildert.nl
```

Settings are required at startup in every environment. Outside Development,
official test secrets and loopback hostnames are rejected. Allow outbound HTTPS to
`challenges.cloudflare.com:443`; serve the API over HTTPS. Optional `remoteip` is
omitted until the API host's proxy trust model is configured.

Deploy the protected API first. Then set `bookingApiBaseUrl` in the foundation
app's `src/environments/environment.ts` to its HTTPS origin, without
`/bookings`, and rebuild/deploy the frontend. An absent API URL or booking site
key disables submission with an unavailable notice; the calculator stays usable.
The frontend API URL setting is separate from Cloud Run deployment.

Changing GitHub secrets does not trigger a build. Run **Actions → CI → Run
workflow → main** after setting the keys to rebuild/deploy the frontends. This
also publishes/deploys both APIs and needs unused versions for both.

## Request and verification behavior

Keep the existing booking JSON fields and append `turnstileToken`, a nonblank
string of at most 2,048 characters, obtained from the widget for this attempt.
Validation failures return `400` with field errors. After field validation the API
POSTs the secret and token to Cloudflare Siteverify with a ten-second timeout.
Only `success: true`, action `booking`, and an exact allowed hostname are accepted.
Rejected verification returns `403`; provider errors/timeouts or malformed
responses return `503`. Neither produces a booking receipt. Successful requests
return `204` and log once. Client cancellation propagates to verification.

The frontend prevents concurrent submissions, resets verification after every
attempt, and preserves form values on failure. Tokens expire and are single use;
obtain a fresh token for retries. Replay rejection is provided by Cloudflare and
may be eventually consistent; it is not application-level booking idempotency.

## Local development and validation

Create a separate Managed development widget allowing `localhost` and
`127.0.0.1`. Supply its public key as `BOOKING_TURNSTILE_SITE_KEY` to the foundation
frontend process. Keep `TURNSTILE_SITE_KEY` configured for the contact widget.
Supply the development booking secret only to the API as
`BOOKING_TURNSTILE_SECRET_KEY`, with `Turnstile__AllowedHostnames__0=localhost`
and optionally index `1` for `127.0.0.1`.

Run the API from the repository root with those environment values injected:

```sh
dotnet run --project src/foundation/booking-api/src/Scpp.Foundation.Booking.Api -- --environment Development --urls http://localhost:5080
```

In the foundation app, run `npm start` with the site keys set. The development
configuration targets port 5080; the API permits `http://localhost:4200`.
Local builds permit absent site keys. Use `REQUIRE_TURNSTILE_SITE_KEY=true` to
exercise release-key checks. Automated tests mock the widget and Siteverify.
Official dummy keys cannot pass strict action/hostname checks unchanged; use real
development keys for end-to-end testing rather than bypassing verification.

Before release, submit a valid form at `/reserveren` using a real token and confirm
`204` plus one receipt. Check missing/invalid tokens, expiry, fresh-token retry,
and replay rejection after redemption propagation. Live verification remains
a separate check requiring a configured frontend URL and real widget tokens.
