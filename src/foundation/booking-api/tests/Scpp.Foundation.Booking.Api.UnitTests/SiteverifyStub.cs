using System.Net;
using System.Text;

namespace Scpp.Foundation.Booking.Api.UnitTests;

internal sealed class SiteverifyStub : HttpMessageHandler
{
    internal int Calls;
    internal string? Url;
    internal string? Body;
    internal string Response = "{\"success\":true,\"hostname\":\"blokhutdewildert.nl\",\"action\":\"booking\"}";
    internal HttpStatusCode Status = HttpStatusCode.OK;
    internal Func<CancellationToken, Task<HttpResponseMessage>>? Respond;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        Url = request.RequestUri!.ToString();
        Body = await request.Content!.ReadAsStringAsync(cancellationToken);
        return Respond is not null ? await Respond(cancellationToken) :
            new HttpResponseMessage(Status) { Content = new StringContent(Response, Encoding.UTF8, "application/json") };
    }
}
