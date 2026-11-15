using System.Text.Json;
using Scpp.Shared.Contact.Api.Serialization;
using Scpp.Shared.Contact.Api.Validation;

namespace Scpp.Shared.Contact.Api.UnitTests.Validation;

[TestClass]
public sealed class ContactSerializationTests
{
    [TestMethod]
    [DataRow("{}")]
    [DataRow("{\"source\":null,\"name\":null,\"email\":null,\"message\":null,\"turnstileToken\":null}")]
    public void MissingAndNullFieldsRemainValidationErrors(string json)
    {
        var request = JsonSerializer.Deserialize(json, ContactJsonContext.Default.ContactRequest)!;
        Assert.IsNull(request.ChildName);
        Assert.IsNull(request.Phone);
        Assert.IsNull(request.Subject);
        var result = ContactRequestValidator.Validate(request);
        Assert.IsNull(result.Submission);
        CollectionAssert.AreEquivalent(new[] { "name", "email", "message", "turnstileToken", "source" },
            result.Errors.Keys.ToArray());
        Assert.AreEqual("This field is required.", result.Errors["email"].Single());
        Assert.AreEqual("Verification is required.", result.Errors["turnstileToken"].Single());
    }

    [TestMethod]
    public void SuppliedFieldsRoundTripThroughGeneratedJsonMetadata()
    {
        const string json = """
            {"source":"foundation","name":"Jan","email":"jan@example.nl","message":"Hello",
             "childName":"Piet","phone":"0123456789","subject":"question","turnstileToken":"token"}
            """;
        var request = JsonSerializer.Deserialize(json, ContactJsonContext.Default.ContactRequest)!;
        var serialized = JsonSerializer.Serialize(request, ContactJsonContext.Default.ContactRequest);
        Assert.AreEqual(request, JsonSerializer.Deserialize(serialized, ContactJsonContext.Default.ContactRequest));
        Assert.IsEmpty(ContactRequestValidator.Validate(request).Errors);
        using var document = JsonDocument.Parse(serialized);
        Assert.AreEqual("token", document.RootElement.GetProperty("turnstileToken").GetString());
    }
}
