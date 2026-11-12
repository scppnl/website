using Scpp.Shared.Contact.Models;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Scpp.Shared.Contact.Api;

internal sealed class ContactRequestHandler
{
    internal static Results<NoContent, ValidationProblem> Post(
        ContactRequest request, HttpContext context, ILogger<ContactRequestHandler> logger)
    {
        var (normalized, errors) = ContactRequestValidator.Validate(request);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        logger.LogInformation(
            "Contact request received at {Timestamp} ({TraceId}): {Source}, {Name}, {Email}, {Message}, {ChildName}, {Phone}, {Subject}",
            DateTimeOffset.UtcNow, context.TraceIdentifier, normalized.Source, normalized.Name,
            normalized.Email, normalized.Message, normalized.ChildName, normalized.Phone, normalized.Subject);
        return TypedResults.NoContent();
    }
}
