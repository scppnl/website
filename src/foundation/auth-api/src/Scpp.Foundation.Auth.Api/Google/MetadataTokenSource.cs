using System.Text.Json;
using Scpp.Foundation.Auth.Api.Serialization;

namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>
/// Gets access tokens for the Cloud Run service account from the metadata server. A token is
/// reused until shortly before it expires. There is no key file to store or rotate.
/// </summary>
internal sealed class MetadataTokenSource(IHttpClientFactory clients, TimeProvider clock)
{
    private static readonly TimeSpan ExpiryMargin = TimeSpan.FromSeconds(60);

    private readonly SemaphoreSlim gate = new(1, 1);
    private volatile CachedAccessToken? cached;

    internal async Task<string> GetAsync(CancellationToken cancellationToken)
    {
        if (Current() is { } token) {
            return token;
        }

        await gate.WaitAsync(cancellationToken);
        try {
            return Current() ?? await FetchAsync(cancellationToken);
        } finally {
            gate.Release();
        }
    }

    private string? Current() => cached is { } token && clock.GetUtcNow() < token.ValidUntil ? token.Value : null;

    private async Task<string> FetchAsync(CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"{GoogleEndpoints.MetadataToken}?scopes={Uri.EscapeDataString(GoogleEndpoints.GroupsScope)}");
        request.Headers.Add("Metadata-Flavor", "Google");

        try {
            using var client = clients.CreateClient(GoogleEndpoints.CloudClient);
            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode) {
                throw new GoogleUnavailableException(GoogleFailureCategory.ProviderError);
            }

            var token = await response.Content.ReadFromJsonAsync(AuthJsonContext.Default.MetadataTokenResponse, cancellationToken);
            if (string.IsNullOrEmpty(token?.AccessToken) || token.ExpiresIn <= 0) {
                throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse);
            }

            cached = new(token.AccessToken, clock.GetUtcNow().AddSeconds(token.ExpiresIn).Subtract(ExpiryMargin));
            return token.AccessToken;
        } catch (HttpRequestException exception) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Network, exception);
        } catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested) {
            throw new GoogleUnavailableException(GoogleFailureCategory.Timeout, exception);
        } catch (JsonException exception) {
            throw new GoogleUnavailableException(GoogleFailureCategory.InvalidResponse, exception);
        }
    }
}
