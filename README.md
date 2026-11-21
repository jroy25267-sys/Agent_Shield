<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/41e88762-9051-4760-9b9e-eed4c69a1356

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Google Sign-In

Google sign-in uses Google Identity Services. Create a Google OAuth 2.0 Web client ID and add the app's local or deployed URL under **Authorized JavaScript origins**. Set the client ID on the server; `VITE_GOOGLE_CLIENT_ID` is an optional frontend fallback:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# Optional when GOOGLE_CLIENT_ID is served by the backend
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart the server after configuring these values. For security, Google sign-in is accepted only for verified Google email addresses that already exist in AgentShield's `admins` table.
