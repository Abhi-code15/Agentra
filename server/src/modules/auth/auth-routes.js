import { Router } from 'express';
import { authController } from './auth-controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rate-limiter.js';

const authRouter = Router();

// Rate limit sensitive auth actions: 30 attempts per minute
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Please try again in a minute.'
});

authRouter.post('/register', authRateLimiter, authController.register);
authRouter.post('/login', authRateLimiter, authController.login);
authRouter.post('/google', authRateLimiter, authController.google);
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.get('/me', requireAuth, authController.me);
authRouter.patch('/me', requireAuth, authController.updateProfile);

export default authRouter;
