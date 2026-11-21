namespace Scpp.Foundation.Auth.Api.Sessions;

/// <summary>Per-attempt values kept in the encrypted flow cookie until Google redirects back.</summary>
internal sealed class FlowPayload
{
    public required string State { get; init; }
    public required string Nonce { get; init; }
    public required string CodeVerifier { get; init; }
    public required long CreatedAt { get; init; }
}
