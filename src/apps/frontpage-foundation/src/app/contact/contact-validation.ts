import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const requiredText: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

export const trimmedEmail: ValidatorFn = (control) =>
  Validators.email({ value: control.value?.trim() } as AbstractControl);

export const trimmedMaxLength =
  (max: number): ValidatorFn =>
  (control) =>
    control.value?.trim().length > max ? { maxlength: { requiredLength: max } } : null;

export function contactError(control: AbstractControl | null): string {
  const errors: ValidationErrors = control?.errors ?? {};
  if (errors['required']) return 'Vul dit veld in.';
  if (errors['email']) return 'Vul een geldig e-mailadres in.';
  if (errors['maxlength']) return `Gebruik maximaal ${errors['maxlength'].requiredLength} tekens.`;
  return 'Controleer dit veld.';
}
