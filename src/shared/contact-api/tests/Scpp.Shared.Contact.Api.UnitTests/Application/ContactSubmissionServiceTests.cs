using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Shared.Contact.Application.Verification;
using Scpp.Shared.Contact.Application.Services;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.UnitTests.Application;

[TestClass]
public sealed class ContactSubmissionServiceTests
{
    private static ContactRequest Valid() => new("foundation", " Jan ", " jan@example.nl ", " Hello ", Subject: "question", TurnstileToken: "test-token");

    [TestMethod]
    public async Task SendsNormalizedSubmissionOnceAndForwardsTraceAndCancellationToken()
    {
        var sink = new RecordingSink();
        var verifier = new RecordingVerificationService();
        var service = new ContactSubmissionService(sink, verifier);
        using var cancellation = new CancellationTokenSource();

        var result = await service.SubmitAsync(Valid(), "test-trace", cancellation.Token);

        Assert.IsEmpty(result.Validation.Errors);
        Assert.AreEqual(new ContactSubmission("foundation", "Jan", "jan@example.nl", "Hello", Subject: "question"),
            result.Validation.Submission);
        Assert.AreEqual(1, sink.Calls);
        Assert.AreSame(result.Validation.Submission, sink.Submission);
        Assert.AreEqual("test-trace", sink.TraceId);
        Assert.AreEqual(cancellation.Token, sink.CancellationToken);
        Assert.AreEqual(VerificationOutcome.Accepted, result.Verification);
        Assert.AreEqual(1, verifier.Calls);
        Assert.AreEqual("test-token", verifier.Token);
        Assert.AreEqual("test-trace", verifier.TraceId);
        Assert.AreEqual(cancellation.Token, verifier.CancellationToken);
    }

    [TestMethod]
    public async Task InvalidRequestNeverReachesSink()
    {
        var sink = new RecordingSink();
        var verifier = new RecordingVerificationService();
        var service = new ContactSubmissionService(sink, verifier);

        var result = await service.SubmitAsync(Valid() with { Email = "invalid" }, "test-trace", CancellationToken.None);

        Assert.IsNull(result.Validation.Submission);
        Assert.IsTrue(result.Validation.Errors.ContainsKey("email"));
        Assert.AreEqual(0, sink.Calls);
        Assert.AreEqual(0, verifier.Calls);
        Assert.IsNull(result.Verification);
    }

    [TestMethod]
    [DataRow(VerificationOutcome.Rejected)]
    [DataRow(VerificationOutcome.Unavailable)]
    public async Task UnverifiedSubmissionNeverReachesSink(VerificationOutcome outcome)
    {
        var sink = new RecordingSink();
        var verifier = new RecordingVerificationService { Outcome = outcome };
        var service = new ContactSubmissionService(sink, verifier);

        var result = await service.SubmitAsync(Valid(), "test-trace", CancellationToken.None);

        Assert.IsEmpty(result.Validation.Errors);
        Assert.AreEqual(outcome, result.Verification);
        Assert.AreEqual(1, verifier.Calls);
        Assert.AreEqual(0, sink.Calls);
    }

    [TestMethod]
    public async Task WaitsForSinkCompletionBeforeReturningSuccess()
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var sink = new RecordingSink { Completion = completion.Task };
        var service = new ContactSubmissionService(sink, new RecordingVerificationService());

        var pending = service.SubmitAsync(Valid(), "test-trace", CancellationToken.None);

        Assert.AreEqual(1, sink.Calls);
        Assert.IsFalse(pending.IsCompleted);
        completion.SetResult();
        var result = await pending;
        Assert.IsEmpty(result.Validation.Errors);
    }

    [TestMethod]
    public async Task PropagatesSinkFailures()
    {
        var failure = new InvalidOperationException("Submission failed");
        var sink = new RecordingSink { Completion = Task.FromException(failure) };
        var service = new ContactSubmissionService(sink, new RecordingVerificationService());

        var thrown = await Assert.ThrowsExactlyAsync<InvalidOperationException>(
            () => service.SubmitAsync(Valid(), "test-trace", CancellationToken.None));

        Assert.AreSame(failure, thrown);
        Assert.AreEqual(1, sink.Calls);
    }
}
