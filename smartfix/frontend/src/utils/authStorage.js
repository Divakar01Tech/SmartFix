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
  let token = localStorage.getItem(STORAGE_KEYS[norm]?.token);
  if (!token && norm === 'worker') {
    token = localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token') || localStorage.getItem('token');
  } else if (!token && norm === 'customer') {
    token = localStorage.getItem('smartfix_customer_token') || localStorage.getItem('smartfix_token') || localStorage.getItem('token');
  } else if (!token && norm === 'admin') {
    token = localStorage.getItem('smartfix_admin_token') || localStorage.getItem('smartfix_token') || localStorage.getItem('token');
  }
  return token || null;
};

/**
 * Retrieve user profile for a specific portal role
 */
export const getPortalUser = (role) => {
  const norm = normalizeRole(role);
  try {
    let raw = localStorage.getItem(STORAGE_KEYS[norm]?.user);
    if (!raw && norm === 'worker') {
      raw = localStorage.getItem('smartfix_worker') || localStorage.getItem('smartfix_user') || localStorage.getItem('user');
    } else if (!raw && norm === 'customer') {
      raw = localStorage.getItem('smartfix_customer') || localStorage.getItem('smartfix_user') || localStorage.getItem('user');
    } else if (!raw && norm === 'admin') {
      raw = localStorage.getItem('smartfix_admin') || localStorage.getItem('smartfix_user') || localStorage.getItem('user');
    }
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
    if (norm === 'worker') {
      localStorage.setItem('smartfix_worker_token', token);
      localStorage.setItem('smartfix_token', token);
    } else if (norm === 'customer') {
      localStorage.setItem('smartfix_customer_token', token);
      localStorage.setItem('smartfix_token', token);
    } else if (norm === 'admin') {
      localStorage.setItem('smartfix_admin_token', token);
      localStorage.setItem('smartfix_token', token);
    }
  }
  if (user) {
    const userStr = typeof user === 'string' ? user : JSON.stringify(user);
    localStorage.setItem(STORAGE_KEYS[norm].user, userStr);
    if (norm === 'worker') {
      localStorage.setItem('smartfix_worker', userStr);
      localStorage.setItem('smartfix_user', userStr);
    } else if (norm === 'customer') {
      localStorage.setItem('smartfix_customer', userStr);
      localStorage.setItem('smartfix_user', userStr);
    } else if (norm === 'admin') {
      localStorage.setItem('smartfix_admin', userStr);
      localStorage.setItem('smartfix_user', userStr);
    }
  }
};

/**
 * Clear ONLY the specified portal role's keys
 */
export const clearPortalAuth = (role) => {
  const norm = normalizeRole(role);
  localStorage.removeItem(STORAGE_KEYS[norm].token);
  localStorage.removeItem(STORAGE_KEYS[norm].user);
  if (norm === 'worker') {
    localStorage.removeItem('smartfix_worker_token');
    localStorage.removeItem('smartfix_worker');
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
    localStorage.removeItem('worker_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } else if (norm === 'customer') {
    localStorage.removeItem('smartfix_customer_token');
    localStorage.removeItem('smartfix_customer');
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } else if (norm === 'admin') {
    localStorage.removeItem('smartfix_admin_token');
    localStorage.removeItem('smartfix_admin');
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
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
