declare const __CONTACT_API_BASE_URL__: string;
// CONTACT_API_BASE_URL is public build configuration; empty disables submission.
export const environment = { contactApiBaseUrl: typeof __CONTACT_API_BASE_URL__ === "string" ? __CONTACT_API_BASE_URL__ : "" };
