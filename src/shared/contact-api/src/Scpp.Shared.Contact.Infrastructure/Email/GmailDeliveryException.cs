namespace Scpp.Shared.Contact.Infrastructure.Email;

// Category is an application-defined value, never a provider response or exception message.
[System.Diagnostics.CodeAnalysis.SuppressMessage("Major Code Smell", "S3871:Exception types should be public",
    Justification = "Private delivery control flow is caught inside the email service; it is not part of the public API.")]
internal sealed class GmailDeliveryException(string category) : Exception
{
    internal string Category { get; } = category;
}
