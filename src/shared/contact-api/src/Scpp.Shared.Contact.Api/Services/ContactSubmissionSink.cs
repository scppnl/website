using Scpp.Shared.Contact.Api.Interfaces;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Infrastructure.Logging;

namespace Scpp.Shared.Contact.Api.Services;

internal sealed class ContactSubmissionSink(LoggingContactSubmissionSink sink) : IContactSubmissionSink
{
    public Task SubmitAsync(ContactSubmission submission, string traceId, CancellationToken cancellationToken) =>
        sink.SubmitAsync(submission, traceId, cancellationToken);
}
