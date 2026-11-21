import type { DatabaseSync } from 'node:sqlite';
import { decryptSecret, encryptSecret } from '../core/token_encryption';
import {
  deleteUserGoogleTokens,
  getUserGoogleTokens,
  saveUserGoogleTokens,
  type UserGoogleTokensRow,
} from '../database/db';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  internalDate: string;
  labels: string[];
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText: string;
  hasHtml: boolean;
  sizeEstimate: number;
}

export interface ExchangeCodeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Exchanges Google OAuth 2.0 authorization code for access and refresh tokens.
 */
export async function exchangeOAuthCode(code: string, redirectUri = 'postmessage'): Promise<ExchangeCodeResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured.');
  }

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  // Retrieve user identity for the granted token
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userinfoRes.ok) {
    throw new Error('Failed to retrieve user profile for authenticated Google token.');
  }

  const userinfo = (await userinfoRes.json()) as {
    email: string;
    name?: string;
    picture?: string;
  };

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresIn: tokenData.expires_in,
    scope: tokenData.scope,
    email: userinfo.email,
    name: userinfo.name,
    picture: userinfo.picture,
  };
}

/**
 * Returns a valid, unexpired Google access token for the given user.
 * Automatically uses the encrypted refresh token if expired.
 */
export async function getValidAccessToken(db: DatabaseSync, userId: string): Promise<string> {
  const tokenRow = getUserGoogleTokens(db, userId);
  if (!tokenRow) {
    throw new Error('Gmail account is not connected. Please connect Gmail via Google OAuth.');
  }

  const now = Date.now();
  // If access token is still valid (with 60-second buffer), return decrypted token
  if (now < tokenRow.expires_at - 60_000) {
    return decryptSecret(tokenRow.access_token_enc);
  }

  // Token is expired; refresh using refresh token
  if (!tokenRow.refresh_token_enc) {
    throw new Error('Google access token expired and no refresh token available. Please reconnect Gmail.');
  }

  const refreshToken = decryptSecret(tokenRow.refresh_token_enc);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured on server.');
  }

  const refreshParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshParams.toString(),
  });

  if (!refreshRes.ok) {
    const errText = await refreshRes.text();
    throw new Error(`Google token refresh failed: ${errText}`);
  }

  const refreshData = (await refreshRes.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  const newExpiresAt = Date.now() + refreshData.expires_in * 1000;
  const newAccessTokenEnc = encryptSecret(refreshData.access_token);

  saveUserGoogleTokens(
    db,
    userId,
    tokenRow.email,
    newAccessTokenEnc,
    tokenRow.refresh_token_enc,
    refreshData.scope || tokenRow.scope,
    newExpiresAt
  );

  return refreshData.access_token;
}

/**
 * Revokes Google access/refresh tokens and deletes credentials from storage.
 */
export async function disconnectGmail(db: DatabaseSync, userId: string): Promise<void> {
  const tokenRow = getUserGoogleTokens(db, userId);
  if (tokenRow) {
    try {
      const accessToken = decryptSecret(tokenRow.access_token_enc);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // Continue cleanup even if Google endpoint revocation fails
    }
    deleteUserGoogleTokens(db, userId);
  }
}

/**
 * Fetches real messages from the Gmail API using authenticated access token.
 */
export async function fetchRealGmailMessages(
  accessToken: string,
  options: { maxResults?: number; q?: string; labelIds?: string[] } = {}
): Promise<{ messages: GmailMessageSummary[]; totalEstimated: number }> {
  const maxResults = Math.min(Math.max(Number(options.maxResults || 15), 1), 50);
  const queryParams = new URLSearchParams({
    maxResults: String(maxResults),
  });

  if (options.q && options.q.trim()) {
    queryParams.set('q', options.q.trim());
  }
  if (options.labelIds && options.labelIds.length > 0) {
    for (const label of options.labelIds) {
      queryParams.append('labelIds', label);
    }
  }

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams.toString()}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail API messages.list failed (${listRes.status}): ${errText}`);
  }

  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
    resultSizeEstimate?: number;
  };

  const rawMessages = listData.messages || [];
  if (rawMessages.length === 0) {
    return { messages: [], totalEstimated: 0 };
  }

  // Fetch metadata headers for each message concurrently
  const messagePromises = rawMessages.slice(0, maxResults).map(async (msg) => {
    try {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        labelIds?: string[];
        internalDate?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
        };
      };

      const headers = detail.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const summary: GmailMessageSummary = {
        id: detail.id,
        threadId: detail.threadId,
        snippet: detail.snippet || '',
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || '(Unknown Sender)',
        to: getHeader('To') || '',
        date: getHeader('Date') || '',
        internalDate: detail.internalDate || '',
        labels: detail.labelIds || [],
      };
      return summary;
    } catch {
      return null;
    }
  });

  const resolved = await Promise.all(messagePromises);
  const validMessages = resolved.filter((m): m is GmailMessageSummary => m !== null);

  return {
    messages: validMessages,
    totalEstimated: listData.resultSizeEstimate || validMessages.length,
  };
}

/**
 * Fetches complete email detail including plain text body from the Gmail API.
 */
export async function fetchRealGmailMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
    messageId
  )}?format=full`;

  const res = await fetch(detailUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API messages.get failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    labelIds?: string[];
    internalDate?: string;
    sizeEstimate?: number;
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      }>;
    };
  };

  const headers = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Decode Base64url message payload body
  let bodyText = '';
  let hasHtml = false;

  const extractBody = (part: { mimeType?: string; body?: { data?: string }; parts?: any[] }) => {
    if (part.mimeType === 'text/plain' && part.body?.data && !bodyText) {
      bodyText = Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
    if (part.mimeType === 'text/html') {
      hasHtml = true;
      if (!bodyText && part.body?.data) {
        // Fallback to text extracted from html if no plain text part
        const htmlStr = Buffer.from(part.body.data, 'base64url').toString('utf8');
        bodyText = htmlStr.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                          .replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim();
      }
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const p of part.parts) extractBody(p);
    }
  };

  if (data.payload) {
    extractBody(data.payload);
  }

  if (!bodyText && data.snippet) {
    bodyText = data.snippet;
  }

  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet || '',
    subject: getHeader('Subject') || '(No Subject)',
    from: getHeader('From') || '(Unknown Sender)',
    to: getHeader('To') || '',
    date: getHeader('Date') || '',
    internalDate: data.internalDate || '',
    labels: data.labelIds || [],
    bodyText: bodyText.slice(0, 15000), // Safety cap
    hasHtml,
    sizeEstimate: data.sizeEstimate || 0,
  };
}
