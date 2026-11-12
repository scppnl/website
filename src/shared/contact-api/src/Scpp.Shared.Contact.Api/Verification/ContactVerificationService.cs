using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Infrastructure.Verification;

namespace Scpp.Shared.Contact.Api.Verification;

internal sealed class ContactVerificationService(TurnstileVerifier verifier) : IContactVerificationService
{
    public async Task<VerificationOutcome> VerifyAsync(string token, string traceId, CancellationToken cancellationToken)
    {
        var outcome = await verifier.VerifyAsync(token, traceId, cancellationToken);
        return outcome switch
        {
            TurnstileVerificationOutcome.Accepted => VerificationOutcome.Accepted,
            TurnstileVerificationOutcome.Rejected => VerificationOutcome.Rejected,
            _ => VerificationOutcome.Unavailable
        };
    }
}
