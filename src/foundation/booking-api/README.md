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
workflow → main** with **sites_only** enabled after setting frontend keys or the
booking URL. This rebuilds/deploys the websites without publishing API images.

## Request and verification behavior

Keep the existing booking JSON fields and append `turnstileToken`, a nonblank
string of at most 2,048 characters, obtained from the widget for this attempt.
Validation failures return `400` with field errors. After field validation the API
POSTs the secret and token to Cloudflare Siteverify with a ten-second timeout.
Only `success: true`, action `booking`, and an exact allowed hostname are accepted.
Rejected verification returns `403`; provider errors/timeouts or malformed
responses return `503`. Neither produces a booking receipt. Successful requests
return `204` and log once only after Gmail accepts the email. Email failures
return `503` without a receipt. Client cancellation propagates through verification
and OAuth acquisition. Once Gmail submission starts, the API finishes reading the
response and records an accepted booking even if the visitor disconnects; the
original 15-second email deadline still applies. Provider timeouts or process
failure can leave delivery uncertain, so retrying can still produce duplicates.

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
   **Web application** client for the booking sender. Add
   `https://developers.google.com/oauthplayground` as its authorized redirect URI.
   Under Data access, add `https://www.googleapis.com/auth/gmail.send`.
   Future contact email can use another client within the same app.
4. In [OAuth Playground](https://developers.google.com/oauthplayground), select
   **Use your own OAuth credentials** and enter that client's ID and secret. Use
   server-side flow, offline access, and consent prompting. Request **only**
   `https://www.googleapis.com/auth/gmail.send`, authorize as **noreply@scpp.nl**,
   then exchange the code. Confirm the granted scope is Gmail send only.
5. Save these fields in a protected JSON file outside the checkout, using the same
   Web client's credentials and its refresh token:

   ```json
   {"client_id":"<own OAuth client ID>","client_secret":"<own OAuth client secret>","refresh_token":"<noreply mailbox refresh token>"}
   ```

   Mailbox read access, Cloud Platform scope, and domain-wide delegation are
   unnecessary. Use gcloud only for the operator's Secret Manager upload, not for
   mailbox authorization: its ADC login requests additional Cloud and identity
   scopes. Cloud scope can expose any effective project, organization, or billing
   permissions, including inherited grants. Do not assume a mailbox has no effective
   Cloud permissions just because it has no explicit project-level role.
   Keep values out of command arguments, chat, GitHub secrets, images, and Terraform state.

### Runtime secrets and deployment

The runtime requires `BookingEmail__From`, `BookingEmail__To`, and
`BOOKING_GMAIL_OAUTH_JSON` at startup in every environment. Startup validates the
configuration locally; it does not test Google credentials. Development uses a
separate authorized test mailbox/secret. Automated tests stub Google and need no
real credentials.

Terraform manages the `booking-gmail-oauth` container, booking runtime reader
grant, secret attachment, and sender/recipient settings. CI applies infrastructure
changes after approval in the `infrastructure` environment. Credential values are
uploaded separately and stay outside Git, GitHub Actions, and Terraform state.
Cloud Run requires an enabled secret version when a revision starts.

To upload authorized credentials to the provisioned container, use the operator's
Google Cloud account with secret-version upload permission. In PowerShell, replace
the credential-file path with the protected JSON file saved above:

```powershell
gcloud auth login
$bookingCredentialFile = "C:\secure\booking-gmail-oauth.json"
gcloud secrets describe booking-gmail-oauth --project=websites-514515 --format="value(name)"
gcloud secrets versions add booking-gmail-oauth --project=websites-514515 --data-file="$bookingCredentialFile"
gcloud secrets versions list booking-gmail-oauth --project=websites-514515 --filter="state=ENABLED" --format="table(name,state,createTime)"
```

The sender mailbox needs no Cloud IAM roles. Application CI deploys API images;
its image deployer cannot read the OAuth secret. Set `BOOKING_API_BASE_URL` only
when the deployed API has its required configuration and email delivery is verified.

After a successful upload, remove the local credential file according to the
operator's credential-handling policy while preserving the active Gmail grant.
To replace an existing broader ADC credential, authorize a separate Gmail-only
OAuth client, upload a new secret version, and deploy a new API revision. After
delivery is verified, disable superseded secret versions and retire the old OAuth
client once no other workload uses it. Updating these docs or rotating an access
token does not reduce the scope of a previously issued refresh token.

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

Changing a repository variable does not start a build. Run **CI → Run workflow →
main** with **sites_only** enabled to rebuild/deploy the websites. The CLI equivalent is:

```powershell
gh workflow run ci.yml --repo=scppnl/website --ref=main -f sites_only=true
```

This selects websites for both checks and deployment, with no API image build or
publication and no API version bump. The default full manual run still selects all
projects and requires unused tags for every API it publishes.

### Failures, rotation and rollback

On `503`, the form retains its values and requires a fresh Turnstile token. Operational
warnings log only `FailureCategory` (OAuth rejection, Gmail rejection, Gmail 401,
network, timeout, or invalid response); provider bodies and tokens are never logged
or returned. A Gmail 401 invalidates only the rejected cached token, allowing the
next submission to acquire a fresh one; the API does not retry the failed email.
Use Cloud Run request/error logs and these warnings to investigate persistent failures.
Check Workspace authorization, mailbox status, and Gmail quota; a revoked grant
requires repeating the mailbox consent flow. Store a replacement refresh token as a
new secret version, then create a new Cloud Run revision (a redeploy reads `latest`).
Existing instances cache access tokens until one minute before expiry.

For persistent failures, clear `BOOKING_API_BASE_URL` and run the websites-only
workflow to disable submissions. Repair credentials or move API traffic back to a known good
revision whose email delivery has been verified. Verify actual delivery before
restoring the variable and rebuilding the frontend.

References: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending),
[Google OAuth](https://developers.google.com/identity/protocols/oauth2), and
[OAuth Playground](https://developers.google.com/oauthplayground).
