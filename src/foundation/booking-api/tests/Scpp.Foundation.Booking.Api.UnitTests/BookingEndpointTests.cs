using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Foundation.Booking.Api.Endpoints;
using Scpp.Foundation.Booking.Api.Serialization;
using Scpp.Foundation.Booking.Api.Validation;
using Scpp.Foundation.Booking.Api.Verification;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.UnitTests;

[TestClass]
public sealed class BookingEndpointTests
{
    // Amsterdam is already on June 5 at this instant, while UTC is still on June 4.
    private static readonly TimeProvider Clock = new FixedClock(new DateTimeOffset(2027, 6, 4, 22, 30, 0, TimeSpan.Zero));

    [TestMethod]
    public void ValidRequestReturnsNoContentAndLogsBookingFieldsWithoutTheTokenOnce()
    {
        var logger = new RecordingLogger();
        var result = Post(Request(), logger);

        Assert.IsInstanceOfType<NoContent>(result.Result);
        Assert.AreEqual(StatusCodes.Status204NoContent, ((NoContent)result.Result).StatusCode);
        Assert.HasCount(1, logger.Entries);
        Assert.AreEqual(LogLevel.Information, logger.Entries[0].Level);
        using var payload = JsonDocument.Parse(logger.Entries[0].Payload);
        var json = payload.RootElement;
        Assert.IsFalse(json.TryGetProperty("turnstileToken", out _));
        Assert.AreEqual("Test Renter", json.GetProperty("name").GetString());
        Assert.AreEqual("Test Organisation", json.GetProperty("organisation").GetString());
        Assert.AreEqual("renter@example.org", json.GetProperty("email").GetString());
        Assert.AreEqual("0123456789", json.GetProperty("phone").GetString());
        Assert.AreEqual("beide", json.GetProperty("building").GetString());
        Assert.AreEqual("family", json.GetProperty("groupType").GetString());
        Assert.AreEqual("2027-06-05", json.GetProperty("date").GetString());
        CollectionAssert.AreEqual(new[] { "ochtend", "middag" },
            json.GetProperty("dayparts").EnumerateArray().Select(part => part.GetString()).ToArray());
        Assert.AreEqual(30, json.GetProperty("guests").GetInt32());
        Assert.AreEqual("Booking test", json.GetProperty("remarks").GetString());
    }

    [TestMethod]
    public async Task RejectedAndUnavailableVerificationNeverLogsAReceiptAndReplayIsRejected()
    {
        var logger = new RecordingLogger();
        using var stub = new SiteverifyStub();
        using var client = new HttpClient(stub);
        var verifier = new TurnstileVerifier(client, new("test-secret", ["blokhutdewildert.nl"]));
        var validator = new BookingRequestValidator(Clock);
        var email = new BookingEmailStub();
        Assert.IsInstanceOfType<NoContent>((await BookingEndpoint.Post(Request(), validator, logger, verifier, email, CancellationToken.None)).Result);
        Assert.HasCount(1, logger.Entries);
        logger.Entries.Clear();
        stub.Response = "{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}";
        var replay = await BookingEndpoint.Post(Request(), validator, logger, verifier, email, CancellationToken.None);
        Assert.AreEqual(403, ((ProblemHttpResult)replay.Result).StatusCode);
        stub.Response = "not-json";
        var unavailable = await BookingEndpoint.Post(Request(), validator, logger, verifier, email, CancellationToken.None);
        Assert.AreEqual(503, ((ProblemHttpResult)unavailable.Result).StatusCode);
        Assert.IsEmpty(logger.Entries);
        Assert.AreEqual(1, email.Calls);
        var json = JsonSerializer.Serialize(((ProblemHttpResult)unavailable.Result).ProblemDetails, BookingJsonContext.Default.ProblemDetails);
        Assert.IsTrue(json.Contains("503"));
    }

    [TestMethod]
    public void MissingRequiredFieldsReturnFieldErrorsWithoutLogging()
    {
        var logger = new RecordingLogger();
        var result = Post(new BookingRequestDto(), logger);

        Assert.IsInstanceOfType<ValidationProblem>(result.Result);
        var problem = (ValidationProblem)result.Result;
        Assert.AreEqual(StatusCodes.Status400BadRequest, problem.StatusCode);
        CollectionAssert.AreEquivalent(new[] { "name", "email", "building", "groupType", "date", "dayparts", "guests", "turnstileToken" },
            problem.ProblemDetails.Errors.Keys.ToArray());
        Assert.IsEmpty(logger.Entries);

        // This is also the metadata used to write HTTP errors when reflection is disabled in AOT.
        var json = JsonSerializer.Serialize(problem.ProblemDetails, BookingJsonContext.Default.HttpValidationProblemDetails);
        using var document = JsonDocument.Parse(json);
        Assert.AreEqual(400, document.RootElement.GetProperty("status").GetInt32());
        Assert.IsTrue(document.RootElement.GetProperty("errors").TryGetProperty("groupType", out _));
    }

    [TestMethod]
    [DataRow("name", " ")]
    [DataRow("name", null)]
    [DataRow("email", "invalid")]
    [DataRow("email", "")]
    [DataRow("email", null)]
    [DataRow("building", "unknown")]
    [DataRow("building", "GROOT")]
    [DataRow("building", null)]
    [DataRow("groupType", "unknown")]
    [DataRow("groupType", null)]
    public void InvalidTextFieldIsRejectedWithoutLogging(string field, string? value)
    {
        var fields = JsonSerializer.SerializeToNode(Request(), BookingJsonContext.Default.BookingRequestDto)!;
        fields[field] = value;
        var request = fields.Deserialize(BookingJsonContext.Default.BookingRequestDto)!;
        AssertInvalid(request, field);
    }

    [TestMethod]
    public void EmptyNullUnknownAndDuplicateDaypartsAreRejected()
    {
        foreach (var parts in new string[]?[] { [], null, ["night"], ["ochtend", "ochtend"], [null!] })
        {
            var fields = JsonSerializer.SerializeToNode(Request(), BookingJsonContext.Default.BookingRequestDto)!;
            fields["dayparts"] = JsonSerializer.SerializeToNode(parts, BookingJsonContext.Default.StringArray);
            AssertInvalid(fields.Deserialize(BookingJsonContext.Default.BookingRequestDto)!, "dayparts");
        }
    }

    [TestMethod]
    [DataRow(0)]
    [DataRow(-1)]
    [DataRow(46)]
    public void GuestsOutsideCapacityAreRejected(int guests) => AssertInvalid(Request(guests: guests), "guests");

    [TestMethod]
    [DataRow(1)]
    [DataRow(45)]
    public void GuestBoundariesAndOptionalContactFieldsAreAccepted(int guests)
    {
        var request = new BookingRequestDto
        {
            Name = "Test", Email = "test@example.org", Building = "terrein", GroupType = "other",
            TurnstileToken = "token",
            Date = new DateOnly(2027, 6, 5), Dayparts = ["avond"], Guests = guests,
        };
        Assert.IsEmpty(new BookingRequestValidator(Clock).Validate(request));
    }

    [TestMethod]
    public void DateUsesTheVenueCalendarAndAcceptsTodayAndFutureDates()
    {
        AssertInvalid(Request(date: new DateOnly(2027, 6, 4)), "date");
        var validator = new BookingRequestValidator(Clock);
        Assert.IsEmpty(validator.Validate(Request(date: new DateOnly(2027, 6, 5))));
        Assert.IsEmpty(validator.Validate(Request(date: new DateOnly(2027, 6, 6))));
    }

    [TestMethod]
    [DataRow("groot", "family")]
    [DataRow("klein", "school")]
    [DataRow("beide", "business")]
    [DataRow("terrein", "other")]
    public void SupportedChoicesAreAccepted(string building, string groupType)
    {
        var fields = JsonSerializer.SerializeToNode(Request(), BookingJsonContext.Default.BookingRequestDto)!;
        fields["building"] = building;
        fields["groupType"] = groupType;
        Assert.IsEmpty(new BookingRequestValidator(Clock).Validate(fields.Deserialize(BookingJsonContext.Default.BookingRequestDto)!));
    }

    private static void AssertInvalid(BookingRequestDto request, string field)
    {
        var logger = new RecordingLogger();
        var result = Post(request, logger);
        Assert.IsInstanceOfType<ValidationProblem>(result.Result);
        CollectionAssert.AreEqual(new[] { field }, ((ValidationProblem)result.Result).ProblemDetails.Errors.Keys.ToArray());
        Assert.IsEmpty(logger.Entries);
    }

    [TestMethod]
    public async Task EmailFailureNeverLogsSuccessfulReceipt()
    {
        var logger = new RecordingLogger();
        using var client = new HttpClient(new SiteverifyStub());
        var sender = new BookingEmailStub { Accepted = false };
        var result = await BookingEndpoint.Post(Request(), new BookingRequestValidator(Clock), logger,
            new TurnstileVerifier(client, new("secret", ["blokhutdewildert.nl"])), sender, CancellationToken.None);
        Assert.AreEqual(503, ((ProblemHttpResult)result.Result).StatusCode);
        Assert.AreEqual(1, sender.Calls);
        Assert.IsEmpty(logger.Entries);
    }

    private static BookingRequestDto Request(int guests = 30, DateOnly? date = null) => new()
    {
        TurnstileToken = "token",
        Name = "Test Renter", Organisation = "Test Organisation", Email = "renter@example.org",
        Phone = "0123456789", Building = "beide", GroupType = "family",
        Date = date ?? new DateOnly(2027, 6, 5), Guests = guests,
        Dayparts = ["ochtend", "middag"], Remarks = "Booking test",
    };

    private static Results<NoContent, ValidationProblem, ProblemHttpResult> Post(BookingRequestDto request, RecordingLogger logger)
    {
        using var client = new HttpClient(new SiteverifyStub());
        var verifier = new TurnstileVerifier(client, new("test-secret", ["blokhutdewildert.nl"]));
        return BookingEndpoint.Post(request, new BookingRequestValidator(Clock), logger, verifier, new BookingEmailStub(), CancellationToken.None)
            .GetAwaiter().GetResult();
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class RecordingLogger : ILogger<BookingEndpoint>
    {
        internal List<(LogLevel Level, string Payload)> Entries { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            var fields = (IEnumerable<KeyValuePair<string, object?>>)(object)state!;
            Entries.Add((logLevel, (string)fields.Single(field => field.Key == "BookingRequest").Value!));
        }
    }
}
