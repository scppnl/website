using System.Collections.Concurrent;
using System.Net;
using Microsoft.AspNetCore.WebUtilities;

namespace Scpp.Foundation.Auth.Api.UnitTests.Testing;

/// <summary>Stands in for Google's discovery document, JWKS and token endpoint. Nothing leaves the process.</summary>
internal sealed class GoogleHttpStub : HttpMessageHandler
{
    internal ConcurrentQueue<Dictionary<string, string>> TokenRequests { get; } = new();
    internal string IdToken { get; set; } = "";
    internal HttpStatusCode TokenStatus { get; set; } = HttpStatusCode.OK;
    internal string? TokenBody { get; set; }
    internal Exception? TokenFailure { get; set; }
    internal HttpStatusCode DiscoveryStatus { get; set; } = HttpStatusCode.OK;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var uri = request.RequestUri!;
        if (uri is { Host: "oauth2.googleapis.com", AbsolutePath: "/token" }) {
            var form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
            TokenRequests.Enqueue(form.ToDictionary(pair => pair.Key, pair => pair.Value.ToString()));
            return TokenFailure is not null
                ? throw TokenFailure
                : Json(TokenStatus, TokenBody ?? $"{{\"access_token\":\"unused\",\"token_type\":\"Bearer\",\"id_token\":\"{IdToken}\"}}");
        }

        if (uri is { Host: "accounts.google.com", AbsolutePath: "/.well-known/openid-configuration" }) {
            return Json(DiscoveryStatus, "{\"issuer\":\"https://accounts.google.com\"," +
                "\"authorization_endpoint\":\"https://accounts.google.com/o/oauth2/v2/auth\"," +
                "\"token_endpoint\":\"https://oauth2.googleapis.com/token\"," +
                "\"jwks_uri\":\"https://www.googleapis.com/oauth2/v3/certs\"," +
                "\"response_types_supported\":[\"code\"],\"subject_types_supported\":[\"public\"]," +
                "\"id_token_signing_alg_values_supported\":[\"RS256\"]}");
        }

        return uri is { Host: "www.googleapis.com", AbsolutePath: "/oauth2/v3/certs" }
            ? Json(HttpStatusCode.OK, $"{{\"keys\":[{TestSigningKey.Primary.Jwk}]}}")
            : new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };
}
