using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Api.Verification;

namespace Scpp.Shared.Contact.Api.UnitTests.Services;

internal sealed class RecordingVerificationService : IContactVerificationService
{
    internal int Calls { get; private set; }
    internal string? Token { get; private set; }
    internal string? TraceId { get; private set; }
    internal CancellationToken CancellationToken { get; private set; }
    internal VerificationOutcome Outcome { get; init; } = VerificationOutcome.Accepted;

    public Task<VerificationOutcome> VerifyAsync(string token, string traceId, CancellationToken cancellationToken)
    {
        Calls++;
        Token = token;
        TraceId = traceId;
        CancellationToken = cancellationToken;
        return Task.FromResult(Outcome);
    }
}
