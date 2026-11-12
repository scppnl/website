# Contact API

The .NET 10 minimal API accepts contact requests from both frontends. It currently
validates and logs the complete normalized request through structured console
logging. It does not send email or persist requests. Logs contain submitted names,
email addresses and message text. A successful response confirms receipt only.

## Local development

From the repository root, with the SDK selected by `global.json`:

```sh
DOTNET_ENVIRONMENT=Development dotnet run --project src/shared/contact-api/src/Scpp.Shared.ContactApi -- --urls http://localhost:5081
```

Development CORS permits `http://localhost` on ports 4173, 4200, 8787 and 8788.
Start either frontend with its `npm start`; the development build connects to
`http://localhost:5081`. For a static Wrangler preview against this API, first
build with `npm run build -- --configuration development`, then run
`npx wrangler dev --port 8787` (association) or `--port 8788` (foundation).
Do not use the `preview` script for this: it rebuilds the production configuration.

```sh
curl -i http://localhost:5081/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"source":"association","name":"Jan","email":"jan@example.nl","childName":"Piet","message":"Kunnen we kennismaken?"}'
curl -i http://localhost:5081/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"source":"foundation","name":"Jan","email":"jan@example.nl","phone":"","subject":"viewing","message":"Kunnen we het clubhuis bekijken?"}'
```

## Contract

`GET /` returns the existing plain-text identity. `POST /api/contact` accepts JSON:

| Field | Validation |
| --- | --- |
| `source` | Required: `association` or `foundation` |
| `name` | Required, at most 200 characters |
| `email` | Required email address, at most 254 characters |
| `message` | Required, at most 10,000 characters |
| `childName` | Optional association form field, at most 200 characters |
| `phone` | Optional foundation form field, at most 50 characters |
| `subject` | Required for foundation: `question`, `viewing`, `other`; omitted for association |

Surrounding whitespace is trimmed before validation and logging. Whitespace-only
required fields are rejected; blank optional fields become null. Internal message
formatting is preserved. Accepted requests produce one structured log entry with
all fields, UTC timestamp and trace identifier, then return `204 No Content`.
Invalid fields return `400 application/problem+json` with an `errors` dictionary
keyed by camelCase field names. Malformed JSON returns `400`; unsupported content
types return `415`. Rejected request bodies are not logged.

## Production configuration

API hosting and deployment are deferred. Both frontends use an injectable
`CONTACT_API_BASE_URL`, whose default is their Angular environment's
`contactApiBaseUrl`. In each app, set `src/environments/environment.ts` to the hosted
HTTPS API origin (without `/api/contact`) and rebuild. The development replacement
is `environment.development.ts`. Production defaults to an empty URL; the forms
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
dotnet publish src/shared/contact-api/src/Scpp.Shared.ContactApi -c Release -r linux-x64 --self-contained -o artifacts/publish/contact-api
```

Publishing requires the platform's native compiler and zlib development libraries.
HTTP tests start a local Kestrel server to verify actual binding, status codes,
Problem Details serialization, logging and CORS. Frontend tests cover request
mapping, validation, pending state, successful reset, failure/retry and an absent
API URL. Later delivery behavior belongs behind the request handler, after validation.
