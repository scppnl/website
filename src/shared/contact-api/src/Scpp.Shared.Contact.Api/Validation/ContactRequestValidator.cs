using Scpp.Shared.Contact.Infrastructure.Email;
using Scpp.Shared.Contact.Domain.Models;
using Scpp.Shared.Contact.Models;

namespace Scpp.Shared.Contact.Api.Validation;

public static class ContactRequestValidator
{
    public static ContactValidationResult Validate(ContactRequest request)
    {
        var normalized = Normalize(request);
        var errors = new Dictionary<string, string[]>();
        ValidateFields(normalized, errors);
        ValidateToken(request.TurnstileToken, errors);
        if (normalized.Email is not null && normalized.Email.Length <= 254 && !MailboxAddress.IsValid(normalized.Email))
        {
            errors["email"] = ["Enter a valid email address."];
        }
        ValidateRouting(normalized, errors);
        var submission = errors.Count == 0
            ? new ContactSubmission(normalized.Source!, normalized.Name!, normalized.Email!, normalized.Message!,
                normalized.ChildName, normalized.Phone, normalized.Subject)
            : null;
        return new ContactValidationResult(submission, errors);
    }

    private static ContactRequest Normalize(ContactRequest request)
    {
        static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        return request with {
            Source = Clean(request.Source), Name = Clean(request.Name), Email = Clean(request.Email),
            Message = Clean(request.Message), ChildName = Clean(request.ChildName),
            Phone = Clean(request.Phone), Subject = Clean(request.Subject)
        };
    }

    private static void ValidateFields(ContactRequest request, Dictionary<string, string[]> errors)
    {
        void Field(string key, string? value, int max, bool required = false)
        {
            if (required && value is null)
            {
                errors[key] = ["This field is required."];
                return;
            }
            if (value?.Length > max)
            {
                errors[key] = [$"Use at most {max} characters."];
            }
        }
        Field("name", request.Name, 200, true);
        Field("email", request.Email, 254, true);
        Field("message", request.Message, 10_000, true);
        Field("childName", request.ChildName, 200);
        Field("phone", request.Phone, 50);
    }

    private static void ValidateToken(string? token, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            errors["turnstileToken"] = ["Verification is required."];
            return;
        }
        if (token.Length > 2048)
        {
            errors["turnstileToken"] = ["Invalid verification token."];
        }
    }

    private static void ValidateRouting(ContactRequest request, Dictionary<string, string[]> errors)
    {
        if (request.Source is not ("association" or "foundation"))
        {
            errors["source"] = ["Choose association or foundation."];
        }
        if (request.Source == "foundation" && request.Subject is not ("question" or "viewing" or "other"))
        {
            errors["subject"] = ["Choose question, viewing or other."];
        }
        if (request.Source == "association" && request.Subject is not null)
        {
            errors["subject"] = ["Omit subject for association requests."];
        }
    }
}
