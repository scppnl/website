using Scpp.Shared.Contact.Application.Verification;

namespace Scpp.Shared.Contact.Application.Interfaces;

public interface IContactVerificationService
{
    Task<VerificationOutcome> VerifyAsync(string token, string traceId, CancellationToken cancellationToken);
}
