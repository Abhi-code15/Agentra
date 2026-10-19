# Agentra — Google OAuth 2.0 / OpenID Connect Setup Guide

This guide walks you through obtaining official Google OAuth credentials for Agentra.

---

## 1. Google Cloud Console Configuration

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one (e.g., `agentra-productivity`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Select **External** user type.
   - Set App name to `Agentra`.
   - Provide your support email and developer contact information.
   - In **Scopes**, add `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Select **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - Development: `http://localhost:5173`
     - Production: `https://your-domain.com`
   - Under **Authorized redirect URIs**, add:
     - Development: `http://localhost:5173`
     - Production: `https://your-domain.com`
5. Save your **Client ID** and **Client Secret**.

---

## 2. Environment Variables Configuration

In `server/.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

In `client/.env.local`:
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## 3. How the Verification Flow Works

1. **Client-side:**
   - The user clicks **Continue with Google** on the login or registration page.
   - Google's official Identity Services modal presents an account chooser.
   - Upon selection, Google returns a cryptographically signed JWT credential.
2. **Server-side Verification:**
   - The client posts `{ credential }` to `POST /api/v1/auth/google`.
   - The server verifies the token signature, audience, and expiration via `OAuth2Client.verifyIdToken`.
   - The verified `sub` claim is extracted as the stable identity identifier.
   - The user identity is linked or created, an opaque session token is issued, and an `HttpOnly` cookie is set.
