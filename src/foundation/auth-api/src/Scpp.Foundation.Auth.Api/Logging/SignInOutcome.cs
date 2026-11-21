namespace Scpp.Foundation.Auth.Api.Logging;

/// <summary>The only facts logged about a sign-in attempt.</summary>
internal enum SignInOutcome
{
    Success,
    WrongDomain,
    NotAuthorized,
    EmailUnverified,
    InvalidState,
    Cancelled,
    CodeRejected,
    InvalidToken,
    ProviderUnavailable,
}
