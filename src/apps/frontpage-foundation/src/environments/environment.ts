declare const __CONTACT_API_BASE_URL__: string;
declare const __BOOKING_API_BASE_URL__: string;

// Set BOOKING_API_BASE_URL only after live email delivery has been verified.
export const environment = {
  contactApiBaseUrl: typeof __CONTACT_API_BASE_URL__ === 'string' ? __CONTACT_API_BASE_URL__ : '',
  bookingApiBaseUrl: typeof __BOOKING_API_BASE_URL__ === 'string' ? __BOOKING_API_BASE_URL__ : '',
};
