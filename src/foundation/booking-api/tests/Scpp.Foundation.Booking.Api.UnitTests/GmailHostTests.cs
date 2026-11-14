using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Email;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Api.Verification;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class GmailHostTests
{
    [TestMethod]
    public async Task ProductionRegistrationsSendBookingsAndShareTheNamedOAuthClientAndTokenCache()
    {
        using var verification = new SiteverifyStub();
        using var oauth = new GmailHttpStub();
        using var gmail = new GmailHttpStub();
        await using var app = BookingApi.Build(["--urls", "http://127.0.0.1:0", "--environment", "Testing"], builder => {
            builder.Configuration["BOOKING_TURNSTILE_SECRET_KEY"] = "test-secret";
            builder.Configuration["Turnstile:AllowedHostnames:0"] = "blokhutdewildert.nl";
            builder.Configuration["BookingEmail:From"] = "noreply@scpp.nl";
            builder.Configuration["BookingEmail:To"] = "verhuur@scpp.nl";
            builder.Configuration["BOOKING_GMAIL_OAUTH_JSON"] = "{\"client_id\":\"client\",\"client_secret\":\"secret\",\"refresh_token\":\"refresh\"}";
            builder.Services.AddHttpClient<TurnstileVerifier>().ConfigurePrimaryHttpMessageHandler(() => verification);
            builder.Services.AddHttpClient("gmail-oauth").ConfigurePrimaryHttpMessageHandler(() => oauth);
            builder.Services.AddHttpClient<IBookingEmailSender, GmailBookingEmailSender>().ConfigurePrimaryHttpMessageHandler(() => gmail);
        });
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        // Dotless addresses remain accepted, as in the original API and Angular form.
        foreach (var address in new[] { "renter@example.org", "renter@localhost" })
        {
            using var response = await client.PostAsJsonAsync("/bookings", new BookingRequestDto {
                Name = "Test Renter", Email = address, Building = "groot", GroupType = "family",
                Date = new(2099, 6, 4), Dayparts = ["ochtend"], Guests = 10, TurnstileToken = "fresh-token"
            }, BookingJsonContext.Default.BookingRequestDto);
            Assert.AreEqual(HttpStatusCode.NoContent, response.StatusCode);
        }
        Assert.HasCount(1, oauth.Requests, "Typed senders must share the singleton token cache.");
        Assert.AreEqual("https://oauth2.googleapis.com/token", oauth.Requests.Single().Url);
        Assert.HasCount(2, gmail.Requests);
        Assert.IsTrue(gmail.Requests.All(request => request.Url == "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" && request.Authorization == "Bearer access"));
        Assert.AreEqual(2, verification.Calls);
    }
}
