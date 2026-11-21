declare const __CONTACT_API_BASE_URL__: string;
declare const __BOOKING_API_BASE_URL__: string;
declare const __AUTH_API_BASE_URL__: string;

// Set BOOKING_API_BASE_URL only after live email delivery has been verified.
// An empty AUTH_API_BASE_URL disables the Google sign-in button.
export const environment = {
  contactApiBaseUrl: typeof __CONTACT_API_BASE_URL__ === 'string' ? __CONTACT_API_BASE_URL__ : '',
  bookingApiBaseUrl: typeof __BOOKING_API_BASE_URL__ === 'string' ? __BOOKING_API_BASE_URL__ : '',
  authApiBaseUrl: typeof __AUTH_API_BASE_URL__ === 'string' ? __AUTH_API_BASE_URL__ : '',
};
