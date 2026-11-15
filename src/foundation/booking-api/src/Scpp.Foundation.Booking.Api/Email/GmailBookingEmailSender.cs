using System.Net.Http.Headers;
using System.Net;
using System.Text.Json;
using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Email;

internal sealed class GmailBookingEmailSender(HttpClient client, GmailTokenProvider tokens,
    BookingEmailSettings settings, TimeProvider clock, ILogger<GmailBookingEmailSender> logger) : IBookingEmailSender
{
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Major Code Smell", "S6667:Logging in a catch clause should pass the caught exception as a parameter",
        Justification = "Provider exceptions can contain credentials or message data; log only the sanitized failure category.")]
    public async Task<bool> SendAsync(BookingRequestDto request, CancellationToken cancellationToken)
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        using var acquisition = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, deadline.Token);
        var sendStarted = false;
        try
        {
            var raw = BookingEmailMessage.Create(request, settings, clock.GetUtcNow());
            var token = await tokens.GetTokenAsync(acquisition.Token);
            using var message = CreateMessage(raw, token);
            cancellationToken.ThrowIfCancellationRequested();
            // After submission starts, finish reading Gmail's response and recording the
            // receipt even if the visitor disconnects. The original deadline still applies.
            sendStarted = true;
            using var response = await client.SendAsync(message, deadline.Token);
            await RecordResponseAsync(response, token, deadline.Token);
            return true;
        }
        catch (Exception exception) when (exception is GmailDeliveryException or HttpRequestException or JsonException ||
            exception is OperationCanceledException && (sendStarted || !cancellationToken.IsCancellationRequested))
        {
            var category = exception switch {
                GmailDeliveryException failure => failure.Category,
                OperationCanceledException => "timeout", JsonException => "invalid-response", _ => "network"
            };
            logger.LogWarning("Booking email unavailable ({FailureCategory})", category);
            return false;
        }
    }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Major Code Smell", "S1075:URIs should not be hardcoded",
        Justification = "Gmail uses this fixed protocol endpoint for the authenticated user; it is not deployment configuration.")]
    private static HttpRequestMessage CreateMessage(string raw, string token)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        message.Content = JsonContent.Create(new GmailSendRequest(raw), BookingJsonContext.Default.GmailSendRequest);
        return message;
    }

    private async Task RecordResponseAsync(HttpResponseMessage response, string token, CancellationToken cancellationToken)
    {
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            await tokens.InvalidateAsync(token, cancellationToken);
            throw new GmailDeliveryException("gmail-unauthorized");
        }
        if (!response.IsSuccessStatusCode) {
            throw new GmailDeliveryException("gmail-rejected");
        }

        var result = await response.Content.ReadFromJsonAsync(BookingJsonContext.Default.GmailSendResponse, cancellationToken);
        if (string.IsNullOrWhiteSpace(result?.Id) || result.Id.Length > 256 || result.Id.Any(char.IsControl)) {
            throw new GmailDeliveryException("gmail-invalid-response");
        }

        logger.LogInformation("Booking email accepted by Gmail ({ProviderMessageId})", result.Id);
    }
}
