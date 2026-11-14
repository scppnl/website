using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Serialization;

namespace Scpp.Foundation.Booking.Api.Email;

internal sealed class GmailTokenProvider(IHttpClientFactory clients, BookingEmailSettings settings, TimeProvider clock) : IDisposable
{
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private string? accessToken;
    private DateTimeOffset refreshAt;

    internal async Task<string> GetToken(CancellationToken cancellationToken)
    {
        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            if (accessToken is not null && clock.GetUtcNow() < refreshAt) return accessToken;
            using var client = clients.CreateClient("gmail-oauth");
            using var body = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["client_id"] = settings.Credentials.ClientId!,
                ["client_secret"] = settings.Credentials.ClientSecret!,
                ["refresh_token"] = settings.Credentials.RefreshToken!
            });
            using var response = await client.PostAsync("https://oauth2.googleapis.com/token", body, cancellationToken);
            if (!response.IsSuccessStatusCode) throw new GmailDeliveryException("oauth-rejected");
            var token = await response.Content.ReadFromJsonAsync(BookingJsonContext.Default.GmailTokenResponse, cancellationToken);
            if (string.IsNullOrWhiteSpace(token?.AccessToken) || token.AccessToken.Any(character => char.IsControl(character) || char.IsWhiteSpace(character)) ||
                token.ExpiresIn is <= 60 or > 86400 || !string.Equals(token.TokenType, "Bearer", StringComparison.OrdinalIgnoreCase))
                throw new GmailDeliveryException("oauth-invalid-response");
            accessToken = token.AccessToken;
            refreshAt = clock.GetUtcNow().AddSeconds(token.ExpiresIn - 60);
            return accessToken;
        }
        finally { refreshLock.Release(); }
    }

    internal async Task Invalidate(string rejectedToken, CancellationToken cancellationToken)
    {
        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            // A delayed 401 must not evict a newer token refreshed by another request.
            if (string.Equals(accessToken, rejectedToken, StringComparison.Ordinal)) accessToken = null;
        }
        finally { refreshLock.Release(); }
    }

    public void Dispose() => refreshLock.Dispose();
}
