# Google Cloud Console & Gmail API Integration Guide for AgentShield

This guide explains step-by-step how to configure genuine Google Identity Services (GIS) authentication and the real Gmail API within Google Cloud Console for AgentShield.

---

## 1. Create a Google Cloud Project

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top header and select **New Project**.
3. Name your project (e.g., `AgentShield-Security-Gateway`).
4. Click **Create** and ensure your newly created project is selected.

---

## 2. Enable the Gmail API

1. In the Google Cloud Console navigation menu, go to **APIs & Services** > **Library**.
2. Search for **Gmail API**.
3. Click on **Gmail API** and click the **Enable** button.

---

## 3. Configure the OAuth Consent Screen

1. In the left sidebar, navigate to **APIs & Services** > **OAuth consent screen**.
2. Select User Type:
   - **Internal** (if testing within your Google Workspace domain) OR
   - **External** (if testing with any @gmail.com account).
3. Fill in the App Information:
   - **App name**: `AgentShield Security Gateway`
   - **User support email**: Your Google email.
   - **Developer contact information**: Your Google email.
4. Click **Save and Continue**.
5. Under **Scopes**:
   - Click **Add or Remove Scopes**.
   - Select the following scopes:
     - `.../auth/userinfo.email` (See your primary Google Account email address)
     - `.../auth/userinfo.profile` (See your personal info, including profile picture)
     - `openid` (Associate you with your personal info on Google)
     - `https://www.googleapis.com/auth/gmail.readonly` (Read messages and attachments in Gmail)
   - Click **Update**, then click **Save and Continue**.
6. Under **Test Users** (Critical for External User Type during testing):
   - Click **+ Add Users**.
   - Enter your personal Google email (e.g. `your-email@gmail.com`) and any judge/tester emails.
   - Click **Save and Continue**.

---

## 4. Create OAuth 2.0 Web Client Credentials

1. In the left sidebar, go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. Application type: Select **Web application**.
4. Name: `AgentShield Web Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `http://localhost:3000`
   - `http://localhost:5173`
   - `http://127.0.0.1:3000`
   - `http://127.0.0.1:5173`
   *(Also add your production domain if deploying online)*
6. Under **Authorized redirect URIs**, click **+ Add URI** and add:
   - `http://localhost:3000/api/v1/gmail/oauth/callback`
   - `http://127.0.0.1:3000/api/v1/gmail/oauth/callback`
   - `postmessage` *(Used by Google Identity Services popup code client)*
7. Click **Create**.
8. A modal appears displaying:
   - **Client ID** (e.g., `123456789-xxxx.apps.googleusercontent.com`)
   - **Client Secret** (e.g., `GOCSPX-xxxxxx`)

---

## 5. Configure AgentShield Environment Variables

Create or update your `.env` file in the `agentshield` directory:

```env
PORT=3000

# AgentShield Token Encryption Key (32-byte hex for AES-256-GCM)
AGENTSHIELD_TOKEN_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
AGENTSHIELD_SESSION_SECRET="your-strong-random-session-secret-here"

# Google Cloud OAuth 2.0 Credentials
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/v1/gmail/oauth/callback"

# Frontend Vite Environment Variable (Required for Google button rendering)
VITE_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
```

---

## 6. How the Security Flow Works in AgentShield

1. **Genuine Google Authentication**:
   - The user opens AgentShield and clicks **Continue with Google**.
   - Google Identity Services opens the genuine Google sign-in flow.
   - The user's Google ID token is sent to the AgentShield backend (`POST /api/v1/auth/google`).
   - The backend validates the cryptographic signature using Google's public keys via `OAuth2Client.verifyIdToken`.
   - The user's profile (name, email, picture, Google ID) is stored and a signed session token is created.

2. **Genuine Gmail API Connection**:
   - The authenticated user navigates to the **Gmail Security Vault** and clicks **Connect Gmail**.
   - Google Identity Services opens the official OAuth consent dialog requesting `https://www.googleapis.com/auth/gmail.readonly`.
   - The authorization code returned by Google is sent to the backend (`POST /api/v1/gmail/oauth/callback`).
   - The backend exchanges the code for access and refresh tokens, encrypts them at rest using **AES-256-GCM**, and saves them in SQLite `user_google_tokens`.

3. **Zero-Trust Security Interception**:
   - Every Gmail API call (`GET /api/v1/gmail/messages`, `GET /api/v1/gmail/messages/:id`) passes through `gmail_security_interceptor.ts`.
   - The query and messages are scanned for:
     - Prompt injection attacks (e.g., `Ignore previous instructions`).
     - Data loss / sensitive credential exfiltration (e.g., password scraping, credit cards, SSNs, API tokens).
   - High-risk operations are **BLOCKED** or escalated for **HUMAN APPROVAL**.
   - Every request is sealed in an append-only cryptographic audit ledger with HMAC verification.

4. **Revocation & Disconnection**:
   - When the user clicks **Disconnect Gmail**, the backend contacts Google's token revocation endpoint (`https://oauth2.googleapis.com/revoke`), deletes the encrypted tokens from the database, and clears the connection.
