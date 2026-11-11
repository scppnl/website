using Microsoft.AspNetCore.Http.HttpResults;

namespace Scpp.Foundation.Booking.Api;

internal static class DummyEndpoint
{
    internal static ContentHttpResult Get() =>
        TypedResults.Text("Booking API", "text/plain", statusCode: StatusCodes.Status200OK);
}
