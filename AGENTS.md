# Git commit identity

Use `Michel Megens <mtm.megens@gmail.com>` for both
the author and committer of every commit in this repository, including review
artifacts. Set this identity in repository-local Git configuration before
committing; do not inherit an email address from the environment's global config.

Before pushing, inspect both author and committer with `git show --format=fuller`.
After pushing, verify that GitHub attributes both identities to `michelmegens`.

# API setup

When setting up an API, configure Serilog through Microsoft.Extensions.Logging
before building the host. Application code must use injected `ILogger<T>` and
structured message templates; keep Serilog-specific APIs in logging setup.

Replace the default logging providers, configure readable console output, and
enrich events with the application name, environment, and logging scope properties.
Use Information by default and Warning for Microsoft.AspNetCore and System.
Add Serilog request completion logging before endpoint execution so each request
records its method, path, status, and duration. Use the host's DI-managed logger
for request logging and preserve the static logger to keep hosts isolated.
Do not add logs of raw request bodies, credentials, or additional contact/booking
payload fields. Preserve the contact API's established normalized submission log
contract.

Follow the existing APIs' explicit code-based sink configuration to preserve
Native AOT compatibility. Let the host dispose and flush the logger. Verify the
Microsoft ILogger integration, request logging, and Native AOT publish/run as part
of API setup; resolve new logging-related trimming and AOT warnings.
Pin Serilog core to 4.4 or later for its trimming support. Use named scalar
properties and collections; reflection-based `{@Object}` destructuring is
disabled in trimmed/native builds.
