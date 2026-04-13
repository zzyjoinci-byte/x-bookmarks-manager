import crypto from "crypto";

const TWITTER_AUTH_URL = "https://x.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.x.com/2/oauth2/token";

// In-memory store for PKCE state and tokens (per-process, fine for local dev)
const pkceStore = new Map<string, { codeVerifier: string; createdAt: number }>();
let tokenStore: { accessToken: string; expiresAt: number } | null = null;

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

  // Store PKCE verifier keyed by state
  pkceStore.set(state, { codeVerifier, createdAt: Date.now() });

  // Clean up old entries (> 10 min)
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
  const expiresIn = (json.expires_in as number) || 7200;

  tokenStore = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

export function getStoredToken(): string | null {
  if (!tokenStore) return null;
  if (Date.now() >= tokenStore.expiresAt) {
    tokenStore = null;
    return null;
  }
  return tokenStore.accessToken;
}

export function clearToken() {
  tokenStore = null;
}

export function isAuthenticated(): boolean {
  return getStoredToken() !== null;
}
