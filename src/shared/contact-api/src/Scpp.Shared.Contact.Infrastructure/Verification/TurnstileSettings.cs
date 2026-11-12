namespace Scpp.Shared.Contact.Infrastructure.Verification;

public sealed record TurnstileSettings(string SecretKey, HashSet<string> AllowedHostnames);
