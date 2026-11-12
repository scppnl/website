using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Domain.Models;

namespace Scpp.Shared.Contact.Api.UnitTests.Services;

internal sealed class RecordingSink : IContactSubmissionSink
{
    internal int Calls { get; private set; }
    internal ContactSubmission? Submission { get; private set; }
    internal string? TraceId { get; private set; }
    internal CancellationToken CancellationToken { get; private set; }
    internal Task Completion { get; init; } = Task.CompletedTask;

    public Task SubmitAsync(ContactSubmission submission, string traceId, CancellationToken cancellationToken)
    {
        Calls++;
        Submission = submission;
        TraceId = traceId;
        CancellationToken = cancellationToken;
        return Completion;
    }
}
