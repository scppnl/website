using Microsoft.AspNetCore.Http.HttpResults;

namespace Scpp.Foundation.Auth.Api.Endpoints;

internal static class DummyEndpoint
{
    internal static ContentHttpResult Get() =>
        TypedResults.Text("Auth API", "text/plain", statusCode: StatusCodes.Status200OK);
}
