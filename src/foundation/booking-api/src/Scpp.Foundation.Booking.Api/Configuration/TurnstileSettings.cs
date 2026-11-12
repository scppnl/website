namespace Scpp.Foundation.Booking.Api.Configuration;

internal sealed record TurnstileSettings(string SecretKey, HashSet<string> AllowedHostnames)
{
    internal static TurnstileSettings Load(IConfiguration configuration, IHostEnvironment environment)
    {
        var secret = configuration["BOOKING_TURNSTILE_SECRET_KEY"];
        var hostnames = configuration.GetSection("Turnstile:AllowedHostnames").GetChildren()
            .Select(child => child.Value ?? "").ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(secret) || hostnames.Count == 0 ||
            hostnames.Any(host => Uri.CheckHostName(host) == UriHostNameType.Unknown || host.Contains('*')) ||
            (!environment.IsDevelopment() &&
                (secret is "1x0000000000000000000000000000000AA" or "2x0000000000000000000000000000000AA" or "3x0000000000000000000000000000000AA" ||
                 hostnames.Any(host => host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                     System.Net.IPAddress.TryParse(host, out var address) && System.Net.IPAddress.IsLoopback(address)))))
            throw new InvalidOperationException("Configure BOOKING_TURNSTILE_SECRET_KEY and Turnstile:AllowedHostnames. Production must not use test secrets or loopback hostnames.");
        return new(secret, hostnames);
    }
}
