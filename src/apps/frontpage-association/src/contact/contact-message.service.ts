import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { ContactMessage } from "./contact-message";
import { CONTACT_API_BASE_URL } from "./contact-api-config";

@Injectable({ providedIn: "root" })
export class ContactMessageService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = inject(CONTACT_API_BASE_URL)
        .trim()
        .replace(/\/+$/, "");
    readonly available = this.baseUrl.length > 0;

    async submit(message: ContactMessage): Promise<void> {
        if (!this.available) throw new Error("Contact API is not configured");
        await firstValueFrom(
            this.http.post<void>(`${this.baseUrl}/contact`, {
                ...message,
                source: "association",
            }),
        );
    }
}
