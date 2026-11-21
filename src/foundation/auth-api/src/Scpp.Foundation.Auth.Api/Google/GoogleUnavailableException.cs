namespace Scpp.Foundation.Auth.Api.Google;

/// <summary>Google could not be reached or answered unusably; the sign-in can be retried.</summary>
public sealed class GoogleUnavailableException : Exception
{
    internal GoogleUnavailableException(GoogleFailureCategory category, Exception? inner = null)
        : base("Google sign-in is unavailable.", inner)
    {
        Category = category;
    }

    internal GoogleFailureCategory Category { get; }
}
