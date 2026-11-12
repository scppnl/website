using Scpp.Shared.Contact.Application.Validation;
using Scpp.Shared.Contact.Application.Verification;

namespace Scpp.Shared.Contact.Application.Models;

public sealed record ContactSubmissionResult(ContactValidationResult Validation, VerificationOutcome? Verification);
