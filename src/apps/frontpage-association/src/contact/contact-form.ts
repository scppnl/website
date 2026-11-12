import { Component, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { NonNullableFormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ContactMessageService } from "./contact-message.service";
import {
    contactError,
    requiredText,
    trimmedEmail,
    trimmedMaxLength,
} from "./contact-validation";

@Component({
    selector: "contact-form",
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: "./contact-form.html",
    styles: [
        "fieldset { border: 0; padding: 0; margin: 0; min-width: 0; } .error { color: #8b241d; font-size: 14px; }",
    ],
})
export class ContactForm {
    private readonly service = inject(ContactMessageService);
    protected readonly available = this.service.available;
    protected readonly status = signal<
        "idle" | "submitting" | "success" | "error"
    >("idle");
    protected readonly form = inject(NonNullableFormBuilder).group({
        name: ["", [requiredText, trimmedMaxLength(200)]],
        email: ["", [requiredText, trimmedEmail, trimmedMaxLength(254)]],
        childName: ["", trimmedMaxLength(200)],
        message: ["", [requiredText, trimmedMaxLength(10000)]],
    });

    protected showError(key: string): boolean {
        const control = this.form.get(key);
        return !!control && control.invalid && control.touched;
    }

    protected errorMessage(key: string): string {
        return contactError(this.form.get(key));
    }

    protected async submit(): Promise<void> {
        if (!this.available || this.status() === "submitting") return;
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const message = this.form.getRawValue();
        this.status.set("submitting");
        this.form.disable();
        try {
            await this.service.submit(message);
            this.form.reset();
            this.status.set("success");
        } catch (error) {
            this.form.enable();
            if (error instanceof HttpErrorResponse && error.status === 400) {
                for (const key of Object.keys(error.error?.errors ?? {})) {
                    const control = this.form.get(key);
                    control?.setErrors({ server: true });
                    control?.markAsTouched();
                }
            }
            this.status.set("error");
        } finally {
            if (this.form.disabled) this.form.enable();
        }
    }
}
