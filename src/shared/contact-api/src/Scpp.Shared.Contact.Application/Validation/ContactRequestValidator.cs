using System.ComponentModel.DataAnnotations;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Application.Validation;

public static class ContactRequestValidator
{
    public static ContactValidationResult Validate(ContactRequest request)
    {
        static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var normalized = request with
        {
            Source = Clean(request.Source), Name = Clean(request.Name), Email = Clean(request.Email),
            Message = Clean(request.Message), ChildName = Clean(request.ChildName),
            Phone = Clean(request.Phone), Subject = Clean(request.Subject)
        };
        var errors = new Dictionary<string, string[]>();
        void Field(string key, string? value, int max, bool required = false)
        {
            if (required && value is null)
            {
                errors[key] = ["This field is required."];
            }
            else if (value?.Length > max)
            {
                errors[key] = [$"Use at most {max} characters."];
            }
        }
        Field("name", normalized.Name, 200, true);
        Field("email", normalized.Email, 254, true);
        Field("message", normalized.Message, 10_000, true);
        Field("childName", normalized.ChildName, 200);
        Field("phone", normalized.Phone, 50);
        if (string.IsNullOrWhiteSpace(request.TurnstileToken))
        {
            errors["turnstileToken"] = ["Verification is required."];
        }
        else if (request.TurnstileToken.Length > 2048)
        {
            errors["turnstileToken"] = ["Invalid verification token."];
        }
        if (normalized.Email is not null && (!new EmailAddressAttribute().IsValid(normalized.Email) || normalized.Email.Any(char.IsWhiteSpace)))
        {
            errors["email"] = ["Enter a valid email address."];
        }
        if (normalized.Source is not ("association" or "foundation"))
        {
            errors["source"] = ["Choose association or foundation."];
        }
        if (normalized.Source == "foundation" && normalized.Subject is not ("question" or "viewing" or "other"))
        {
            errors["subject"] = ["Choose question, viewing or other."];
        }
        if (normalized.Source == "association" && normalized.Subject is not null)
        {
            errors["subject"] = ["Omit subject for association requests."];
        }

        var submission = errors.Count == 0
            ? new ContactSubmission(normalized.Source!, normalized.Name!, normalized.Email!, normalized.Message!,
                normalized.ChildName, normalized.Phone, normalized.Subject)
            : null;
        return new ContactValidationResult(submission, errors);
    }
}
