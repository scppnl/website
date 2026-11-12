using System.ComponentModel.DataAnnotations;
using Scpp.Foundation.Booking.Contracts;

namespace Scpp.Foundation.Booking.Api.Validation;

internal sealed class BookingRequestValidator(TimeProvider clock)
{
    private static readonly TimeZoneInfo VenueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Amsterdam");
    private static readonly HashSet<string> Buildings = ["groot", "klein", "beide", "terrein"];
    private static readonly HashSet<string> GroupTypes = ["family", "school", "business", "other"];
    private static readonly HashSet<string> Dayparts = ["ochtend", "middag", "avond"];

    internal Dictionary<string, string[]> Validate(BookingRequestDto request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Name))
            errors["name"] = ["Name is required."];
        if (string.IsNullOrWhiteSpace(request.Email) || !new EmailAddressAttribute().IsValid(request.Email))
            errors["email"] = ["A valid email address is required."];
        if (request.Building is null || !Buildings.Contains(request.Building))
            errors["building"] = ["Choose a supported building."];
        if (request.GroupType is null || !GroupTypes.Contains(request.GroupType))
            errors["groupType"] = ["Choose a supported group type."];

        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), VenueTimeZone).DateTime);
        if (request.Date < today)
            errors["date"] = ["Choose today or a future date."];
        if (request.Dayparts is not { Length: > 0 } ||
            request.Dayparts.Any(part => part is null || !Dayparts.Contains(part)) ||
            request.Dayparts.Distinct(StringComparer.Ordinal).Count() != request.Dayparts.Length)
            errors["dayparts"] = ["Choose at least one supported daypart without duplicates."];
        if (request.Guests is < 1 or > 45)
            errors["guests"] = ["Guests must be between 1 and 45."];

        return errors;
    }
}
