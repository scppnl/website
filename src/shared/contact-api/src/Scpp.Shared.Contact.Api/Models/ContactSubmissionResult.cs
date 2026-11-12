using Scpp.Shared.Contact.Api.Validation;
using Scpp.Shared.Contact.Api.Verification;

namespace Scpp.Shared.Contact.Api.Models;

public sealed record ContactSubmissionResult(ContactValidationResult Validation, VerificationOutcome? Verification);
