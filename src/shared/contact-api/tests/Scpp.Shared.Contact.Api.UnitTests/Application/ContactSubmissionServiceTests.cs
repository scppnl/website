using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Shared.Contact.Application.Interfaces;
using Scpp.Shared.Contact.Application.Services;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.UnitTests.Application;

[TestClass]
public sealed class ContactSubmissionServiceTests
{
    private static ContactRequest Valid() => new("foundation", " Jan ", " jan@example.nl ", " Hello ", Subject: "question");

    [TestMethod]
    public async Task SendsNormalizedSubmissionOnceAndForwardsTraceAndCancellationToken()
    {
        var sink = new RecordingSink();
        var service = new ContactSubmissionService(sink);
        using var cancellation = new CancellationTokenSource();

        var result = await service.SubmitAsync(Valid(), "test-trace", cancellation.Token);

        Assert.IsEmpty(result.Errors);
        Assert.AreEqual(new ContactSubmission("foundation", "Jan", "jan@example.nl", "Hello", Subject: "question"),
            result.Submission);
        Assert.AreEqual(1, sink.Calls);
        Assert.AreSame(result.Submission, sink.Submission);
        Assert.AreEqual("test-trace", sink.TraceId);
        Assert.AreEqual(cancellation.Token, sink.CancellationToken);
    }

    [TestMethod]
    public async Task InvalidRequestNeverReachesSink()
    {
        var sink = new RecordingSink();
        var service = new ContactSubmissionService(sink);

        var result = await service.SubmitAsync(Valid() with { Email = "invalid" }, "test-trace", CancellationToken.None);

        Assert.IsNull(result.Submission);
        Assert.IsTrue(result.Errors.ContainsKey("email"));
        Assert.AreEqual(0, sink.Calls);
    }

    [TestMethod]
    public async Task WaitsForSinkCompletionBeforeReturningSuccess()
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var sink = new RecordingSink { Completion = completion.Task };
        var service = new ContactSubmissionService(sink);

        var pending = service.SubmitAsync(Valid(), "test-trace", CancellationToken.None);

        Assert.AreEqual(1, sink.Calls);
        Assert.IsFalse(pending.IsCompleted);
        completion.SetResult();
        var result = await pending;
        Assert.IsEmpty(result.Errors);
    }

    [TestMethod]
    public async Task PropagatesSinkFailures()
    {
        var failure = new InvalidOperationException("Submission failed");
        var sink = new RecordingSink { Completion = Task.FromException(failure) };
        var service = new ContactSubmissionService(sink);

        var thrown = await Assert.ThrowsExactlyAsync<InvalidOperationException>(
            () => service.SubmitAsync(Valid(), "test-trace", CancellationToken.None));

        Assert.AreSame(failure, thrown);
        Assert.AreEqual(1, sink.Calls);
    }

    private sealed class RecordingSink : IContactSubmissionSink
    {
        internal int Calls { get; private set; }
        internal ContactSubmission? Submission { get; private set; }
        internal string? TraceId { get; private set; }
        internal CancellationToken CancellationToken { get; private set; }
        internal Task Completion { get; init; } = Task.CompletedTask;

        public Task SubmitAsync(ContactSubmission submission, string traceId, CancellationToken cancellationToken)
        {
            Calls++;
            Submission = submission;
            TraceId = traceId;
            CancellationToken = cancellationToken;
            return Completion;
        }
    }
}
