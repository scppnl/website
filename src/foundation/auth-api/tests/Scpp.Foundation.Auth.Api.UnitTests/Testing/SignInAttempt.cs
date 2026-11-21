namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>What the browser holds after <c>GET /auth/google</c>.</summary>
internal sealed record SignInAttempt(Uri Location, string State, string Nonce, string Challenge, string FlowCookie);
