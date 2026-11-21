namespace Scpp.Foundation.Auth.Api.Configuration;

/// <summary>JSON shape of the <c>AUTH_SESSION_KEYS</c> secret.</summary>
internal sealed class SessionKeyRingDocument
{
    public string? ActiveKeyId { get; init; }
    public Dictionary<string, string>? Keys { get; init; }
}
