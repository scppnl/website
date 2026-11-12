using Scpp.Shared.Contact.Api.Verification;

namespace Scpp.Shared.Contact.Api.Interfaces;

public interface IContactVerificationService
{
    Task<VerificationOutcome> VerifyAsync(string token, string traceId, CancellationToken cancellationToken);
}
