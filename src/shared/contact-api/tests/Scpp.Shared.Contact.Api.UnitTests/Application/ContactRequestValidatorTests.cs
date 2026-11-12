using Microsoft.VisualStudio.TestTools.UnitTesting;
using Scpp.Shared.Contact.Application.Validation;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.UnitTests.Application;

[TestClass]
public sealed class ContactRequestValidatorTests
{
    private static ContactRequest Valid(string source = "foundation") =>
        new(source, " Jan Jansen ", " jan@example.nl ", " Hello\nworld ",
            source == "association" ? " Piet " : null,
            source == "foundation" ? " 0164 123456 " : null,
            source == "foundation" ? "question" : null);

    [TestMethod]
    [DataRow("association")]
    [DataRow("foundation")]
    public void ProducesNormalizedSubmissionWithoutChangingRequest(string source)
    {
        var request = Valid(source) with { Source = $" {source} " };
        var result = ContactRequestValidator.Validate(request);

        Assert.IsEmpty(result.Errors);
        Assert.AreEqual(new ContactSubmission(source, "Jan Jansen", "jan@example.nl", "Hello\nworld",
            source == "association" ? "Piet" : null,
            source == "foundation" ? "0164 123456" : null,
            source == "foundation" ? "question" : null), result.Submission);
        Assert.AreEqual(" Jan Jansen ", request.Name);
    }

    [TestMethod]
    public void NormalizesBlankOptionalValues()
    {
        var result = ContactRequestValidator.Validate(Valid("association") with
        {
            Phone = "  ", ChildName = " ", Subject = "\t"
        });

        Assert.IsEmpty(result.Errors);
        Assert.IsNotNull(result.Submission);
        Assert.IsNull(result.Submission.Phone);
        Assert.IsNull(result.Submission.ChildName);
        Assert.IsNull(result.Submission.Subject);
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow(" \t\n ")]
    public void MissingRequiredFieldsReturnErrorsWithoutSubmission(string? value)
    {
        var result = ContactRequestValidator.Validate(Valid() with { Name = value, Email = value, Message = value });

        Assert.IsNull(result.Submission);
        Assert.HasCount(3, result.Errors);
        foreach (var field in new[] { "name", "email", "message" })
        {
            CollectionAssert.AreEqual(new[] { "This field is required." }, result.Errors[field]);
        }
    }

    [TestMethod]
    [DataRow("name", 200)]
    [DataRow("email", 254)]
    [DataRow("message", 10000)]
    [DataRow("childName", 200)]
    [DataRow("phone", 50)]
    public void EnforcesLengthBoundariesAfterTrimming(string field, int max)
    {
        ContactRequest Set(int length)
        {
            var value = field == "email" ? new string('a', length - 5) + "@b.nl" : new string('x', length);
            value = " " + value + " ";
            return field switch
            {
                "name" => Valid() with { Name = value },
                "email" => Valid() with { Email = value },
                "message" => Valid() with { Message = value },
                "childName" => Valid() with { ChildName = value },
                _ => Valid() with { Phone = value }
            };
        }

        Assert.IsNotNull(ContactRequestValidator.Validate(Set(max)).Submission);
        var rejected = ContactRequestValidator.Validate(Set(max + 1));
        Assert.IsNull(rejected.Submission);
        CollectionAssert.AreEqual(new[] { $"Use at most {max} characters." }, rejected.Errors[field]);
    }

    [TestMethod]
    [DataRow("invalid")]
    [DataRow("invalid address@example.nl")]
    public void PreservesEmailErrorMessage(string email)
    {
        var result = ContactRequestValidator.Validate(Valid() with { Email = email });

        Assert.IsNull(result.Submission);
        CollectionAssert.AreEqual(new[] { "Enter a valid email address." }, result.Errors["email"]);
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow("other")]
    [DataRow("Foundation")]
    public void PreservesSourceErrorMessage(string? source)
    {
        var result = ContactRequestValidator.Validate(Valid() with { Source = source });

        Assert.IsNull(result.Submission);
        CollectionAssert.AreEqual(new[] { "Choose association or foundation." }, result.Errors["source"]);
    }

    [TestMethod]
    [DataRow(null)]
    [DataRow(" ")]
    [DataRow("bad")]
    public void RequiresValidFoundationSubject(string? subject)
    {
        var result = ContactRequestValidator.Validate(Valid() with { Subject = subject });

        Assert.IsNull(result.Submission);
        CollectionAssert.AreEqual(new[] { "Choose question, viewing or other." }, result.Errors["subject"]);
    }

    [TestMethod]
    [DataRow("question")]
    [DataRow("viewing")]
    [DataRow("other")]
    public void AcceptsTrimmedFoundationSubjects(string subject)
    {
        var result = ContactRequestValidator.Validate(Valid() with { Subject = $" {subject} " });

        Assert.IsEmpty(result.Errors);
        Assert.IsNotNull(result.Submission);
        Assert.AreEqual(subject, result.Submission.Subject);
    }

    [TestMethod]
    public void RejectsAssociationSubject()
    {
        var result = ContactRequestValidator.Validate(Valid("association") with { Subject = "question" });

        Assert.IsNull(result.Submission);
        CollectionAssert.AreEqual(new[] { "Omit subject for association requests." }, result.Errors["subject"]);
    }
}
