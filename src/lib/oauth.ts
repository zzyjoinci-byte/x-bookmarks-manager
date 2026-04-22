import crypto from "crypto";
import { saveAuthToken, loadAuthToken, clearAuthToken } from "./db";

const TWITTER_AUTH_URL = "https://x.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.x.com/2/oauth2/token";

// In-memory store for PKCE state (per-process).
// Token state is persisted via SQLite so it survives restarts.
const pkceStore = new Map<string, { codeVerifier: string; createdAt: number }>();

interface TokenState {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

let tokenCache: TokenState | null = null;
let cacheLoaded = false;
let refreshPromise: Promise<string | null> | null = null;

function loadTokenFromDb(): TokenState | null {
  const row = loadAuthToken();
  if (!row) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  };
}

function ensureCacheLoaded(): TokenState | null {
  if (!cacheLoaded) {
    tokenCache = loadTokenFromDb();
    cacheLoaded = true;
  }
  return tokenCache;
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function getClientId(): string {
  const id = process.env.X_CLIENT_ID;
  if (!id) throw new Error("X_CLIENT_ID environment variable is not set");
  return id;
}

export function getRedirectUri(): string {
  return process.env.X_REDIRECT_URI || "http://localhost:3000/api/auth/callback";
}

export function buildAuthUrl(): string {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  pkceStore.set(state, { codeVerifier, createdAt: Date.now() });

  for (const [k, v] of pkceStore) {
    if (Date.now() - v.createdAt > 600_000) pkceStore.delete(k);
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "bookmark.read tweet.read users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${TWITTER_AUTH_URL}?${params}`;
}

function persistToken(state: TokenState) {
  tokenCache = state;
  cacheLoaded = true;
  saveAuthToken({
    access_token: state.accessToken,
    refresh_token: state.refreshToken,
    expires_at: state.expiresAt,
    user_id: null,
    username: null,
  });
}

export async function exchangeCodeForToken(code: string, state: string): Promise<string> {
  const entry = pkceStore.get(state);
  if (!entry) throw new Error("Invalid or expired state parameter");
  pkceStore.delete(state);

  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: entry.codeVerifier,
  });

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const accessToken = json.access_token as string;
  const refreshToken = (json.refresh_token as string | undefined) || null;
  const expiresIn = (json.expires_in as number) || 7200;

  persistToken({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return accessToken;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = getClientId();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    // Refresh failed — token likely revoked or expired. Clear state.
    clearAuthToken();
    tokenCache = null;
    cacheLoaded = true;
    return null;
  }

  const json = await res.json();
  const accessToken = json.access_token as string;
  const newRefresh = (json.refresh_token as string | undefined) || refreshToken;
  const expiresIn = (json.expires_in as number) || 7200;

  persistToken({
    accessToken,
    refreshToken: newRefresh,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return accessToken;
}

export function getStoredToken(): string | null {
  const state = ensureCacheLoaded();
  if (!state) return null;
  // Treat tokens within 60s of expiry as expired so callers don't race.
  if (Date.now() >= state.expiresAt - 60_000) {
    return null;
  }
  return state.accessToken;
}

export async function getValidAccessToken(): Promise<string | null> {
  const state = ensureCacheLoaded();
  if (!state) return null;

  if (Date.now() < state.expiresAt - 60_000) {
    return state.accessToken;
  }

  if (!state.refreshToken) {
    clearAuthToken();
    tokenCache = null;
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(state.refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function clearToken() {
  tokenCache = null;
  cacheLoaded = true;
  clearAuthToken();
}

export function isAuthenticated(): boolean {
  const state = ensureCacheLoaded();
  if (!state) return false;
  // Considered authenticated if a refresh token exists, even if access token is expired.
  if (state.refreshToken) return true;
  return Date.now() < state.expiresAt - 60_000;
}
