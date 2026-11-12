import { InjectionToken } from "@angular/core";
import { environment } from "../environments/environment";

export const CONTACT_API_BASE_URL = new InjectionToken<string>(
    "CONTACT_API_BASE_URL",
    {
        providedIn: "root",
        factory: () => environment.contactApiBaseUrl,
    },
);
