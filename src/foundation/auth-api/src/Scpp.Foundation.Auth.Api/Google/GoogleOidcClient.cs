using System.Net;
using System.Text.Json;
using Scpp.Foundation.Auth.Api.Configuration;
using Scpp.Foundation.Auth.Api.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

internal sealed class GoogleOidcClient(HttpClient client, AuthSettings settings)
{
    /// <summary>Exchanges the authorization code. Returns null when Google rejects the code.</summary>
    internal async Task<string?> ExchangeCodeAsync(string code, string codeVerifier, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, GoogleEndpoints.Token)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = settings.ClientId,
                ["client_secret"] = settings.ClientSecret,
                ["redirect_uri"] = settings.CallbackUri.AbsoluteUri,
                ["grant_type"] = "authorization_code",
                ["code_verifier"] = codeVerifier,
            }),
        };

        try {
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized) {
                return null;
            }

            if (!response.IsSuccessStatusCode) {
                throw new GoogleUnavailableException(GoogleFailureCategory.ProviderError);
            }

            var token = await response.Content.ReadFromJsonAsync(AuthJsonContext.Default.GoogleTokenResponse, cancellationToken);
            return string.IsNullOrEmpty(token?.IdToken)
                ? throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse)
                : token.IdToken;
        } catch (HttpRequestException exception) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Network, exception);
        } catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Timeout, exception);
        } catch (JsonException exception) {
            throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse, exception);
        }
    }
}
