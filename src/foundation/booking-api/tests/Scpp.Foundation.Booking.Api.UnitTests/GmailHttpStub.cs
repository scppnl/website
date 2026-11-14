using System.Collections.Concurrent;
using System.Net;

namespace Scpp.Foundation.Booking.Api.UnitTests;

internal sealed class GmailHttpStub : HttpMessageHandler, IHttpClientFactory
{
    internal ConcurrentQueue<(string Url, string Body, string? Authorization)> Requests { get; } = new();
    internal string OAuthResponse { get; set; } = "{\"access_token\":\"access\",\"expires_in\":3600,\"token_type\":\"Bearer\"}";
    internal string GmailResponse { get; set; } = "{\"id\":\"gmail-message\"}";
    internal HttpStatusCode OAuthStatus { get; set; } = HttpStatusCode.OK;
    internal HttpStatusCode GmailStatus { get; set; } = HttpStatusCode.OK;
    internal Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? Respond { get; set; }

    public HttpClient CreateClient(string name) => new(this, disposeHandler: false) { Timeout = Timeout.InfiniteTimeSpan };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Enqueue((request.RequestUri!.AbsoluteUri, await request.Content!.ReadAsStringAsync(cancellationToken),
            request.Headers.Authorization?.ToString()));
        if (Respond is not null) return await Respond(request, cancellationToken);
        var oauth = request.RequestUri.Host == "oauth2.googleapis.com";
        return new(oauth ? OAuthStatus : GmailStatus) { Content = new StringContent(oauth ? OAuthResponse : GmailResponse) };
    }
}
