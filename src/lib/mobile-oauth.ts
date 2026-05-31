import crypto from "crypto";
import { createLoginCode, consumeMobileOAuthState, getCloudToken, saveMobileOAuthState, updateCloudToken, upsertUserAndToken } from "@/lib/mobile-db";
import { addSeconds, randomToken, toIso } from "@/lib/mobile-security";
import { getMe } from "@/lib/twitter";

const TWITTER_AUTH_URL = "https://x.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.x.com/2/oauth2/token";

function getClientId(): string {
  const id = process.env.X_CLIENT_ID;
  if (!id) throw new Error("X_CLIENT_ID environment variable is not set");
  return id;
}

function getRedirectUri(): string {
  const uri = process.env.X_REDIRECT_URI;
  if (!uri) throw new Error("X_REDIRECT_URI is required for mobile OAuth");
  return uri;
}

export function getMobileAppRedirectUri(): string {
  return process.env.MOBILE_APP_REDIRECT_URI || "bookmarkfold://auth";
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function buildMobileAuthUrl(): Promise<string> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const state = randomToken(16);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  await saveMobileOAuthState(state, codeVerifier);

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

export async function exchangeMobileCallbackForLoginCode(code: string, state: string): Promise<string | null> {
  const codeVerifier = await consumeMobileOAuthState(state);
  if (!codeVerifier) return null;

  const clientId = getClientId();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    code_verifier: codeVerifier,
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
  const xUser = await getMe(accessToken);
  const user = await upsertUserAndToken({
    xUserId: xUser.id,
    username: xUser.username,
    displayName: xUser.name,
    accessToken,
    refreshToken,
    expiresInSeconds: expiresIn,
  });

  return createLoginCode(user.id);
}

export async function getValidCloudAccessToken(userId: string): Promise<string | null> {
  const token = await getCloudToken(userId);
  if (!token) return null;
  if (new Date(token.expiresAt).getTime() > Date.now() + 60_000) {
    return token.accessToken;
  }
  if (!token.refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
    client_id: getClientId(),
  });

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const expiresIn = (json.expires_in as number) || 7200;
  await updateCloudToken(userId, {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string | undefined) || token.refreshToken,
    expiresAt: toIso(addSeconds(new Date(), expiresIn)),
  });
  return json.access_token as string;
}
