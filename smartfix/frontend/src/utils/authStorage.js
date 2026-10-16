/**
 * SmartFix Multi-Role Isolated Authentication Storage
 * Strictly uses separate localStorage keys per portal role.
 * Never shares a global "token" or "user" key.
 */

export const STORAGE_KEYS = {
  customer: {
    token: 'hm_customer_token',
    user: 'hm_customer_user',
  },
  worker: {
    token: 'hm_worker_token',
    user: 'hm_worker_user',
  },
  admin: {
    token: 'hm_admin_token',
    user: 'hm_admin_user',
  },
};

/**
 * Normalizes role to 'customer' | 'worker' | 'admin'
 */
export const normalizeRole = (role) => {
  if (!role) return 'customer';
  const r = role.toString().toLowerCase().trim();
  if (r === 'handyman' || r === 'worker') return 'worker';
  if (r === 'admin') return 'admin';
  return 'customer';
};

/**
 * Retrieve token for a specific portal role
 */
export const getPortalToken = (role) => {
  const norm = normalizeRole(role);
  return localStorage.getItem(STORAGE_KEYS[norm].token) || null;
};

/**
 * Retrieve user profile for a specific portal role
 */
export const getPortalUser = (role) => {
  const norm = normalizeRole(role);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[norm].user);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};

/**
 * Store credentials exclusively in that portal role's namespace
 */
export const setPortalAuth = (role, token, user) => {
  const norm = normalizeRole(role);
  if (token) {
    localStorage.setItem(STORAGE_KEYS[norm].token, token);
  }
  if (user) {
    localStorage.setItem(STORAGE_KEYS[norm].user, JSON.stringify(user));
  }
};

/**
 * Clear ONLY the specified portal role's keys
 */
export const clearPortalAuth = (role) => {
  const norm = normalizeRole(role);
  localStorage.removeItem(STORAGE_KEYS[norm].token);
  localStorage.removeItem(STORAGE_KEYS[norm].user);
};

/**
 * Decode JWT payload and verify expiration
 */
export const parseJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);

    // Check expiration if present
    if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
      return null; // Expired
    }

    return decoded;
  } catch (err) {
    return null;
  }
};

/**
 * Verify if a valid, unexpired token exists for this portal with matching role
 */
export const isPortalAuthenticated = (role) => {
  const norm = normalizeRole(role);
  const token = getPortalToken(norm);
  if (!token) return false;

  const payload = parseJwt(token);
  if (!payload) return false;

  const tokenRole = normalizeRole(payload.role);
  return tokenRole === norm;
};
