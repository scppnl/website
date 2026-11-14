namespace Scpp.Shared.Contact.Infrastructure.Email;

// Category is an application-defined value, never a provider response or exception message.
internal sealed class GmailDeliveryException(string category) : Exception
{
    internal string Category { get; } = category;
}
