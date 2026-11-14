declare const __BOOKING_API_BASE_URL__: string;

// Set BOOKING_API_BASE_URL only after live email delivery has been verified.
export const environment = {
  contactApiBaseUrl: '',
  bookingApiBaseUrl: typeof __BOOKING_API_BASE_URL__ === 'string' ? __BOOKING_API_BASE_URL__ : '',
};
