/**
 * Utility to mask phone numbers for customer safety & security.
 * Encourages customers to use the website's built-in WebRTC In-App Voice Call feature.
 */
export const maskPhone = (phone) => {
  if (!phone) return '🔒 Secured (In-App Call Available)';
  const str = String(phone).trim();
  if (str.length <= 5) return '🔒 Secured (In-App Call Available)';
  // E.g. "+91 98765 *****"
  return `${str.slice(0, 8)}***** (In-App Call Only)`;
};

export const MASKED_PHONE_LABEL = '🔒 Secured Number (Use In-App Call)';
