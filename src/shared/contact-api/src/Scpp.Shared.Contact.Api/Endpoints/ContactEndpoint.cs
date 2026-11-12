using Microsoft.AspNetCore.Http.HttpResults;
using Scpp.Shared.Contact.Application.Interfaces;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.Endpoints;

internal static class ContactEndpoint
{
    internal static async Task<Results<NoContent, ValidationProblem>> Post(
        ContactRequest request, HttpContext context, IContactSubmissionService service,
        CancellationToken cancellationToken)
    {
        var result = await service.SubmitAsync(request, context.TraceIdentifier, cancellationToken);
        if (result.Errors.Count > 0)
        {
            return TypedResults.ValidationProblem(result.Errors);
        }

        return TypedResults.NoContent();
    }
}
