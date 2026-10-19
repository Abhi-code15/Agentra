import { authService } from './auth-service.js';
import { userRepository } from '../users/user-repository.js';
import { generateCsrfToken } from './auth-utils.js';
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  updateProfileSchema
} from './auth-schemas.js';
import { config } from '../../config/env.js';

function setAuthCookies(res, sessionToken) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
    path: '/'
  };

  res.cookie('agentra_session', sessionToken, cookieOptions);

  // Generate and set CSRF cookie (accessible to client JS to mirror in header)
  const csrfToken = generateCsrfToken();
  res.cookie('agentra_csrf', csrfToken, {
    httpOnly: false,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
    path: '/'
  });

  return csrfToken;
}

function clearAuthCookies(res) {
  const clearOptions = {
    path: '/',
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE
  };
  res.clearCookie('agentra_session', clearOptions);
  res.clearCookie('agentra_csrf', { ...clearOptions, httpOnly: false });
}

export class AuthController {
  async register(req, res, next) {
    try {
      const data = registerSchema.parse(req.body);
      const { user, sessionToken } = await authService.register(data);
      const csrfToken = setAuthCookies(res, sessionToken);

      res.status(201).json({
        user,
        csrfToken,
        token: sessionToken
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const data = loginSchema.parse(req.body);
      const { user, sessionToken } = await authService.login(data);
      const csrfToken = setAuthCookies(res, sessionToken);

      res.status(200).json({
        user,
        csrfToken,
        token: sessionToken
      });
    } catch (err) {
      next(err);
    }
  }

  async google(req, res, next) {
    try {
      const { credential } = googleAuthSchema.parse(req.body);
      const { user, sessionToken } = await authService.authenticateGoogle(credential);
      const csrfToken = setAuthCookies(res, sessionToken);

      res.status(200).json({
        user,
        csrfToken,
        token: sessionToken
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      if (req.sessionToken) {
        await authService.logout(req.sessionToken);
      }
      clearAuthCookies(res);
      res.status(200).json({ message: 'Successfully logged out' });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const user = await userRepository.findById(req.user.id);
      // Ensure CSRF token is refreshed or available in cookie
      let csrfToken = req.cookies?.agentra_csrf;
      if (!csrfToken) {
        csrfToken = generateCsrfToken();
        res.cookie('agentra_csrf', csrfToken, {
          httpOnly: false,
          secure: config.COOKIE_SECURE,
          sameSite: config.COOKIE_SAME_SITE,
          maxAge: config.SESSION_TTL_HOURS * 3600 * 1000,
          path: '/'
        });
      }

      res.status(200).json({
        user,
        csrfToken
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const data = updateProfileSchema.parse(req.body);
      const updated = await userRepository.updateUser(req.user.id, data);
      res.status(200).json({ user: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
