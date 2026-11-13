using System.Net.Http.Headers;
using System.Text.Json;
using Scpp.Foundation.Booking.Api.Configuration;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Email;

internal sealed class GmailBookingEmailSender(HttpClient client, GmailTokenProvider tokens,
    BookingEmailSettings settings, TimeProvider clock, ILogger<GmailBookingEmailSender> logger) : IBookingEmailSender
{
    public async Task<bool> Send(BookingRequestDto request, CancellationToken cancellationToken)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(15));
        try
        {
            var raw = BookingEmailMessage.Create(request, settings, clock.GetUtcNow());
            var token = await tokens.GetToken(deadline.Token);
            using var message = new HttpRequestMessage(HttpMethod.Post, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            message.Content = JsonContent.Create(new GmailSendRequest(raw), BookingJsonContext.Default.GmailSendRequest);
            using var response = await client.SendAsync(message, deadline.Token);
            if (!response.IsSuccessStatusCode) throw new GmailDeliveryException("gmail-rejected");
            var result = await response.Content.ReadFromJsonAsync(BookingJsonContext.Default.GmailSendResponse, deadline.Token);
            if (string.IsNullOrWhiteSpace(result?.Id) || result.Id.Length > 256 || result.Id.Any(char.IsControl))
                throw new GmailDeliveryException("gmail-invalid-response");
            logger.LogInformation("Booking email accepted by Gmail ({ProviderMessageId})", result.Id);
            return true;
        }
        catch (Exception exception) when (exception is GmailDeliveryException or HttpRequestException or JsonException ||
            exception is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            var category = exception switch {
                GmailDeliveryException failure => failure.Category,
                OperationCanceledException => "timeout", JsonException => "invalid-response", _ => "network"
            };
            logger.LogWarning("Booking email unavailable ({FailureCategory})", category);
            return false;
        }
    }
}
