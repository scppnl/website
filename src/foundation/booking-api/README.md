# Foundation booking API

The .NET 10 Native AOT API accepts `POST /bookings`. It validates booking
fields and Turnstile verification before emailing the rental team, logging one
receipt and returning `204`. It does not store bookings. Receipt logs retain the existing booking
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

Deploy and verify the email-enabled API first. Then set repository variable
`BOOKING_API_BASE_URL` to its HTTPS origin, without `/bookings`, and rebuild/deploy
the frontend. An absent API URL or booking site
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
return `204` and log once only after Gmail accepts the email. Email failures
return `503` without a receipt. Client cancellation propagates to both providers.

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
`204`, delivery to the rental mailbox, correct Reply-To, and one receipt. Check missing/invalid tokens, expiry, fresh-token retry,
and replay rejection after redemption propagation. Live verification remains
a separate check requiring a configured frontend URL and real widget tokens.

## Gmail configuration and rollout

Notifications use `From: noreply@scpp.nl`, `To: verhuur@scpp.nl`, and the applicant's
validated address as `Reply-To`. The Dutch plain-text message includes every booking
field and says the request still needs confirmation. No applicant confirmation is sent.
Gmail acceptance is not a guarantee of inbox delivery. There is no durable queue,
automatic send retry, or application-level deduplication: a timeout after Gmail
acceptance can produce a duplicate if the visitor retries. Email authentication and
sending share a 15-second deadline, after Turnstile's ten-second deadline.

### Workspace and OAuth setup (administrator, once)

1. Create **noreply@scpp.nl as a Gmail-enabled Workspace mailbox**, not a group or
   forwarding alias. Confirm `verhuur@scpp.nl` can receive its messages, including
   any group posting restrictions. Verify the domain's existing Google SPF, DKIM,
   and DMARC setup; no additional email provider is introduced.
2. In an organization-owned Google Cloud project, enable **Gmail API** and configure
   an **Internal** OAuth app, permitted by Workspace API access controls. Terraform
   enables Gmail API in `websites-514515`; if the OAuth client belongs to a different
   organization-owned project, enable it there too. An external app in Testing can
   issue refresh tokens that expire after seven days and is unsuitable here.
3. The shared OAuth app is named **De Wildert / P&P APIs**. Under Clients, create a
   **Desktop app** client named `booking-api` and save the downloaded JSON as
   `booking-api-oauth.json` in Downloads. Under Data access, add `gmail.send`.
   Future contact email can use another client within the same app.
4. On Windows, run these single-line PowerShell commands. The isolated configuration
   preserves the operator's existing CLI and application default credentials:

   ```powershell
   $bookingClientFile = Join-Path $env:USERPROFILE "Downloads\booking-api-oauth.json"
   $bookingAuthDir = Join-Path $env:LOCALAPPDATA ("ScppBookingOAuth-" + [guid]::NewGuid().ToString("N"))
   New-Item -ItemType Directory -Path $bookingAuthDir | Out-Null
   $bookingPreviousConfig = $env:CLOUDSDK_CONFIG
   try { $env:CLOUDSDK_CONFIG = $bookingAuthDir; gcloud auth application-default login noreply@scpp.nl --client-id-file="$bookingClientFile" --scopes="openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/gmail.send" --disable-quota-project } finally { $env:CLOUDSDK_CONFIG = $bookingPreviousConfig }
   $bookingCredentials = Get-Content -Raw "$bookingAuthDir\application_default_credentials.json" | ConvertFrom-Json
   [pscustomobject]@{ HasClientId = -not [string]::IsNullOrWhiteSpace($bookingCredentials.client_id); HasClientSecret = -not [string]::IsNullOrWhiteSpace($bookingCredentials.client_secret); HasRefreshToken = -not [string]::IsNullOrWhiteSpace($bookingCredentials.refresh_token) }
   ```

   Authorize as **noreply@scpp.nl**, wait for the terminal to report the saved file,
   and confirm all three checks are True. The API accepts extra ADC JSON fields.
   gcloud ADC requires Cloud Platform scope and uses the OpenID/email identity
   scopes in addition to Gmail send. These scopes do not assign Cloud IAM roles;
   the mailbox needs no project permissions. The API only calls Gmail send.
   Requesting cloud-platform without identity scopes can fail after the browser
   callback with `None could not be converted to bytes`.
5. For a Gmail-only grant, use a separate **Web application** client and
   `https://developers.google.com/oauthplayground` as its authorized redirect URI.
   In [OAuth Playground](https://developers.google.com/oauthplayground), select
   **Use your own OAuth credentials**, server-side flow and offline access. Request
   only `https://www.googleapis.com/auth/gmail.send`, authorize as `noreply@scpp.nl`,
   and exchange the code. Save these fields using that Web client's credentials:

   ```json
   {"client_id":"<own OAuth client ID>","client_secret":"<own OAuth client secret>","refresh_token":"<noreply mailbox refresh token>"}
   ```

   This is an alternative to step 4. Mailbox read access and domain-wide delegation
   are unnecessary. Keep every credential file outside the checkout; do not put
   values in command arguments, chat, GitHub secrets, images, or Terraform state.

### Secret bootstrap and API deployment

The runtime requires `BookingEmail__From`, `BookingEmail__To`, and
`BOOKING_GMAIL_OAUTH_JSON` at startup in every environment. Startup validates the
configuration locally; it does not test Google credentials. Development uses a
separate authorized test mailbox/secret. Automated tests stub Google and need no
real credentials.

Terraform runs through CI: PRs receive a read-only production plan; after merging,
the apply job waits for approval in the `infrastructure` environment. Release the
secret container, runtime configuration, and API implementation in three ordered
PRs. A single apply cannot attach an empty secret, and application CI must not
deploy the new API before its required runtime settings exist.

1. Merge the secret-bootstrap PR and approve its Terraform job. This enables Gmail
   API and creates the protected `booking-gmail-oauth` container without changing
   Cloud Run. Inspect the PR plan before approving the apply.
2. In the same PowerShell window used for authorization, select your Google Cloud
   administrator account and upload the **generated** credential file:

```powershell
gcloud auth login
gcloud secrets describe booking-gmail-oauth --project=websites-514515 --format="value(name)"
gcloud secrets versions add booking-gmail-oauth --project=websites-514515 --data-file="$bookingAuthDir\application_default_credentials.json"
gcloud secrets versions list booking-gmail-oauth --project=websites-514515 --filter="state=ENABLED" --format="table(name,state,createTime)"
```

   If using Playground instead, pass the path to the protected JSON file created
   there. The operator needs secret-version upload permission; the sender mailbox
   does not need Cloud IAM roles.
3. After the secret version exists, merge the runtime-configuration PR and approve
   its Terraform apply. It grants booking runtime secret access and attaches the
   secret, sender, and recipient. The module references the existing populated
   container; no secret value enters CI or Terraform state. The old API image
   ignores the added settings and stays operational.
4. After that apply succeeds, merge the API implementation PR to deploy the email
   code through application CI. Keep `BOOKING_API_BASE_URL` unset until delivery
   has been verified. GitHub's image deployer retains its current permissions and
   cannot read the OAuth secret. No local or targeted Terraform apply is needed.

After a successful upload, remove local temporary files without revoking the grant:

```powershell
Remove-Item -LiteralPath $bookingAuthDir -Recurse -Force
Remove-Variable bookingAuthDir, bookingPreviousConfig, bookingCredentials
```

`GET /` still returns `Booking API` and does not send email.

Use a development frontend targeting the deployed API, from a configured CORS and
Turnstile hostname, to make one controlled request with a fresh real token. Confirm
`204`, one notification in `verhuur@scpp.nl`, all fields and accents, and that Reply
targets the applicant. Inspect the `Booking email accepted by Gmail` event and one
booking receipt. Simulate provider failure in automated tests, never by breaking
production credentials. Then set **repository Actions variable**
`BOOKING_API_BASE_URL=https://booking-api-979979719406.europe-west4.run.app` and
rebuild/deploy the foundation website. The variable is public build configuration;
it is not a secret. Nx includes it in the frontend build inputs. Check `/reserveren`
on the deployed site with a final controlled submission.

Changing a repository variable does not start a build. Manual CI on `main` rebuilds
both websites and publishes both APIs, so first ensure **every selected API image
version is unused**. Shared `eng/frontend.mjs` and workflow changes select both APIs;
check the contact API version before releasing this change as well.

### Failures, rotation and rollback

On `503`, the form retains its values and requires a fresh Turnstile token. Operational
warnings log only `FailureCategory` (OAuth rejection, Gmail rejection, network,
timeout, or invalid response); provider bodies and tokens are never logged or returned.
Use Cloud Run request/error logs and these warnings to investigate persistent failures.
Check Workspace authorization, mailbox status, and Gmail quota; a revoked grant
requires repeating the mailbox consent flow. Store a replacement refresh token as a
new secret version, then create a new Cloud Run revision (a redeploy reads `latest`).
Existing instances cache access tokens until one minute before expiry.

For persistent failures, clear `BOOKING_API_BASE_URL` and rebuild/deploy the frontend
to disable submissions. Repair credentials or move API traffic back to a known good
**email-enabled** revision. Rolling back to the earlier logging-only API would report
success without sending email and must not be used with an active form. Verify actual
delivery before restoring the variable and rebuilding the frontend.

References: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending),
[Google OAuth](https://developers.google.com/identity/protocols/oauth2), and
[OAuth Playground](https://developers.google.com/oauthplayground).
