using Microsoft.Extensions.Logging;
using Scpp.Shared.Contact.Domain.Models;

namespace Scpp.Shared.Contact.Infrastructure.Logging;

public sealed class LoggingContactSubmissionSink(ILogger<LoggingContactSubmissionSink> logger)
{
    public Task SubmitAsync(ContactSubmission submission, string traceId, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Contact request received at {Timestamp} ({TraceId}): {Source}, {Name}, {Email}, {Message}, {ChildName}, {Phone}, {Subject}",
            DateTimeOffset.UtcNow, traceId, submission.Source, submission.Name,
            submission.Email, submission.Message, submission.ChildName, submission.Phone, submission.Subject);
        return Task.CompletedTask;
    }
}
