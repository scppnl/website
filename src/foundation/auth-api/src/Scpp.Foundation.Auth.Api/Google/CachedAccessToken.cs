namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>An access token and the moment after which it must no longer be used.</summary>
internal sealed record CachedAccessToken(string Value, DateTimeOffset ValidUntil);
