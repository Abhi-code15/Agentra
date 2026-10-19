import { authService } from '../modules/auth/auth-service.js';
import { UnauthorizedError, ForbiddenError } from '../shared/errors.js';

export function extractSessionToken(req) {
  if (req.cookies && req.cookies.agentra_session) {
    return req.cookies.agentra_session;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const sessionData = await authService.validateSession(token);
    if (!sessionData) {
      throw new UnauthorizedError('Session expired or invalid');
    }

    req.user = sessionData.user;
    req.sessionId = sessionData.sessionId;
    req.sessionToken = token;

    // CSRF protection for cookie-based state-changing requests
    if (req.cookies && req.cookies.agentra_session && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const csrfCookie = req.cookies.agentra_csrf;
      const csrfHeader = req.headers['x-csrf-token'];
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        throw new ForbiddenError('Invalid or missing CSRF token');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = extractSessionToken(req);
    if (token) {
      const sessionData = await authService.validateSession(token);
      if (sessionData) {
        req.user = sessionData.user;
        req.sessionId = sessionData.sessionId;
        req.sessionToken = token;
      }
    }
    next();
  } catch {
    next();
  }
}
