// Centralized Production URL Configuration
// Use this for all external-facing links (WhatsApp, document uploads, etc.)

export const APP_DOMAIN = "https://luminaauto.co.za";

/**
 * Generate the secure document upload link for a client
 * @param token - The access token for the finance application
 */
export const getUploadLink = (token: string): string => {
  return `${APP_DOMAIN}/upload-documents/${token}`;
};

/**
 * Generate a vehicle detail link
 * @param vehicleId - The vehicle UUID
 */
export const getVehicleLink = (vehicleId: string): string => {
  return `${APP_DOMAIN}/vehicles/${vehicleId}`;
};

/**
 * Generate the inventory page link
 */
export const getInventoryLink = (): string => {
  return `${APP_DOMAIN}/inventory`;
};

/**
 * Generate the finance application page link
 */
export const getFinanceApplicationLink = (): string => {
  return `${APP_DOMAIN}/finance-application`;
};
