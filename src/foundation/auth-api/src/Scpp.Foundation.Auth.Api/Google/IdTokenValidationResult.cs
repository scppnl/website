using Scpp.Foundation.Auth.Api.Access;

namespace Scpp.Foundation.Auth.Api.Google;

internal sealed record IdTokenValidationResult(GoogleIdentity? Identity)
{
    internal bool IsValid => Identity is not null;

    internal static IdTokenValidationResult Invalid { get; } = new((GoogleIdentity?)null);
}
