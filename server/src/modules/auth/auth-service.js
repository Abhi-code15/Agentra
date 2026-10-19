import { OAuth2Client } from 'google-auth-library';
import { userRepository } from '../users/user-repository.js';
import { sessionRepository } from './session-repository.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken
} from './auth-utils.js';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  BadRequestError
} from '../../shared/errors.js';
import { withTransaction } from '../../db/pool.js';
import { config } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

export class AuthService {
  constructor() {
    this.googleClient = config.GOOGLE_CLIENT_ID
      ? new OAuth2Client(config.GOOGLE_CLIENT_ID)
      : null;
  }

  async register({ email, password, displayName, timezone = 'UTC' }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.createUser({
      email,
      passwordHash,
      displayName,
      timezone
    });

    const sessionToken = await this._createSessionForUser(user.id);
    return { user, sessionToken };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.password_hash) {
      throw new UnauthorizedError('This account was created with Google sign-in. Please sign in with Google.');
    }

    const isValid = await verifyPassword(user.password_hash, password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const sessionToken = await this._createSessionForUser(user.id);
    const sanitizedUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      timezone: user.timezone,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    return { user: sanitizedUser, sessionToken };
  }

  async authenticateGoogle(credential) {
    let payload;

    // Handle mock token for local testing without network dependency
    if (
      (config.NODE_ENV === 'test' || config.GOOGLE_CLIENT_ID.startsWith('mock-')) &&
      credential.startsWith('mock-google-token:')
    ) {
      const parts = credential.split(':');
      const email = parts[1] || 'mockuser@example.com';
      const sub = parts[2] || 'google-sub-mock-12345';
      const name = parts[3] || 'Mock Google User';
      payload = {
        sub,
        email,
        email_verified: true,
        name
      };
    } else {
      if (!this.googleClient || !config.GOOGLE_CLIENT_ID) {
        throw new BadRequestError('Google OAuth is not configured on this server');
      }

      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken: credential,
          audience: config.GOOGLE_CLIENT_ID
        });
        payload = ticket.getPayload();
      } catch (err) {
        logger.warn('Google token verification failed', { error: err.message });
        throw new UnauthorizedError('Invalid or expired Google credential');
      }
    }

    if (!payload || !payload.sub || !payload.email) {
      throw new UnauthorizedError('Google identity token did not contain required claims');
    }

    const { sub, email, name, email_verified: emailVerified } = payload;

    if (!emailVerified) {
      throw new UnauthorizedError('Google account email is not verified');
    }

    // 1. Check if identity exists
    let identity = await userRepository.findIdentity('google', sub);
    let user;

    if (identity) {
      user = await userRepository.findById(identity.user_id);
    } else {
      // 2. Identity does not exist: check if user exists by email
      const existingUser = await userRepository.findByEmail(email);

      if (existingUser) {
        // Link identity to existing user safely
        await userRepository.createIdentity({
          userId: existingUser.id,
          provider: 'google',
          providerSubject: sub,
          providerEmail: email
        });
        user = existingUser;
      } else {
        // 3. Create user + identity atomically in a transaction
        user = await withTransaction(async (client) => {
          const newUser = await userRepository.createUser(
            {
              email,
              passwordHash: null,
              displayName: name || email.split('@')[0],
              timezone: 'UTC'
            },
            client
          );

          await userRepository.createIdentity(
            {
              userId: newUser.id,
              provider: 'google',
              providerSubject: sub,
              providerEmail: email
            },
            client
          );

          return newUser;
        });
      }
    }

    const sessionToken = await this._createSessionForUser(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        timezone: user.timezone,
        created_at: user.created_at
      },
      sessionToken
    };
  }

  async logout(sessionToken) {
    if (!sessionToken) return;
    const tokenHash = hashToken(sessionToken);
    await sessionRepository.deleteSession(tokenHash);
  }

  async validateSession(sessionToken) {
    if (!sessionToken) return null;
    const tokenHash = hashToken(sessionToken);
    const session = await sessionRepository.findActiveSession(tokenHash);
    if (!session) return null;

    return {
      user: {
        id: session.id,
        email: session.email,
        display_name: session.display_name,
        timezone: session.timezone,
        created_at: session.created_at
      },
      sessionId: session.session_id,
      expiresAt: session.expires_at
    };
  }

  async _createSessionForUser(userId) {
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600 * 1000);

    await sessionRepository.createSession({
      userId,
      tokenHash,
      expiresAt
    });

    return rawToken;
  }
}

export const authService = new AuthService();
