namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>What the API sent to the stubbed metadata server or Cloud Identity API.</summary>
internal sealed record RecordedRequest(string? Query, string? PageToken, string? Scopes, string? Authorization, string? MetadataFlavor);
