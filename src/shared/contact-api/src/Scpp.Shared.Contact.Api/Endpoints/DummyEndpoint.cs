using Microsoft.AspNetCore.Http.HttpResults;

namespace Scpp.Shared.Contact.Api.Endpoints;

internal static class DummyEndpoint
{
    internal static ContentHttpResult Get() =>
        TypedResults.Text("Contact API", "text/plain", statusCode: StatusCodes.Status200OK);
}
